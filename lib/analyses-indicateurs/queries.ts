import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Analyse IA publiée d'un indicateur — données publiques.
 */
export type AnalyseIndicateurPublique = {
  id: string;
  indicateur_code: string;
  resume: string | null;
  contenu: string;
  genere_par_ia: boolean;
  modifie_par_sa: boolean;
  published_at: string;
  updated_at: string;
};

/**
 * Analyse IA complète (super_admin uniquement — inclut brouillons).
 */
export type AnalyseIndicateurAdmin = AnalyseIndicateurPublique & {
  statut: 'brouillon' | 'publiee';
  prompt_utilise: string | null;
  tokens_utilises: number | null;
  created_at: string;
  created_by: string | null;
  published_by: string | null;
};

/**
 * Retourne l'analyse publiée la plus récente pour un indicateur donné.
 * Retourne `null` si aucune analyse publiée n'existe.
 */
export async function getAnalysePubliee(
  indicateurCode: string,
): Promise<AnalyseIndicateurPublique | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('analyses_indicateurs')
    .select('id, indicateur_code, resume, contenu, genere_par_ia, modifie_par_sa, published_at, updated_at')
    .eq('indicateur_code', indicateurCode.toUpperCase())
    .eq('statut', 'publiee')
    .order('published_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as AnalyseIndicateurPublique;
}

/**
 * Liste toutes les analyses d'un indicateur (super_admin).
 * Inclut les brouillons.
 */
export async function listerAnalysesAdmin(
  indicateurCode?: string,
): Promise<AnalyseIndicateurAdmin[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('analyses_indicateurs')
    .select(
      'id, indicateur_code, statut, resume, contenu, genere_par_ia, modifie_par_sa, prompt_utilise, tokens_utilises, created_at, updated_at, created_by, published_at, published_by',
    )
    .order('updated_at', { ascending: false });

  if (indicateurCode) {
    query = query.eq('indicateur_code', indicateurCode.toUpperCase());
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as AnalyseIndicateurAdmin[];
}

/**
 * Récupère une analyse par son ID (super_admin).
 */
export async function getAnalyseById(id: string): Promise<AnalyseIndicateurAdmin | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('analyses_indicateurs')
    .select(
      'id, indicateur_code, statut, resume, contenu, genere_par_ia, modifie_par_sa, prompt_utilise, tokens_utilises, created_at, updated_at, created_by, published_at, published_by',
    )
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as AnalyseIndicateurAdmin;
}
