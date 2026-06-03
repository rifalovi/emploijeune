'use server';

import { revalidatePath } from 'next/cache';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ── Guard ─────────────────────────────────────────────────────────────────────

async function exigerAdmin() {
  const u = await requireUtilisateurValide();
  if (!['admin_scs', 'super_admin'].includes(u.role)) {
    throw new Error('Accès réservé aux administrateurs.');
  }
  return u;
}

// =============================================================================
// MODULE 1 — Vue données collectées
// =============================================================================

export type TypeCollecte = '0' | 'A' | 'B' | 'C' | 'D';
export type StatutSoumission = 'en_attente' | 'valide' | 'rejete';

export type SoumissionLigne = {
  id: string;
  type: TypeCollecte;
  statut: StatutSoumission;
  categorie_repondant: string | null;
  nom_principal: string;
  contact: string | null;
  pays_code: string | null;
  projet_code: string | null;
  lien_label: string | null;
  created_at: string;
  valide_at: string | null;
  entite_creee_id: string | null;
  donnees: Record<string, unknown>;
};

export type SoumissionsResult = {
  lignes: SoumissionLigne[];
  total: number;
  stats: Record<string, number>;
};

function extraireChampsCles(
  type: string,
  donnees: Record<string, unknown>,
  categorie: string | null
): Pick<SoumissionLigne, 'nom_principal' | 'contact' | 'pays_code'> {
  const estStructure =
    type === 'B' || type === 'D' || (type === '0' && categorie === 'structure');

  if (estStructure) {
    return {
      nom_principal: (donnees.nom_structure as string) ?? '—',
      contact: (donnees.porteur_nom as string) ?? null,
      pays_code: (donnees.porteur_pays_code as string) ?? (donnees.pays_code as string) ?? null,
    };
  }

  const prenom = (donnees.prenom as string) ?? '';
  const nom = (donnees.nom as string) ?? '';
  return {
    nom_principal: [prenom, nom].filter(Boolean).join(' ') || '—',
    contact: (donnees.email as string) ?? null,
    pays_code: (donnees.pays_code as string) ?? null,
  };
}

export async function listerSoumissionsCollectees(params: {
  type?: TypeCollecte | 'tous';
  statut?: StatutSoumission | 'tous';
  page?: number;
  pageSize?: number;
}): Promise<SoumissionsResult> {
  await exigerAdmin();
  const supabase = await createSupabaseServerClient();

  const { type = 'tous', statut = 'tous', page = 1, pageSize = 50 } = params;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('soumissions_collecte')
    .select(
      `id, type, statut, categorie_repondant, donnees, created_at, valide_at, entite_creee_id,
       lien:liens_collecte_publique(label, projet_code)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (type !== 'tous') query = query.eq('type', type);
  if (statut !== 'tous') query = query.eq('statut', statut);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  // Stats par type (always all statuts)
  const { data: statsData } = await supabase
    .from('soumissions_collecte')
    .select('type, statut');

  const stats: Record<string, number> = { tous: 0 };
  for (const row of statsData ?? []) {
    stats[row.type] = (stats[row.type] ?? 0) + 1;
    stats.tous = (stats.tous ?? 0) + 1;
    stats[`${row.type}_${row.statut}`] = (stats[`${row.type}_${row.statut}`] ?? 0) + 1;
    stats[`tous_${row.statut}`] = (stats[`tous_${row.statut}`] ?? 0) + 1;
  }

  const lignes: SoumissionLigne[] = (data ?? []).map((row) => {
    const lien = Array.isArray(row.lien) ? row.lien[0] : row.lien;
    const champs = extraireChampsCles(
      row.type,
      row.donnees as Record<string, unknown>,
      row.categorie_repondant
    );
    return {
      id: row.id,
      type: row.type as TypeCollecte,
      statut: row.statut as StatutSoumission,
      categorie_repondant: row.categorie_repondant,
      ...champs,
      projet_code: (lien?.projet_code as string) ?? null,
      lien_label: (lien?.label as string) ?? null,
      created_at: row.created_at,
      valide_at: row.valide_at,
      entite_creee_id: row.entite_creee_id,
      donnees: row.donnees as Record<string, unknown>,
    };
  });

  return { lignes, total: count ?? 0, stats };
}

// =============================================================================
// MODULE 2 — Croisement bénéficiaires
// =============================================================================

export type CroisementLigne = {
  soumission_id: string;
  soumission_created_at: string;
  nom: string;
  prenom: string;
  email: string | null;
  pays_code: string | null;
  projet_code: string | null;
  entite_id: string | null;
  // Champs manquants dans le bénéficiaire créé
  champs_manquants: string[];
  nb_champs_remplis: number;
  nb_champs_total: number;
};

const CHAMPS_COMPLETS_BENEF = [
  'prenom', 'nom', 'sexe', 'tranche_age_declaree',
  'pays_code', 'projet_code', 'domaine_formation_code',
  'statut_code', 'consentement_recueilli',
];

export async function croisementBeneficiaires(): Promise<{
  nouvelles: CroisementLigne[];
  incompletes: CroisementLigne[];
  total_valides: number;
}> {
  await exigerAdmin();
  const supabase = await createSupabaseServerClient();

  // Soumissions validées de type bénéficiaire (A, C, ou 0-beneficiaire)
  const { data: soumissions } = await supabase
    .from('soumissions_collecte')
    .select('id, type, categorie_repondant, donnees, created_at, entite_creee_id, lien:liens_collecte_publique(projet_code)')
    .eq('statut', 'valide')
    .in('type', ['0', 'A', 'C'])
    .order('created_at', { ascending: false });

  const benef_soumissions = (soumissions ?? []).filter(
    (s) => s.type !== '0' || s.categorie_repondant === 'beneficiaire'
  );

  const entiteIds = benef_soumissions
    .map((s) => s.entite_creee_id)
    .filter(Boolean) as string[];

  // Charger les bénéficiaires créés depuis ces soumissions
  const { data: beneficiaires } = entiteIds.length
    ? await supabase
        .from('beneficiaires')
        .select('id, prenom, nom, sexe, tranche_age_declaree, pays_code, projet_code, domaine_formation_code, statut_code, courriel, consentement_recueilli')
        .in('id', entiteIds)
    : { data: [] };

  const benefMap = new Map((beneficiaires ?? []).map((b) => [b.id, b]));

  const nouvelles: CroisementLigne[] = [];
  const incompletes: CroisementLigne[] = [];

  for (const s of benef_soumissions) {
    const d = s.donnees as Record<string, unknown>;
    const lien = Array.isArray(s.lien) ? s.lien[0] : s.lien;
    const benef = s.entite_creee_id ? benefMap.get(s.entite_creee_id) : null;

    const champs_manquants: string[] = [];
    let nb_remplis = 0;

    for (const champ of CHAMPS_COMPLETS_BENEF) {
      const val = benef ? (benef as Record<string, unknown>)[champ] : null;
      if (val === null || val === undefined || val === '') {
        champs_manquants.push(champ);
      } else {
        nb_remplis++;
      }
    }

    const ligne: CroisementLigne = {
      soumission_id: s.id,
      soumission_created_at: s.created_at,
      nom: (d.nom as string) ?? (benef?.nom ?? '—'),
      prenom: (d.prenom as string) ?? (benef?.prenom ?? '—'),
      email: (d.email as string) ?? benef?.courriel ?? null,
      pays_code: (d.pays_code as string) ?? benef?.pays_code ?? null,
      projet_code: (lien?.projet_code as string) ?? benef?.projet_code ?? null,
      entite_id: s.entite_creee_id,
      champs_manquants,
      nb_champs_remplis: nb_remplis,
      nb_champs_total: CHAMPS_COMPLETS_BENEF.length,
    };

    if (!s.entite_creee_id) {
      nouvelles.push(ligne);
    } else if (champs_manquants.length > 0) {
      incompletes.push(ligne);
    }
  }

  return {
    nouvelles,
    incompletes,
    total_valides: benef_soumissions.length,
  };
}

// =============================================================================
// MODULE 3 — Indicateurs vivants
// =============================================================================

export type ValeurIndicateur = {
  indicateur_code: string;
  valeur_numerique: number | null;
  valeur_detail: Record<string, unknown> | null;
  calculee_at: string;
};

export type ValeurPubliee = {
  indicateur_code: string;
  valeur_numerique: number | null;
  valeur_detail: Record<string, unknown> | null;
  publiee_at: string | null;
  publiee_par_id: string | null;
};

export type IndicateursLiveResult = {
  calculees: ValeurIndicateur[];
  publiees: ValeurPubliee[];
};

export async function lireIndicateursLive(): Promise<IndicateursLiveResult> {
  await exigerAdmin();
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: calculees, error } = await (supabase.rpc as any)('calculer_indicateurs_live_v1');
  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: publiees } = await (supabase as any)
    .from('valeurs_indicateurs')
    .select('indicateur_code, valeur_numerique, valeur_detail, publiee_at, publiee_par');

  return {
    calculees: (calculees ?? []) as ValeurIndicateur[],
    publiees: (publiees ?? []).map((p: Record<string, unknown>) => ({
      indicateur_code: p.indicateur_code as string,
      valeur_numerique: p.valeur_numerique as number | null,
      valeur_detail: p.valeur_detail as Record<string, unknown> | null,
      publiee_at: p.publiee_at as string | null,
      publiee_par_id: p.publiee_par as string | null,
    })) as ValeurPubliee[],
  };
}

export async function publierIndicateurs(
  codes: string[]
): Promise<{ status: 'succes'; nb: number } | { status: 'erreur'; message: string }> {
  try {
    await exigerAdmin();
    const supabase = await createSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('publier_indicateurs_v1', {
      p_codes: codes,
    });
    if (error) return { status: 'erreur', message: error.message };
    revalidatePath('/collecte-analytique/indicateurs');
    revalidatePath('/referentiels');
    return { status: 'succes', nb: data as number };
  } catch (e) {
    return { status: 'erreur', message: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// =============================================================================
// Stats globales soumissions (pour la page d'accueil du module)
// =============================================================================
export type StatsGlobalesCollecte = {
  total: number;
  par_type: Record<string, number>;
  par_statut: Record<string, number>;
  derniere_soumission: string | null;
};

export async function lireStatsGlobalesCollecte(): Promise<StatsGlobalesCollecte> {
  await exigerAdmin();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('soumissions_collecte')
    .select('type, statut, created_at')
    .order('created_at', { ascending: false });

  const par_type: Record<string, number> = {};
  const par_statut: Record<string, number> = {};
  let derniere: string | null = null;

  for (const row of data ?? []) {
    par_type[row.type] = (par_type[row.type] ?? 0) + 1;
    par_statut[row.statut] = (par_statut[row.statut] ?? 0) + 1;
    if (!derniere) derniere = row.created_at;
  }

  return {
    total: (data ?? []).length,
    par_type,
    par_statut,
    derniere_soumission: derniere,
  };
}
