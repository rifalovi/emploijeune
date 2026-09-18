import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DatasetInput, HistoriqueJob, IndicateurSource } from './types';

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
  let query = supabase
    .from('reponses_enquetes')
    .select('donnees')
    .eq('indicateur_code', indicateurCode)
    .is('deleted_at', null)
    .limit(5000);
  if (projetCode) query = query.eq('projet_code', projetCode);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows: Record<string, unknown>[] = (data ?? []).map((r) => {
    const d = r.donnees;
    return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
  });
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return { rows, columns, name: indicateurCode };
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
    // La table datastudio_jobs n'est pas encore dans les types générés
    // (migration à appliquer) — cast le temps de régénérer les types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('datastudio_jobs' as any)
    .select('id, type, titre, source, statut, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { jobs: [], erreur: error.message };
  return { jobs: (data ?? []) as unknown as HistoriqueJob[], erreur: null };
}
