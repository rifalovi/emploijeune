import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { EnqueteFilters } from '@/lib/schemas/enquetes/schemas';

/**
 * Une session d'enquête (1 ligne = 1 soumission de questionnaire) telle que
 * renvoyée par la fonction SQL `lister_sessions_enquete`.
 */
export type SessionEnqueteListItem = {
  id: string;
  beneficiaire_id: string | null;
  structure_id: string | null;
  cible_libelle: string | null;
  questionnaire: 'A' | 'B' | null;
  projet_code: string | null;
  programme_strategique: string | null;
  vague_enquete: string;
  canal_collecte: string;
  date_collecte: string;
  nb_indicateurs: number;
  indicateurs: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type ListSessionsEnqueteResult = {
  rows: SessionEnqueteListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Liste paginée et filtrée des sessions d'enquête. Délègue à la fonction
 * SQL `lister_sessions_enquete` (RLS appliquée via SECURITY INVOKER).
 */
export async function listSessionsEnquete(
  filters: EnqueteFilters,
  pageSize: number = 25,
): Promise<ListSessionsEnqueteResult> {
  const supabase = await createSupabaseServerClient();
  const page = filters.page ?? 1;
  const offset = (page - 1) * pageSize;

  let mienUid: string | null = null;
  if (filters.mien) {
    const { data: auth } = await supabase.auth.getUser();
    mienUid = auth.user?.id ?? null;
  }

  const { data, error } = await supabase.rpc('lister_sessions_enquete', {
    p_questionnaire: filters.questionnaire ?? null,
    p_projet_code: filters.projet_code ?? null,
    p_cible_id: filters.cible_id ?? null,
    p_vague_enquete: filters.vague_enquete ?? null,
    p_canal_collecte: filters.canal_collecte ?? null,
    p_date_debut: filters.date_debut ? filters.date_debut.toISOString().slice(0, 10) : null,
    p_date_fin: filters.date_fin ? filters.date_fin.toISOString().slice(0, 10) : null,
    p_recherche: filters.q ?? null,
    p_mien_uid: mienUid,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    throw new Error(`Impossible de charger la liste des enquêtes : ${error.message}`);
  }

  type Row = SessionEnqueteListItem & { total_count: number };
  const rawRows = (data ?? []) as Row[];

  const total = rawRows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rows: SessionEnqueteListItem[] = rawRows.map((r) => {
    // On omet total_count de la ligne pour ne pas le propager à l'UI.
    const { total_count: _omit, ...rest } = r;
    void _omit;
    return rest;
  });

  return { rows, total, page, pageSize, totalPages };
}
