'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import {
  buildViewAsExpiresAt,
  chargerProfilCible,
  clearViewAsCookie,
  getViewAsContext,
  setViewAsCookie,
} from './view-as';

/**
 * Server Actions du mode view-as (admin SCS uniquement).
 *
 * IMPORTANT : ce fichier ne doit exporter QUE des fonctions async (Next 14
 * 'use server'). Les types/helpers vivent dans `lib/auth/view-as.ts`.
 */

export type AssumerVueResult =
  | { status: 'succes'; targetNomComplet: string; expiresAt: number }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_introuvable'; message: string }
  | { status: 'erreur_auto'; message: string }
  | { status: 'deja_actif'; message: string };

export type SortirVueResult = { status: 'succes' } | { status: 'pas_actif' };

async function loggerAudit(
  action: 'VIEW_AS_START' | 'VIEW_AS_END',
  adminUserId: string,
  targetUserId: string,
  diff: Record<string, unknown> = {},
): Promise<void> {
  const admin = createSupabaseAdminClient();
  try {
    await admin.from('journaux_audit').insert({
      table_affectee: 'utilisateurs',
      ligne_id: null,
      action,
      diff: { admin_user_id: adminUserId, target_user_id: targetUserId, ...diff } as never,
      user_id: adminUserId,
    } as never);
  } catch {
    // Best-effort — on ne bloque pas l'action sur l'échec d'audit
  }
}

/**
 * Active le mode view-as : pose un cookie scellé pour 30 min.
 */
export async function assumerVueUtilisateur(targetUserId: string): Promise<AssumerVueResult> {
  const courant = await getCurrentUtilisateur();
  if (!courant || (courant.role !== 'admin_scs' && courant.role !== 'super_admin')) {
    return { status: 'erreur_droits', message: 'Réservé aux administrateurs SCS.' };
  }
  if (!targetUserId || !/^[0-9a-fA-F-]{36}$/.test(targetUserId)) {
    return { status: 'erreur_introuvable', message: 'Identifiant cible invalide.' };
  }
  if (targetUserId === courant.user_id) {
    return {
      status: 'erreur_auto',
      message: 'Vous ne pouvez pas activer le mode visualisation sur vous-même.',
    };
  }

  const dejaActif = await getViewAsContext();
  if (dejaActif) {
    return {
      status: 'deja_actif',
      message:
        'Un mode visualisation est déjà actif. Cliquez d\u2019abord sur « Revenir à mon admin ».',
    };
  }

  const cible = await chargerProfilCible(targetUserId);
  if (!cible) {
    return {
      status: 'erreur_introuvable',
      message: 'Utilisateur cible introuvable ou inactif.',
    };
  }

  const expiresAt = buildViewAsExpiresAt();
  await setViewAsCookie({
    adminUserId: courant.user_id,
    targetUserId,
    expiresAt,
  });

  await loggerAudit('VIEW_AS_START', courant.user_id, targetUserId, {
    target_role: cible.role,
    target_nom_complet: cible.nom_complet,
    expires_at: new Date(expiresAt).toISOString(),
  });

  revalidatePath('/', 'layout');
  return { status: 'succes', targetNomComplet: cible.nom_complet, expiresAt };
}

/**
 * Désactive le mode view-as : supprime le cookie + audit.
 */
export async function sortirVueUtilisateur(): Promise<SortirVueResult> {
  const ctx = await getViewAsContext();
  if (!ctx) return { status: 'pas_actif' };

  await clearViewAsCookie();
  await loggerAudit('VIEW_AS_END', ctx.adminUserId, ctx.targetUserId, {
    motif: 'sortie_volontaire',
  });

  revalidatePath('/', 'layout');
  return { status: 'succes' };
}
