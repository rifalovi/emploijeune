import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { EnqueteFilters } from '@/lib/schemas/enquetes/schemas';

/**
 * Détail complet d'une session d'enquête : N lignes reponses_enquetes
 * agrégées en un seul objet pour affichage de la fiche /enquetes/[id].
 */
export type SessionEnqueteDetail = {
  session_id: string;
  questionnaire: 'A' | 'B' | null;
  beneficiaire_id: string | null;
  structure_id: string | null;
  cible_libelle: string | null;
  projet_code: string | null;
  programme_strategique: string | null;
  vague_enquete: string;
  canal_collecte: string;
  date_collecte: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
  /** Map indicateur_code → donnees JSONB de la ligne associée. */
  reponses: Record<string, Record<string, unknown>>;
  /** IDs individuels des lignes (pour modifications fines en V1.5). */
  ligne_ids: Record<string, string>;
};

/**
 * Charge le détail complet d'une session d'enquête (N lignes agrégées).
 * Retourne `null` si la session n'existe pas ou est hors RLS.
 */
export async function getSessionEnqueteById(
  sessionId: string,
): Promise<SessionEnqueteDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('reponses_enquetes')
    .select(
      `
      id, indicateur_code, donnees,
      beneficiaire_id, structure_id, projet_code,
      vague_enquete, canal_collecte, date_collecte,
      created_at, updated_at, created_by, deleted_at,
      beneficiaire:beneficiaires!beneficiaire_id ( prenom, nom, projet_code ),
      structure:structures!structure_id ( nom_structure, projet_code ),
      projet:projets!projet_code ( programme_strategique )
      `,
    )
    .eq('session_enquete_id', sessionId);

  if (error || !data || data.length === 0) return null;

  const reponses: Record<string, Record<string, unknown>> = {};
  const ligne_ids: Record<string, string> = {};
  for (const r of data) {
    reponses[r.indicateur_code] = (r.donnees ?? {}) as Record<string, unknown>;
    ligne_ids[r.indicateur_code] = r.id;
  }

  const premiereLigne = data[0]!;
  const ben = Array.isArray(premiereLigne.beneficiaire)
    ? premiereLigne.beneficiaire[0]
    : premiereLigne.beneficiaire;
  const str = Array.isArray(premiereLigne.structure)
    ? premiereLigne.structure[0]
    : premiereLigne.structure;
  const projet = Array.isArray(premiereLigne.projet)
    ? premiereLigne.projet[0]
    : premiereLigne.projet;

  const cible_libelle = ben ? `${ben.prenom} ${ben.nom}` : (str?.nom_structure ?? null);
  const questionnaire: 'A' | 'B' | null = premiereLigne.beneficiaire_id
    ? 'A'
    : premiereLigne.structure_id
      ? 'B'
      : null;

  return {
    session_id: sessionId,
    questionnaire,
    beneficiaire_id: premiereLigne.beneficiaire_id,
    structure_id: premiereLigne.structure_id,
    cible_libelle,
    projet_code: premiereLigne.projet_code ?? ben?.projet_code ?? str?.projet_code ?? null,
    programme_strategique: projet?.programme_strategique ?? null,
    vague_enquete: premiereLigne.vague_enquete,
    canal_collecte: premiereLigne.canal_collecte,
    date_collecte: premiereLigne.date_collecte,
    created_at: premiereLigne.created_at,
    updated_at: premiereLigne.updated_at,
    created_by: premiereLigne.created_by,
    deleted_at: premiereLigne.deleted_at,
    reponses,
    ligne_ids,
  };
}

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
