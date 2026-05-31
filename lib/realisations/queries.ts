/**
 * Requêtes pour la page publique Réalisations.
 *
 * Lit uniquement les saisies avec publie = TRUE (client admin pour contourner
 * les RLS, mais filtre strict sur publie).
 */
import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type ValeurPubliee = {
  annee: number;
  numerateur: number | null;
  denominateur: number | null;
  valeur_directe: number | null;
};

/** Toutes les saisies publiées pour un indicateur, triées par année. */
export async function getValeursPubliees(code: string): Promise<ValeurPubliee[]> {
  const admin = createSupabaseAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('valeurs_indicateurs_saisies')
    .select('annee, numerateur, denominateur, valeur_directe')
    .eq('indicateur_code', code)
    .eq('publie', true)
    .order('annee', { ascending: true });
  return (data ?? []) as ValeurPubliee[];
}

/**
 * Agrège numérateur/dénominateur toutes années confondues → taux global.
 * Retourne null si aucune donnée utilisable.
 */
export function agregerTaux(
  vals: ValeurPubliee[],
): { taux: number; numerateur: number; denominateur: number } | null {
  const avecDonnees = vals.filter(
    (v) => v.numerateur !== null && v.denominateur !== null && v.denominateur > 0,
  );
  if (avecDonnees.length === 0) return null;
  const totalNum = avecDonnees.reduce((s, v) => s + (v.numerateur ?? 0), 0);
  const totalDenom = avecDonnees.reduce((s, v) => s + (v.denominateur ?? 0), 0);
  return {
    taux: Math.round((totalNum / totalDenom) * 1000) / 10,
    numerateur: totalNum,
    denominateur: totalDenom,
  };
}

/**
 * Somme des valeurs directes (ou numérateurs) pour les indicateurs de type volume.
 * Retourne null si vide.
 */
export function agregerTotal(vals: ValeurPubliee[]): number | null {
  const total = vals.reduce((s, v) => s + (v.valeur_directe ?? v.numerateur ?? 0), 0);
  return total > 0 ? total : null;
}

// ─── KPIs contextuels (champs secondaires de présentation) ───────────────────

export type KpisContexte = {
  indicateur_code: string;
  pays_count: number | null;
  femmes_count: number | null;
  nb_jeunes: number | null;
  nb_adultes: number | null;
  participants_count: number | null;
  ayant_progresse: number | null;
  gain_moyen: number | null;
  sources_public_pct: number | null;
  sources_prive_pct: number | null;
  note: string | null;
  /**
   * Si TRUE, la saisie manuelle prend la priorité sur les valeurs auto BDD
   * dans mergerKpisContexte(). Défaut FALSE = auto BDD prioritaire.
   */
  forcer_manuel: boolean;
};

/**
 * Lit la ligne de KPIs contextuels pour un indicateur.
 * Utilise le client admin pour garantir la lecture même sur les pages publiques.
 * Retourne null si aucune donnée encore saisie.
 */
export async function getKpisContexte(code: string): Promise<KpisContexte | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('kpis_contexte_indicateurs')
    .select('*')
    .eq('indicateur_code', code)
    .maybeSingle();
  return (data as KpisContexte | null) ?? null;
}

// ─── KPIs contextuels auto-calculés depuis la BDD ────────────────────────────

export type KpisContexteAuto = {
  pays_count: number | null;
  femmes_count: number | null;
  nb_jeunes: number | null;
  nb_adultes: number | null;
};

const EMPTY_AUTO: KpisContexteAuto = {
  pays_count: null,
  femmes_count: null,
  nb_jeunes: null,
  nb_adultes: null,
};

/** Jeune (15-34) / Adulte (35+) — priorité tranche_age_declaree, fallback date_naissance. */
function classifierTrancheAge(
  tranche_age_declaree: string | null | undefined,
  date_naissance: string | null | undefined,
): 'Jeune' | 'Adulte' | null {
  if (tranche_age_declaree === 'Jeune' || tranche_age_declaree === 'Adulte') {
    return tranche_age_declaree;
  }
  if (date_naissance) {
    const naissance = new Date(date_naissance);
    if (isNaN(naissance.getTime())) return null;
    const today = new Date();
    const age =
      today.getFullYear() -
      naissance.getFullYear() -
      (today < new Date(today.getFullYear(), naissance.getMonth(), naissance.getDate()) ? 1 : 0);
    if (age >= 15 && age <= 34) return 'Jeune';
    if (age >= 35) return 'Adulte';
  }
  return null;
}

/**
 * Calcule automatiquement les KPI contextuels (pays/femmes/jeunes/adultes)
 * depuis la BDD selon l'indicateur. Champs `null` quand aucune donnée auto
 * disponible → permet à `mergerKpisContexte()` de basculer sur la saisie manuelle.
 *
 * Mapping :
 *   A1                  → beneficiaires (tous)
 *   A2 / A3             → beneficiaires WHERE statut_code='FORMATION_ACHEVEE'
 *   A4 / A5             → beneficiaires (tous, proxy en attendant collecte fine)
 *   B*                  → structures (pays_code uniquement)
 *   C*, D*, F1          → pas de source auto → fallback complet sur manuel
 */
export async function getKpisContexteAuto(code: string): Promise<KpisContexteAuto> {
  const admin = createSupabaseAdminClient();

  if (code.startsWith('A')) {
    const FILTRE_STATUT: Record<string, string | null> = {
      A1: null,
      A2: 'FORMATION_ACHEVEE',
      A3: 'FORMATION_ACHEVEE',
      A4: null,
      A5: null,
    };
    const filtre = FILTRE_STATUT[code] ?? null;
    let q = admin
      .from('beneficiaires')
      .select('pays_code, sexe, tranche_age_declaree, date_naissance')
      .is('deleted_at', null);
    if (filtre) q = q.eq('statut_code', filtre);
    const { data } = await q;
    if (!data || data.length === 0) return EMPTY_AUTO;

    const pays = new Set(data.map((r) => r.pays_code).filter((c): c is string => Boolean(c))).size;
    const femmes = data.filter((r) => r.sexe === 'F').length;
    let jeunes = 0;
    let adultes = 0;
    for (const r of data) {
      const t = classifierTrancheAge(r.tranche_age_declaree, r.date_naissance);
      if (t === 'Jeune') jeunes++;
      else if (t === 'Adulte') adultes++;
    }
    return {
      pays_count: pays > 0 ? pays : null,
      femmes_count: femmes > 0 ? femmes : null,
      nb_jeunes: jeunes > 0 ? jeunes : null,
      nb_adultes: adultes > 0 ? adultes : null,
    };
  }

  if (code.startsWith('B')) {
    const { data } = await admin.from('structures').select('pays_code').is('deleted_at', null);
    if (!data || data.length === 0) return EMPTY_AUTO;
    const pays = new Set(data.map((r) => r.pays_code).filter((c): c is string => Boolean(c))).size;
    return { ...EMPTY_AUTO, pays_count: pays > 0 ? pays : null };
  }

  return EMPTY_AUTO;
}

/**
 * Fusionne les KPIs contextuels selon la source choisie par l'admin :
 *
 * forcerManuel = FALSE (défaut — auto BDD prioritaire) :
 *   1. Auto BDD (prioritaire dès qu'une valeur existe)
 *   2. Saisie manuelle — fallback si champ auto absent
 *   3. null sinon
 *
 * forcerManuel = TRUE (saisie manuelle prioritaire) :
 *   1. Saisie manuelle (prioritaire)
 *   2. Auto BDD — fallback si champ manuel absent
 *   3. null sinon
 */
export function mergerKpisContexte(
  auto: KpisContexteAuto,
  manuel: KpisContexte | null,
  forcerManuel = false,
): KpisContexteAuto {
  if (forcerManuel) {
    return {
      pays_count: manuel?.pays_count ?? auto.pays_count ?? null,
      femmes_count: manuel?.femmes_count ?? auto.femmes_count ?? null,
      nb_jeunes: manuel?.nb_jeunes ?? auto.nb_jeunes ?? null,
      nb_adultes: manuel?.nb_adultes ?? auto.nb_adultes ?? null,
    };
  }
  return {
    pays_count: auto.pays_count ?? manuel?.pays_count ?? null,
    femmes_count: auto.femmes_count ?? manuel?.femmes_count ?? null,
    nb_jeunes: auto.nb_jeunes ?? manuel?.nb_jeunes ?? null,
    nb_adultes: auto.nb_adultes ?? manuel?.nb_adultes ?? null,
  };
}
