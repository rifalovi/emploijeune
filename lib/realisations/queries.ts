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
