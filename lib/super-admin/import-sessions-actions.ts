'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { hasPermission } from '@/lib/super-admin/permissions';

export type SessionImport = {
  id: string;
  fichier_nom: string;
  created_at: string;
  created_by: string | null;
  created_by_nom: string;
  statut: string;
  nb_inserees: number;
  nb_doublons: number;
  nb_rejetees: number;
  peut_rollback: boolean;
  rollback_expire_at: string | null;
  lignes_reelles: number;
  est_zombie: boolean;
  /** Type d'import déduit des lignes liées : 'beneficiaires' (A1), 'structures' (B1), 'mixte' ou 'inconnu'. */
  type_import?: string;
};

export type DoublonGroupe = {
  cle_identite: string;
  occurrences: number;
  beneficiaire_ids: string[];
  dates_creation: string[];
};

type Resultat<T = void> = T extends void
  ? { status: 'succes' } | { status: 'erreur'; message: string }
  : { status: 'succes'; data: T } | { status: 'erreur'; message: string };

type Garde =
  | { utilisateur: NonNullable<Awaited<ReturnType<typeof getCurrentUtilisateur>>> }
  | { erreur: string };

async function exigerAccesImportSessions(): Promise<Garde> {
  const u = await getCurrentUtilisateur();
  if (!u) return { erreur: 'non_authentifie' };
  if (u.role === 'super_admin') return { utilisateur: u };
  if (u.role === 'admin_scs') {
    const ok = await hasPermission(u.id, 'import_sessions');
    if (ok) return { utilisateur: u };
  }
  return { erreur: 'reserve_super_admin' };
}

async function exigerAccesDoublons(): Promise<Garde> {
  const u = await getCurrentUtilisateur();
  if (!u) return { erreur: 'non_authentifie' };
  if (u.role === 'super_admin') return { utilisateur: u };
  if (u.role === 'admin_scs') {
    const ok = await hasPermission(u.id, 'doublons');
    if (ok) return { utilisateur: u };
  }
  return { erreur: 'reserve_super_admin' };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listerSessionsImports(limite = 100): Promise<SessionImport[]> {
  const garde = await exigerAccesImportSessions();
  if ('erreur' in garde) return [];

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.rpc as any)('lister_sessions_imports_v1', { p_limite: limite });
  return (data ?? []) as SessionImport[];
}

export async function detecterDoublons(): Promise<DoublonGroupe[]> {
  const garde = await exigerAccesDoublons();
  if ('erreur' in garde) return [];

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.rpc as any)('detecter_doublons_v1');
  return (data ?? []) as DoublonGroupe[];
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function annulerSessionImport(
  sessionId: string,
  motif?: string,
): Promise<Resultat<{ lignes_supprimees: number }>> {
  const garde = await exigerAccesImportSessions();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('annuler_session_import_v1', {
    p_session_id: sessionId,
    p_motif: motif ?? null,
  });

  if (error) return { status: 'erreur', message: error.message };
  if (data?.erreur) return { status: 'erreur', message: data.erreur };

  revalidatePath('/super-admin/import-sessions');
  revalidatePath('/accueil');
  return { status: 'succes', data: { lignes_supprimees: data.lignes_supprimees ?? 0 } };
}

export async function fusionnerDoublons(cle: string): Promise<Resultat<{ fusionnes: number }>> {
  const garde = await exigerAccesDoublons();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('fusionner_doublons_v1', { p_cle: cle });

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/doublons');
  return { status: 'succes', data: { fusionnes: data?.fusionnes ?? 0 } };
}

export async function fusionnerDoublonsBulk(): Promise<Resultat<{ nb_fusionnes: number }>> {
  const garde = await exigerAccesDoublons();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('fusionner_doublons_bulk_v1');

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/doublons');
  revalidatePath('/accueil');
  return { status: 'succes', data: { nb_fusionnes: data?.nb_fusionnes ?? 0 } };
}
