import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  indicateursAnnuelsSchema,
  type IndicateursAnnuelsPayload,
  type SaisieIndicateurBrute,
} from './types';

/**
 * Récupère tous les indicateurs CMR avec leurs valeurs annuelles (RPC
 * `lister_indicateurs_avec_valeurs_annuelles`).
 *
 * Returns `null` en cas d'erreur RPC ou de payload invalide.
 */
export async function getIndicateursAnnuels(): Promise<IndicateursAnnuelsPayload | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('lister_indicateurs_avec_valeurs_annuelles');
  if (error || !data) return null;
  const parse = indicateursAnnuelsSchema.safeParse(data);
  if (!parse.success) return null;
  return parse.data;
}

export type ConfigIndicateur = {
  indicateur_code: string;
  visu_activee: boolean;
  visu_forcee: boolean;
};

export async function getConfigIndicateurs(): Promise<ConfigIndicateur[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('indicateurs_config')
    .select('indicateur_code, visu_activee, visu_forcee');
  if (error || !data) return [];
  return data as ConfigIndicateur[];
}

/**
 * Lit les saisies manuelles brutes pour un indicateur donné, directement
 * depuis `valeurs_indicateurs_saisies` (sans la RPC de fusion auto+saisie).
 *
 * Cela permet d'afficher — et de supprimer / publier — les saisies même
 * quand le calcul automatique (BDD) est prioritaire et que la RPC renvoie
 * `source: 'auto'` pour toutes les lignes (cas A2, Taux d'achèvement).
 */
export async function getSaisiesIndicateur(code: string): Promise<SaisieIndicateurBrute[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('valeurs_indicateurs_saisies')
    .select('annee, numerateur, denominateur, valeur_directe, note, publie')
    .eq('indicateur_code', code)
    .order('annee', { ascending: true });
  if (error || !data) return [];
  return data as SaisieIndicateurBrute[];
}
