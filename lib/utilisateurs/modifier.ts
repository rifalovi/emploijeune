'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { modifierUtilisateurSchema } from '@/lib/schemas/utilisateur-modifier';

/**
 * Server Action — Modification d'un utilisateur (Étape 8 enrichie).
 *
 * Pipeline :
 *   1. Garde admin_scs
 *   2. Validation Zod
 *   3. Garde-fous métier :
 *      - Pas de modification de soi-même (rôle ou désactivation)
 *      - Pas de désactivation du dernier admin_scs (sécurité plateforme)
 *   4. UPDATE public.utilisateurs (audit AUTOMATIQUE via trigger
 *      `trg_utilisateurs_audit` qui écrit dans journaux_audit)
 *   5. Si actif=false : signOut user via auth.admin.signOut → la session
 *      active est invalidée immédiatement
 *   6. Si raison_changement fourni : enregistre dans journaux_audit (le
 *      diff JSONB du trigger contient déjà l'avant/après ; on ajoute
 *      la raison contextuelle dans une seconde ligne audit "raison")
 */

export type ModifierUtilisateurResult =
  | { status: 'succes'; champsModifies: string[] }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_auto_modification'; message: string }
  | { status: 'erreur_dernier_admin'; message: string }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_introuvable'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function modifierUtilisateur(raw: unknown): Promise<ModifierUtilisateurResult> {
  const utilisateurCourant = await getCurrentUtilisateur();
  if (!utilisateurCourant || utilisateurCourant.role !== 'admin_scs') {
    return {
      status: 'erreur_droits',
      message: 'Réservé aux administrateurs SCS.',
    };
  }

  const parse = modifierUtilisateurSchema.safeParse(raw);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      issues: parse.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const data = parse.data;

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  // Récupère l'utilisateur cible avec ses valeurs actuelles
  const { data: cible, error: cibleErr } = await supabase
    .from('utilisateurs')
    .select('id, user_id, nom_complet, role, organisation_id, actif')
    .eq('id', data.utilisateurId)
    .is('deleted_at', null)
    .maybeSingle();

  if (cibleErr || !cible) {
    return { status: 'erreur_introuvable', message: 'Utilisateur introuvable.' };
  }

  // Garde-fou : pas de modification de soi-même sur les champs sensibles
  const estLuiMeme = cible.user_id === utilisateurCourant.user_id;
  if (estLuiMeme) {
    if (data.role !== cible.role) {
      return {
        status: 'erreur_auto_modification',
        message:
          'Vous ne pouvez pas modifier votre propre rôle. Demandez à un autre administrateur SCS.',
      };
    }
    if (cible.actif && !data.actif) {
      return {
        status: 'erreur_auto_modification',
        message:
          'Vous ne pouvez pas vous désactiver vous-même. Demandez à un autre administrateur SCS.',
      };
    }
  }

  // Garde-fou : ne pas vider la liste des admin_scs actifs
  if (cible.role === 'admin_scs' && (data.role !== 'admin_scs' || !data.actif)) {
    const { count } = await supabase
      .from('utilisateurs')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin_scs')
      .eq('actif', true)
      .is('deleted_at', null);
    if ((count ?? 0) <= 1) {
      return {
        status: 'erreur_dernier_admin',
        message:
          'Impossible de retirer le dernier administrateur SCS actif. Créez d’abord un autre admin avant cette modification.',
      };
    }
  }

  // Détection des champs modifiés
  const champsModifies: string[] = [];
  if (cible.nom_complet !== data.nom_complet) champsModifies.push('nom_complet');
  if (cible.role !== data.role) champsModifies.push('role');
  if ((cible.organisation_id ?? null) !== (data.organisation_id ?? null))
    champsModifies.push('organisation_id');
  if (cible.actif !== data.actif) champsModifies.push('actif');

  if (champsModifies.length === 0) {
    return { status: 'succes', champsModifies: [] };
  }

  // UPDATE — le trigger trg_utilisateurs_audit écrit dans journaux_audit
  const { error: updError } = await supabase
    .from('utilisateurs')
    .update({
      nom_complet: data.nom_complet,
      role: data.role as 'admin_scs' | 'editeur_projet' | 'contributeur_partenaire' | 'lecteur',
      organisation_id: data.organisation_id ?? null,
      actif: data.actif,
    })
    .eq('id', cible.id);

  if (updError) {
    return {
      status: 'erreur_inconnue',
      message: `UPDATE échoué : ${updError.message}`,
    };
  }

  // Si raison contextuelle fournie : log additionnel dans journaux_audit
  if (data.raison_changement) {
    try {
      await adminClient.from('journaux_audit').insert({
        table_affectee: 'utilisateurs',
        ligne_id: cible.id,
        action: 'UPDATE',
        diff: {
          champs_modifies: champsModifies,
          raison_changement: data.raison_changement,
          modifie_par_admin: utilisateurCourant.user_id,
        } as never,
        user_id: utilisateurCourant.user_id,
      } as never);
    } catch {
      // Best-effort : l'audit principal est déjà fait par le trigger
    }
  }

  // Si désactivation : invalide la session active de l'utilisateur
  if (champsModifies.includes('actif') && !data.actif) {
    try {
      await adminClient.auth.admin.signOut(cible.user_id);
    } catch {
      // Best-effort
    }
  }

  revalidatePath('/admin/utilisateurs');
  revalidatePath(`/admin/utilisateurs/${cible.id}/modifier`);

  return { status: 'succes', champsModifies };
}
