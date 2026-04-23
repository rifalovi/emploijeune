import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BeneficiaireFilters } from '@/lib/schemas/beneficiaire';

/**
 * Détail complet d'un bénéficiaire pour l'affichage fiche et l'édition.
 * Inclut toutes les colonnes métier + métadonnées techniques + libellés
 * résolus via JOIN pour projet (libellé + programme stratégique) et
 * organisation (nom) — évite des lookups client-side redondants.
 */
export type BeneficiaireDetail = {
  id: string;
  prenom: string;
  nom: string;
  sexe: 'F' | 'M' | 'Autre';
  date_naissance: string | null;

  projet_code: string;
  projet_libelle: string | null;
  programme_strategique: string | null;

  pays_code: string;
  organisation_id: string | null;
  organisation_nom: string | null;
  partenaire_accompagnement: string | null;

  domaine_formation_code: string;
  intitule_formation: string | null;
  modalite_formation_code: string | null;
  annee_formation: number;
  date_debut_formation: string | null;
  date_fin_formation: string | null;
  statut_code: string;
  fonction_actuelle: string | null;

  consentement_recueilli: boolean;
  consentement_date: string | null;
  telephone: string | null;
  courriel: string | null;
  localite_residence: string | null;
  commentaire: string | null;

  qualite_a_verifier: boolean;
  source_import: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
};

/**
 * Récupère une fiche bénéficiaire par son ID. Retourne `null` si introuvable
 * (soit inexistant, soit hors périmètre RLS). La distinction 404/403 n'est
 * volontairement pas exposée pour ne pas fuiter l'existence de fiches hors
 * périmètre.
 */
export async function getBeneficiaireById(id: string): Promise<BeneficiaireDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('beneficiaires')
    .select(
      `
      id,
      prenom, nom, sexe, date_naissance,
      projet_code, pays_code,
      organisation_id, partenaire_accompagnement,
      domaine_formation_code, intitule_formation, modalite_formation_code,
      annee_formation, date_debut_formation, date_fin_formation,
      statut_code, fonction_actuelle,
      consentement_recueilli, consentement_date,
      telephone, courriel, localite_residence, commentaire,
      qualite_a_verifier, source_import,
      created_at, created_by, updated_at,
      deleted_at, deleted_by, deleted_reason,
      projet:projets!projet_code ( libelle, programme_strategique ),
      organisation:organisations!organisation_id ( nom )
      `,
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  // Le typage de PostgREST pour les relations embed est complexe ; on
  // décompose manuellement pour rester strict côté TS.
  const projet = Array.isArray(data.projet) ? data.projet[0] : data.projet;
  const organisation = Array.isArray(data.organisation) ? data.organisation[0] : data.organisation;

  return {
    id: data.id,
    prenom: data.prenom,
    nom: data.nom,
    sexe: data.sexe as 'F' | 'M' | 'Autre',
    date_naissance: data.date_naissance,

    projet_code: data.projet_code,
    projet_libelle: projet?.libelle ?? null,
    programme_strategique: projet?.programme_strategique ?? null,

    pays_code: data.pays_code,
    organisation_id: data.organisation_id,
    organisation_nom: organisation?.nom ?? null,
    partenaire_accompagnement: data.partenaire_accompagnement,

    domaine_formation_code: data.domaine_formation_code,
    intitule_formation: data.intitule_formation,
    modalite_formation_code: data.modalite_formation_code,
    annee_formation: data.annee_formation,
    date_debut_formation: data.date_debut_formation,
    date_fin_formation: data.date_fin_formation,
    statut_code: data.statut_code,
    fonction_actuelle: data.fonction_actuelle,

    consentement_recueilli: data.consentement_recueilli,
    consentement_date: data.consentement_date,
    telephone: data.telephone,
    courriel: data.courriel,
    localite_residence: data.localite_residence,
    commentaire: data.commentaire,

    qualite_a_verifier: data.qualite_a_verifier ?? false,
    source_import: data.source_import,
    created_at: data.created_at,
    created_by: data.created_by,
    updated_at: data.updated_at,
    deleted_at: data.deleted_at,
    deleted_by: data.deleted_by,
    deleted_reason: data.deleted_reason,
  };
}

/**
 * Lignes listées dans la table. On retient uniquement les colonnes affichées
 * (server-side projection) pour limiter la charge réseau.
 */
export type BeneficiaireListItem = {
  id: string;
  prenom: string;
  nom: string;
  sexe: 'F' | 'M' | 'Autre';
  date_naissance: string | null;
  projet_code: string;
  pays_code: string;
  domaine_formation_code: string;
  annee_formation: number;
  statut_code: string;
  consentement_recueilli: boolean;
  created_by: string | null;
  organisation_id: string | null;
  updated_at: string;
};

export type ListBeneficiairesResult = {
  rows: BeneficiaireListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Récupère une page de bénéficiaires selon les filtres. La RLS garantit
 * automatiquement que chaque rôle ne voit que son périmètre.
 *
 * Si `filters.q` est fourni, on passe d'abord par la fonction SQL
 * `rechercher_beneficiaires` (pg_trgm similarity) pour récupérer les IDs
 * triés par pertinence, puis on charge les colonnes en respectant cet ordre.
 *
 * Si `filters.ps` est fourni (PS1/PS2/PS3), on filtre via un JOIN
 * implicite sur `projets.programme_strategique` en résolvant d'abord la
 * liste des codes projet du PS (≤ 23 projets, coût négligeable).
 */
export async function listBeneficiaires(
  filters: BeneficiaireFilters,
  pageSize: number = 25,
): Promise<ListBeneficiairesResult> {
  const supabase = await createSupabaseServerClient();
  const page = filters.page ?? 1;
  const offset = (page - 1) * pageSize;

  // -- Étape 1 : recherche textuelle (si q) → IDs ordonnés par pertinence
  let idsParPertinence: string[] | null = null;
  if (filters.q) {
    const { data: hits, error: searchErr } = await supabase.rpc('rechercher_beneficiaires', {
      search_text: filters.q,
    });
    if (searchErr) {
      throw new Error(`Recherche indisponible : ${searchErr.message}`);
    }
    idsParPertinence = (hits ?? []).map((h: { id: string }) => h.id);
    // Aucun résultat de recherche → on renvoie une page vide sans requête supplémentaire.
    if (idsParPertinence.length === 0) {
      return { rows: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }

  // -- Étape 2 : résolution PS → liste de codes projet
  let codesProjetsPS: string[] | null = null;
  if (filters.ps) {
    const { data: projetsPS } = await supabase
      .from('projets')
      .select('code')
      .eq('programme_strategique', filters.ps);
    codesProjetsPS = (projetsPS ?? []).map((p) => p.code);
    if (codesProjetsPS.length === 0) {
      return { rows: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }

  // -- Étape 3 : requête principale
  let query = supabase
    .from('beneficiaires')
    .select(
      'id, prenom, nom, sexe, date_naissance, projet_code, pays_code, domaine_formation_code, annee_formation, statut_code, consentement_recueilli, created_by, organisation_id, updated_at',
      { count: 'exact' },
    )
    .is('deleted_at', null);

  if (idsParPertinence) query = query.in('id', idsParPertinence);
  if (codesProjetsPS) query = query.in('projet_code', codesProjetsPS);
  if (filters.projet_code) query = query.eq('projet_code', filters.projet_code);
  if (filters.pays_code) query = query.eq('pays_code', filters.pays_code);
  if (filters.domaine_formation_code)
    query = query.eq('domaine_formation_code', filters.domaine_formation_code);
  if (filters.annee_formation) query = query.eq('annee_formation', filters.annee_formation);
  if (filters.statut_code) query = query.eq('statut_code', filters.statut_code);
  if (filters.sexe) query = query.eq('sexe', filters.sexe as 'F' | 'M' | 'Autre');
  if (filters.mien) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) query = query.eq('created_by', auth.user.id);
  }

  // Tri : si recherche active, on doit réordonner côté app selon idsParPertinence.
  // Sinon, tri naturel par updated_at desc.
  if (!idsParPertinence) {
    query = query.order('updated_at', { ascending: false });
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`Impossible de charger la liste : ${error.message}`);
  }

  let rows = (data ?? []) as BeneficiaireListItem[];

  // Réordonner selon la pertinence de la recherche si applicable.
  if (idsParPertinence) {
    const rank = new Map(idsParPertinence.map((id, i) => [id, i]));
    rows = [...rows].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  }

  const total = count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { rows, total, page, pageSize, totalPages };
}
