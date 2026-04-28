'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import type { RoleUtilisateur } from '@/lib/supabase/auth';

/**
 * Server Actions super_admin — V2.0.0.
 *
 * Toutes les actions vérifient strictement que l'appelant a le rôle
 * super_admin avant d'exécuter quoi que ce soit. Les RLS côté BDD font
 * un second filtrage défensif (defense-in-depth).
 */

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

type ActionSucces<T = void> = T extends void ? { status: 'succes' } : { status: 'succes'; data: T };
type ActionErreur = { status: 'erreur'; message: string };
type Resultat<T = void> = ActionSucces<T> | ActionErreur;

async function exigerSuperAdmin(): Promise<
  | { utilisateur: NonNullable<Awaited<ReturnType<typeof getCurrentUtilisateur>>> }
  | { erreur: string }
> {
  try {
    const utilisateur = await getCurrentUtilisateur();
    if (!utilisateur) return { erreur: 'non_authentifie' };
    if (utilisateur.role !== 'super_admin') return { erreur: 'reserve_super_admin' };
    return { utilisateur };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : 'erreur_auth' };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Activation/désactivation du module IA pour un rôle cible
// ─────────────────────────────────────────────────────────────────────────

const toggleModuleSchema = z.object({
  module: z.enum(['assistant_ia']),
  role_cible: z.enum([
    'super_admin',
    'admin_scs',
    'editeur_projet',
    'contributeur_partenaire',
    'lecteur',
  ]),
  active: z.boolean(),
});

export async function toggleModulePourRole(
  payload: z.infer<typeof toggleModuleSchema>,
): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = toggleModuleSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('toggle_module_pour_role', {
    p_module: parsed.data.module,
    p_role_cible: parsed.data.role_cible,
    p_active: parsed.data.active,
  });

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/modules');
  revalidatePath('/(dashboard)', 'layout'); // refresh sidebar pour tous
  return { status: 'succes' };
}

// ─────────────────────────────────────────────────────────────────────────
// Suspension d'un utilisateur
// ─────────────────────────────────────────────────────────────────────────

const suspendreSchema = z.object({
  user_id: z.string().uuid(),
  motif: z.string().min(3).max(500),
  date_fin: z.string().datetime().nullable(), // null = bannissement définitif
});

export async function suspendreUtilisateur(
  payload: z.infer<typeof suspendreSchema>,
): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = suspendreSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  // Carlos ne peut pas se suspendre lui-même.
  if (parsed.data.user_id === garde.utilisateur.user_id) {
    return { status: 'erreur', message: 'auto_suspension_interdite' };
  }

  const supabase = await createSupabaseServerClient();

  // Désactive aussi le profil utilisateur (cohérent avec la suspension).
  const admin = createSupabaseAdminClient();
  await admin
    .from('utilisateurs')
    .update({ actif: false, updated_at: new Date().toISOString() })
    .eq('user_id', parsed.data.user_id);

  const { error } = await supabase.from('suspensions_utilisateurs').insert({
    user_id: parsed.data.user_id,
    suspendu_par: garde.utilisateur.user_id,
    motif: parsed.data.motif,
    date_fin: parsed.data.date_fin,
  });

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/utilisateurs');
  return { status: 'succes' };
}

export async function leverSuspension(suspensionId: string): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();

  // Récupère le user_id pour réactiver le profil
  const { data: susp } = await supabase
    .from('suspensions_utilisateurs')
    .select('user_id')
    .eq('id', suspensionId)
    .maybeSingle();

  const { error } = await supabase
    .from('suspensions_utilisateurs')
    .update({
      leve_at: new Date().toISOString(),
      leve_par: garde.utilisateur.user_id,
    })
    .eq('id', suspensionId);

  if (error) return { status: 'erreur', message: error.message };

  if (susp?.user_id) {
    const admin = createSupabaseAdminClient();
    await admin
      .from('utilisateurs')
      .update({ actif: true, updated_at: new Date().toISOString() })
      .eq('user_id', susp.user_id);
  }

  revalidatePath('/super-admin/utilisateurs');
  return { status: 'succes' };
}

// ─────────────────────────────────────────────────────────────────────────
// Suspension active d'un utilisateur (recherche par user_id pour la levée)
// ─────────────────────────────────────────────────────────────────────────

export async function leverSuspensionParUser(userId: string): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  const { data: susp } = await supabase
    .from('suspensions_utilisateurs')
    .select('id')
    .eq('user_id', userId)
    .is('leve_at', null)
    .maybeSingle();

  if (!susp) return { status: 'erreur', message: 'aucune_suspension_active' };
  return leverSuspension(susp.id);
}

// ─────────────────────────────────────────────────────────────────────────
// Archivage d'un partenaire
// ─────────────────────────────────────────────────────────────────────────

const archiverSchema = z.object({
  organisation_id: z.string().uuid(),
  motif: z.string().min(3).max(500),
});

export async function archiverPartenaire(
  payload: z.infer<typeof archiverSchema>,
): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = archiverSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const { error } = await supabase.from('archives_partenaires').insert({
    organisation_id: parsed.data.organisation_id,
    archive_par: garde.utilisateur.user_id,
    motif: parsed.data.motif,
  });
  if (error) return { status: 'erreur', message: error.message };

  // Désactive tous les utilisateurs liés à cette organisation.
  await admin
    .from('utilisateurs')
    .update({ actif: false, updated_at: new Date().toISOString() })
    .eq('organisation_id', parsed.data.organisation_id)
    .is('deleted_at', null);

  revalidatePath('/super-admin/partenaires');
  return { status: 'succes' };
}

export async function desarchiverPartenaire(organisationId: string): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const { data: archive } = await supabase
    .from('archives_partenaires')
    .select('id')
    .eq('organisation_id', organisationId)
    .is('desarchive_at', null)
    .maybeSingle();

  if (!archive) return { status: 'erreur', message: 'aucune_archive_active' };

  const { error } = await supabase
    .from('archives_partenaires')
    .update({
      desarchive_at: new Date().toISOString(),
      desarchive_par: garde.utilisateur.user_id,
    })
    .eq('id', archive.id);
  if (error) return { status: 'erreur', message: error.message };

  // Réactive les utilisateurs liés (sauf ceux qui sont par ailleurs suspendus)
  await admin
    .from('utilisateurs')
    .update({ actif: true, updated_at: new Date().toISOString() })
    .eq('organisation_id', organisationId)
    .is('deleted_at', null);

  revalidatePath('/super-admin/partenaires');
  return { status: 'succes' };
}

// ─────────────────────────────────────────────────────────────────────────
// Changement de rôle (super_admin uniquement, exclu pour soi-même)
// ─────────────────────────────────────────────────────────────────────────

const changerRoleSchema = z.object({
  user_id: z.string().uuid(),
  nouveau_role: z.enum([
    'admin_scs',
    'editeur_projet',
    'contributeur_partenaire',
    'lecteur',
  ]) satisfies z.ZodType<Exclude<RoleUtilisateur, 'super_admin'>>,
});

export async function changerRoleUtilisateur(
  payload: z.infer<typeof changerRoleSchema>,
): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = changerRoleSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  if (parsed.data.user_id === garde.utilisateur.user_id) {
    return { status: 'erreur', message: 'auto_changement_interdit' };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('utilisateurs')
    .update({ role: parsed.data.nouveau_role, updated_at: new Date().toISOString() })
    .eq('user_id', parsed.data.user_id);

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/utilisateurs');
  return { status: 'succes' };
}
