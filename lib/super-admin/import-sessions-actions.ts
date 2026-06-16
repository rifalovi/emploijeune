'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
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

/** Groupe de doublons de structures (B1) : même nom + pays + projet. */
export type DoublonGroupeStructure = {
  cle_identite: string;
  occurrences: number;
  structure_ids: string[];
  dates_creation: string[];
};

/** Détail d'une fiche bénéficiaire dans un groupe de doublons. */
export type OccurrenceBeneficiaire = {
  id: string;
  prenom: string | null;
  nom: string | null;
  sexe: string | null;
  projet_code: string | null;
  pays_code: string | null;
  courriel: string | null;
  telephone: string | null;
  created_at: string;
};

/** Détail d'une fiche structure dans un groupe de doublons. */
export type OccurrenceStructure = {
  id: string;
  nom_structure: string | null;
  pays_code: string | null;
  projet_code: string | null;
  porteur_nom: string | null;
  courriel_porteur: string | null;
  telephone_porteur: string | null;
  annee_appui: number | null;
  created_at: string;
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

/**
 * Annule une fusion : restaure (deleted_at = NULL) les bénéficiaires soft-supprimés
 * d'un groupe d'identité donné. Permet de revenir en arrière après un clic sur
 * « Fusionner ».
 */
export async function restaurerFusionBeneficiaires(
  cle: string,
): Promise<Resultat<{ restaurees: number }>> {
  const garde = await exigerAccesDoublons();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };
  const admin = createSupabaseAdminClient();
  // `cle_identite` n'est pas dans les types générés (colonne ajoutée hors
  // migrations) → cast pour la clause .eq().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('beneficiaires') as any)
    .update({ deleted_at: null, deleted_by: null })
    .eq('cle_identite', cle)
    .not('deleted_at', 'is', null)
    .select('id');
  if (error) return { status: 'erreur', message: error.message };
  revalidatePath('/super-admin/doublons');
  revalidatePath('/beneficiaires');
  revalidatePath('/dashboard');
  return { status: 'succes', data: { restaurees: Array.isArray(data) ? data.length : 0 } };
}

// ── Doublons STRUCTURES (B1) ──────────────────────────────────────────────────

/** Normalise un nom de structure pour la clé de regroupement (≈ unaccent+lower). */
function cleNomStructureGroupe(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Détecte les groupes de doublons de structures : même (nom + pays + projet).
 * Regroupement côté serveur (volumétrie B1 modérée).
 */
export async function detecterDoublonsStructures(): Promise<DoublonGroupeStructure[]> {
  const garde = await exigerAccesDoublons();
  if ('erreur' in garde) return [];

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('structures')
    .select('id, nom_structure, pays_code, projet_code, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(20000);

  const rows = (data ?? []) as Array<{
    id: string;
    nom_structure: string | null;
    pays_code: string | null;
    projet_code: string | null;
    created_at: string;
  }>;

  const groupes = new Map<string, DoublonGroupeStructure>();
  for (const r of rows) {
    const cleNorm = `${cleNomStructureGroupe(String(r.nom_structure ?? ''))}|${r.pays_code}|${r.projet_code}`;
    const libelle = `${r.nom_structure ?? '—'} | ${r.pays_code ?? '—'} | ${r.projet_code ?? '—'}`;
    const g = groupes.get(cleNorm);
    if (g) {
      g.occurrences += 1;
      g.structure_ids.push(r.id);
      g.dates_creation.push(r.created_at);
    } else {
      groupes.set(cleNorm, {
        cle_identite: libelle,
        occurrences: 1,
        structure_ids: [r.id],
        dates_creation: [r.created_at],
      });
    }
  }

  return [...groupes.values()]
    .filter((g) => g.occurrences > 1)
    .sort((a, b) => b.occurrences - a.occurrences);
}

// ── Occurrences détaillées d'un groupe (pour le modal) ────────────────────────

export async function listerOccurrencesBeneficiaires(
  ids: string[],
): Promise<OccurrenceBeneficiaire[]> {
  const garde = await exigerAccesDoublons();
  if ('erreur' in garde || ids.length === 0) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('beneficiaires')
    .select('id, prenom, nom, sexe, projet_code, pays_code, courriel, telephone, created_at')
    .in('id', ids)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  return (data ?? []) as OccurrenceBeneficiaire[];
}

export async function listerOccurrencesStructures(ids: string[]): Promise<OccurrenceStructure[]> {
  const garde = await exigerAccesDoublons();
  if ('erreur' in garde || ids.length === 0) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('structures')
    .select(
      'id, nom_structure, pays_code, projet_code, porteur_nom, courriel_porteur, telephone_porteur, annee_appui, created_at',
    )
    .in('id', ids)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  return (data ?? []) as OccurrenceStructure[];
}

// ── Suppression manuelle (soft-delete) d'une fiche ────────────────────────────

export async function supprimerBeneficiaire(id: string): Promise<Resultat> {
  const garde = await exigerAccesDoublons();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('beneficiaires')
    .update({ deleted_at: new Date().toISOString(), deleted_by: garde.utilisateur.user_id })
    .eq('id', id)
    .is('deleted_at', null);
  if (error) return { status: 'erreur', message: error.message };
  revalidatePath('/super-admin/doublons');
  revalidatePath('/beneficiaires');
  revalidatePath('/dashboard');
  return { status: 'succes' };
}

export async function supprimerStructure(id: string): Promise<Resultat> {
  const garde = await exigerAccesDoublons();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('structures')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);
  if (error) return { status: 'erreur', message: error.message };
  revalidatePath('/super-admin/doublons');
  revalidatePath('/structures');
  revalidatePath('/dashboard');
  return { status: 'succes' };
}
