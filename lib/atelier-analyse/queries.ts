import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { SEXE_LIBELLES } from '@/lib/schemas/nomenclatures';
import type { Sexe } from '@/lib/schemas/nomenclatures';
import type { DatasetInput, HistoriqueJob, IndicateurSource } from './types';

/**
 * Récupère TOUTES les lignes d'une requête Supabase en contournant le plafond
 * PostgREST (max ~1000 lignes par requête, quel que soit `.limit()`).
 *
 * On pagine par lots via `.range()`, avec un ordre STABLE (`id` par défaut) pour
 * éviter tout doublon/oubli entre pages. `construire()` doit renvoyer une requête
 * filtrée (sélection + filtres) SANS `.range()` ni `.limit()`.
 */
async function chargerToutesLignes<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  construire: () => any,
  ordreColonne = 'id',
  opts: { batch?: number; max?: number } = {},
): Promise<T[]> {
  const batch = opts.batch ?? 1000;
  const max = opts.max ?? 200000;
  const out: T[] = [];
  for (let from = 0; from < max; from += batch) {
    const { data, error } = await construire()
      .order(ordreColonne, { ascending: true })
      .range(from, from + batch - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < batch) break; // dernière page atteinte
  }
  return out;
}

/** Âge (années révolues) à partir d'une date de naissance ISO, ou null. */
function ageDepuis(dateNaissance: string | null | undefined): number | null {
  if (!dateNaissance) return null;
  const d = new Date(dateNaissance);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a >= 0 && a < 130 ? a : null;
}

const STATUT_CREATION_LIBELLES: Record<string, string> = {
  creation: 'Création',
  renforcement: 'Renforcement',
  relance: 'Relance',
};

/**
 * Liste les indicateurs actifs pouvant servir de source à l'Atelier d'analyse.
 * (Les réponses d'enquête sont rattachées à un `indicateur_code`.)
 */
export async function listerIndicateursSource(): Promise<IndicateurSource[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('indicateurs')
    .select('code, libelle')
    .eq('actif', true)
    .order('ordre_affichage', { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => ({ code: r.code, libelle: r.libelle }));
}

/**
 * Charge les réponses d'enquête d'un indicateur en jeu de données DataStudio.
 * Le champ JSONB `donnees` de chaque réponse fournit les colonnes ; les clés
 * rencontrées forment l'ensemble des variables.
 */
export async function chargerDatasetEnquete(
  indicateurCode: string,
  projetCode?: string,
): Promise<DatasetInput> {
  const supabase = await createSupabaseServerClient();
  const data = await chargerToutesLignes<{ donnees: unknown }>(() => {
    let q = supabase
      .from('reponses_enquetes')
      .select('donnees')
      .eq('indicateur_code', indicateurCode)
      .is('deleted_at', null);
    if (projetCode) q = q.eq('projet_code', projetCode);
    return q;
  });

  const rows: Record<string, unknown>[] = data.map((r) => {
    const d = r.donnees;
    return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
  });
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return { rows, columns, name: indicateurCode };
}

/** Programmes stratégiques actifs (pour l'analyse multi-projets). */
export async function listerProgrammes(): Promise<{ code: string; libelle: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('programmes_strategiques')
    .select('code, libelle')
    .eq('actif', true)
    .order('ordre_affichage', { ascending: true });
  return (data ?? []).map((p) => ({ code: p.code, libelle: p.libelle }));
}

/** Projets actifs (avec leur programme stratégique) pour l'analyse multi-projets. */
export async function listerProjets(): Promise<
  { code: string; libelle: string; programme: string }[]
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('projets')
    .select('code, libelle, programme_strategique, actif')
    .eq('actif', true)
    .order('ordre_affichage', { ascending: true });
  return (data ?? []).map((p) => ({
    code: p.code,
    libelle: p.libelle,
    programme: p.programme_strategique,
  }));
}

/**
 * Analyse multi-projets : empile les réponses d'un indicateur sur PLUSIEURS
 * projets en une seule base, en ajoutant les colonnes « Projet » et « Programme
 * stratégique ». Permet ensuite de croiser tout résultat par projet/programme.
 * (Traitement mensuel : on plafonne le volume par sécurité.)
 */
export async function chargerDatasetMultiProjets(
  indicateurCode: string,
  projetCodes: string[],
): Promise<DatasetInput> {
  const supabase = await createSupabaseServerClient();

  const [{ data: projets }, { data: programmes }] = await Promise.all([
    supabase.from('projets').select('code, libelle, programme_strategique'),
    supabase.from('programmes_strategiques').select('code, libelle'),
  ]);
  const projMap = new Map(
    (projets ?? []).map((p) => [p.code, p as { libelle: string; programme_strategique: string }]),
  );
  const progMap = new Map((programmes ?? []).map((p) => [p.code, p.libelle]));

  const data = await chargerToutesLignes<{ donnees: unknown; projet_code: string | null }>(() => {
    let q = supabase
      .from('reponses_enquetes')
      .select('donnees, projet_code')
      .eq('indicateur_code', indicateurCode)
      .is('deleted_at', null);
    if (projetCodes.length > 0) q = q.in('projet_code', projetCodes);
    return q;
  });

  const rows: Record<string, unknown>[] = data.map((r) => {
    const d =
      r.donnees && typeof r.donnees === 'object' && !Array.isArray(r.donnees)
        ? (r.donnees as Record<string, unknown>)
        : {};
    const proj = r.projet_code ? projMap.get(r.projet_code) : undefined;
    const progLib = proj
      ? (progMap.get(proj.programme_strategique) ?? proj.programme_strategique)
      : '';
    return {
      ...d,
      Projet: proj?.libelle ?? r.projet_code ?? '(non affecté)',
      Programme: progLib || '(non affecté)',
    };
  });

  const cles = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const columns = [
    ...cles.filter((k) => k !== 'Projet' && k !== 'Programme'),
    'Projet',
    'Programme',
  ];
  return {
    rows,
    columns,
    name: `Multi-projets — ${indicateurCode}`,
    variable_labels: { Projet: 'Projet', Programme: 'Programme stratégique' },
  };
}

/** Libellé du programme stratégique d'un projet (via les nomenclatures). */
async function mapProgrammes(): Promise<Map<string, string>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('programmes_strategiques').select('code, libelle');
  return new Map((data ?? []).map((p) => [p.code, p.libelle]));
}

/**
 * Base BÉNÉFICIAIRES (indicateur A1) en jeu de données DataStudio : colonnes
 * analytiques en libellés (sexe, tranche d'âge, pays, projet, programme,
 * domaine/modalité de formation, statut…), filtrable par projet. Les données
 * d'identité (nom, contact…) sont volontairement exclues.
 */
export async function chargerDatasetBeneficiaires(projetCode?: string): Promise<DatasetInput> {
  const supabase = await createSupabaseServerClient();
  const [nom, progMap] = await Promise.all([getNomenclatures(), mapProgrammes()]);

  type BeneficiaireRow = {
    sexe: string | null;
    date_naissance: string | null;
    tranche_age_declaree: string | null;
    projet_code: string | null;
    pays_code: string | null;
    partenaire_accompagnement: string | null;
    domaine_formation_code: string | null;
    modalite_formation_code: string | null;
    annee_formation: number | null;
    statut_code: string | null;
    fonction_actuelle: string | null;
    localite_residence: string | null;
  };
  const data = await chargerToutesLignes<BeneficiaireRow>(() => {
    let q = supabase
      .from('beneficiaires')
      .select(
        'sexe, date_naissance, tranche_age_declaree, projet_code, pays_code, partenaire_accompagnement, domaine_formation_code, modalite_formation_code, annee_formation, statut_code, fonction_actuelle, localite_residence',
      )
      .is('deleted_at', null);
    if (projetCode) q = q.eq('projet_code', projetCode);
    return q;
  });

  const rows = data.map((b) => {
    const projMeta = b.projet_code ? nom.projets.get(b.projet_code) : undefined;
    const prog = projMeta?.programme_strategique ?? null;
    const age = ageDepuis(b.date_naissance as string | null);
    const tranche =
      (b.tranche_age_declaree as string | null) ??
      (age === null ? null : age <= 34 ? 'Jeune (≤ 34 ans)' : 'Adulte (35 ans et +)');
    return {
      Sexe: SEXE_LIBELLES[b.sexe as Sexe] ?? b.sexe ?? '',
      Âge: age,
      "Tranche d'âge": tranche ?? '',
      Pays: (b.pays_code ? nom.pays.get(b.pays_code) : null) ?? b.pays_code ?? '',
      Projet: projMeta?.libelle ?? b.projet_code ?? '',
      'Programme stratégique': (prog ? progMap.get(prog) : null) ?? prog ?? '',
      Partenaire: b.partenaire_accompagnement ?? '',
      'Domaine de formation':
        (b.domaine_formation_code ? nom.domaines.get(b.domaine_formation_code) : null) ??
        b.domaine_formation_code ??
        '',
      Modalité:
        (b.modalite_formation_code ? nom.modalites.get(b.modalite_formation_code) : null) ??
        b.modalite_formation_code ??
        '',
      'Année de formation': b.annee_formation ?? null,
      Statut: (b.statut_code ? nom.statuts.get(b.statut_code) : null) ?? b.statut_code ?? '',
      'Fonction actuelle': b.fonction_actuelle ?? '',
      Localité: b.localite_residence ?? '',
    } as Record<string, unknown>;
  });

  const columns = [
    'Sexe',
    'Âge',
    "Tranche d'âge",
    'Pays',
    'Projet',
    'Programme stratégique',
    'Partenaire',
    'Domaine de formation',
    'Modalité',
    'Année de formation',
    'Statut',
    'Fonction actuelle',
    'Localité',
  ];
  return { rows, columns, name: projetCode ? `Bénéficiaires — ${projetCode}` : 'Bénéficiaires' };
}

/**
 * Base STRUCTURES (indicateur B1) en jeu de données DataStudio : colonnes
 * analytiques en libellés (type, secteur, statut de création, pays, projet,
 * programme, sexe du porteur, nature/montant de l'appui…), filtrable par projet.
 */
export async function chargerDatasetStructures(projetCode?: string): Promise<DatasetInput> {
  const supabase = await createSupabaseServerClient();
  const [nom, progMap] = await Promise.all([getNomenclatures(), mapProgrammes()]);

  type StructureRow = {
    type_structure_code: string | null;
    secteur_activite_code: string | null;
    secteur_precis: string | null;
    statut_creation: string | null;
    projet_code: string | null;
    pays_code: string | null;
    porteur_sexe: string | null;
    annee_appui: number | null;
    nature_appui_code: string | null;
    montant_appui: number | null;
    devise_code: string | null;
    localite: string | null;
  };
  const data = await chargerToutesLignes<StructureRow>(() => {
    let q = supabase
      .from('structures')
      .select(
        'type_structure_code, secteur_activite_code, secteur_precis, statut_creation, projet_code, pays_code, porteur_sexe, annee_appui, nature_appui_code, montant_appui, devise_code, localite',
      )
      .is('deleted_at', null);
    if (projetCode) q = q.eq('projet_code', projetCode);
    return q;
  });

  const rows = data.map((s) => {
    const projMeta = s.projet_code ? nom.projets.get(s.projet_code) : undefined;
    const prog = projMeta?.programme_strategique ?? null;
    return {
      'Type de structure':
        (s.type_structure_code ? nom.typesStructure.get(s.type_structure_code) : null) ??
        s.type_structure_code ??
        '',
      Secteur:
        (s.secteur_activite_code ? nom.secteursActivite.get(s.secteur_activite_code) : null) ??
        s.secteur_activite_code ??
        '',
      'Secteur précis': s.secteur_precis ?? '',
      'Statut de création':
        STATUT_CREATION_LIBELLES[String(s.statut_creation)] ?? s.statut_creation ?? '',
      Pays: (s.pays_code ? nom.pays.get(s.pays_code) : null) ?? s.pays_code ?? '',
      Projet: projMeta?.libelle ?? s.projet_code ?? '',
      'Programme stratégique': (prog ? progMap.get(prog) : null) ?? prog ?? '',
      'Sexe du porteur': s.porteur_sexe
        ? (SEXE_LIBELLES[s.porteur_sexe as Sexe] ?? s.porteur_sexe)
        : '',
      "Année d'appui": s.annee_appui ?? null,
      "Nature de l'appui":
        (s.nature_appui_code ? nom.naturesAppui.get(s.nature_appui_code) : null) ??
        s.nature_appui_code ??
        '',
      "Montant de l'appui": s.montant_appui ?? null,
      Devise: (s.devise_code ? nom.devises.get(s.devise_code) : null) ?? s.devise_code ?? '',
      Localité: s.localite ?? '',
    } as Record<string, unknown>;
  });

  const columns = [
    'Type de structure',
    'Secteur',
    'Secteur précis',
    'Statut de création',
    'Pays',
    'Projet',
    'Programme stratégique',
    'Sexe du porteur',
    "Année d'appui",
    "Nature de l'appui",
    "Montant de l'appui",
    'Devise',
    'Localité',
  ];
  return { rows, columns, name: projetCode ? `Structures — ${projetCode}` : 'Structures' };
}

/**
 * Historique des traitements de l'utilisateur (table datastudio_jobs).
 * La table peut ne pas encore exister en base (migration non appliquée) :
 * on renvoie alors un message plutôt qu'une erreur bloquante.
 */
export async function listerHistorique(): Promise<{
  jobs: HistoriqueJob[];
  erreur: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('datastudio_jobs')
    .select('id, type, titre, source, source_ref, statut, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return { jobs: [], erreur: error.message };
  return { jobs: (data ?? []) as HistoriqueJob[], erreur: null };
}
