/**
 * Requêtes pour la page publique Réalisations.
 *
 * Lit uniquement les saisies avec publie = TRUE (client admin pour contourner
 * les RLS, mais filtre strict sur publie).
 */
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
  const avecDonnees = vals.filter((v) => v.numerateur !== null && v.denominateur !== null && v.denominateur > 0);
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
