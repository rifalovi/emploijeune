import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { indicateursAnnuelsSchema, type IndicateursAnnuelsPayload } from './types';

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
