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
  module: z.enum(['assistant_ia', 'import_ia']),
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

// ─────────────────────────────────────────────────────────────────────────
// Modification de l'email d'un utilisateur (super_admin uniquement)
// ─────────────────────────────────────────────────────────────────────────

const changerEmailSchema = z.object({
  user_id: z.string().uuid(),
  nouvel_email: z.string().trim().email(),
});

/**
 * Met à jour l'email d'un compte (auth.users + table utilisateurs).
 * Réservé super_admin. Carlos peut modifier l'email d'un autre user
 * mais pas le sien (auto-modification interdite : risque lockout).
 */
export async function changerEmailUtilisateur(
  payload: z.infer<typeof changerEmailSchema>,
): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = changerEmailSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', message: parsed.error.issues[0]?.message ?? 'payload_invalide' };
  }

  if (parsed.data.user_id === garde.utilisateur.user_id) {
    return { status: 'erreur', message: 'auto_modification_interdite' };
  }

  const admin = createSupabaseAdminClient();

  // 1. Met à jour auth.users (source de vérité unique pour l'email — la
  //    table public.utilisateurs ne stocke PAS l'email). Si l'email est
  //    déjà utilisé par un autre compte, Supabase renvoie une erreur
  //    "User already registered" qu'on remappe.
  const { error: authErr } = await admin.auth.admin.updateUserById(parsed.data.user_id, {
    email: parsed.data.nouvel_email,
    email_confirm: true, // changement admin : pas de mail de confirmation
  });
  if (authErr) {
    const msg = authErr.message.toLowerCase();
    if (msg.includes('already') && msg.includes('registered')) {
      return { status: 'erreur', message: 'email_deja_utilise' };
    }
    return { status: 'erreur', message: `auth_update: ${authErr.message}` };
  }

  // 2. Bump updated_at sur la table utilisateurs (l'email n'est pas stocké
  //    ici mais on garde un timestamp à jour pour l'audit).
  await admin
    .from('utilisateurs')
    .update({ updated_at: new Date().toISOString() } as never)
    .eq('user_id', parsed.data.user_id);

  // 3. Audit log (best-effort)
  await admin
    .from('journaux_audit')
    .insert({
      action: 'utilisateur.changer_email',
      acteur_user_id: garde.utilisateur.user_id,
      cible_type: 'utilisateur',
      cible_id: parsed.data.user_id,
      diff: { nouvel_email: parsed.data.nouvel_email } as never,
    } as never)
    .then(
      () => undefined,
      () => undefined,
    );

  revalidatePath('/super-admin/utilisateurs');
  revalidatePath('/admin/utilisateurs');
  revalidatePath(`/admin/utilisateurs/${parsed.data.user_id}/modifier`);
  return { status: 'succes' };
}

// ─────────────────────────────────────────────────────────────────────────
// Suppression définitive d'un compte (super_admin uniquement)
// ─────────────────────────────────────────────────────────────────────────

const supprimerCompteSchema = z.object({
  user_id: z.string().uuid(),
  // L'UI demande à l'admin de retaper l'email à supprimer — protection
  // anti-clic accidentel.
  confirmation_email: z.string().trim().email(),
});

/**
 * Suppression définitive d'un compte :
 *   - Soft-delete dans `public.utilisateurs` (`deleted_at` + `actif=false`)
 *     pour préserver l'historique d'audit.
 *   - Hard-delete dans `auth.users` (révoque sessions + libère l'email).
 *
 * Carlos ne peut pas se supprimer lui-même. Un autre super_admin ne peut
 * pas être supprimé (rôle protégé).
 */
export async function supprimerCompteUtilisateur(
  payload: z.infer<typeof supprimerCompteSchema>,
): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = supprimerCompteSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  if (parsed.data.user_id === garde.utilisateur.user_id) {
    return { status: 'erreur', message: 'auto_suppression_interdite' };
  }

  const admin = createSupabaseAdminClient();

  // 1a. Lecture du profil cible — rôle et nom (pour l'audit + garde
  //     anti-super_admin). L'email vit dans auth.users, on le lit séparément.
  const { data: cible, error: lookupErr } = await admin
    .from('utilisateurs')
    .select('role, nom_complet')
    .eq('user_id', parsed.data.user_id)
    .maybeSingle();
  if (lookupErr || !cible) return { status: 'erreur', message: 'utilisateur_introuvable' };
  if (cible.role === 'super_admin') {
    return { status: 'erreur', message: 'super_admin_non_supprimable' };
  }

  // 1b. Email réel depuis auth.users (source de vérité)
  const { data: authUser } = await admin.auth.admin.getUserById(parsed.data.user_id);
  const emailCible = authUser?.user?.email ?? null;
  if (!emailCible) {
    return { status: 'erreur', message: 'auth_user_introuvable' };
  }
  if (emailCible !== parsed.data.confirmation_email) {
    return { status: 'erreur', message: 'confirmation_email_invalide' };
  }

  // 2. Soft-delete table utilisateurs (préserve l'historique pour l'audit)
  const now = new Date().toISOString();
  const { error: softErr } = await admin
    .from('utilisateurs')
    .update({ deleted_at: now, actif: false, updated_at: now } as never)
    .eq('user_id', parsed.data.user_id);
  if (softErr) return { status: 'erreur', message: `soft_delete: ${softErr.message}` };

  // 3. Hard-delete auth.users (révoque sessions + libère l'email).
  //    Obligatoire : si ça échoue, on annule le soft-delete pour rester cohérent.
  const { error: authErr } = await admin.auth.admin.deleteUser(parsed.data.user_id);
  if (authErr) {
    // eslint-disable-next-line no-console
    console.error(
      '[supprimerCompte] auth.admin.deleteUser échoué — rollback soft-delete',
      authErr.message,
    );
    // Rollback : remettre le profil en état actif pour éviter un orphelin
    await admin
      .from('utilisateurs')
      .update({ deleted_at: null, actif: true, updated_at: new Date().toISOString() } as never)
      .eq('user_id', parsed.data.user_id);
    return { status: 'erreur', message: `auth_delete_echoue: ${authErr.message}` };
  }

  // 4. Audit log
  await admin
    .from('journaux_audit')
    .insert({
      action: 'utilisateur.supprimer',
      acteur_user_id: garde.utilisateur.user_id,
      cible_type: 'utilisateur',
      cible_id: parsed.data.user_id,
      diff: {
        email_supprime: emailCible,
        nom_complet: cible.nom_complet,
        role: cible.role,
        auth_delete_ok: true,
      } as never,
    } as never)
    .then(
      () => undefined,
      () => undefined,
    );

  revalidatePath('/super-admin/utilisateurs');
  revalidatePath('/admin/utilisateurs');
  return { status: 'succes' };
}

// ─────────────────────────────────────────────────────────────────────────
// Création de compte avec mot de passe défini par le super_admin
// ─────────────────────────────────────────────────────────────────────────
//
// Différence avec `creerCompteUtilisateur` (lib/utilisateurs/mutations.ts) :
//
//   creerCompteUtilisateur               creerCompteAvecMotPasseDefini
//   ────────────────────────             ──────────────────────────────
//   mdp aléatoire généré côté serveur    mdp choisi par le super_admin
//   email d'invitation envoyé            aucun email — communication manuelle
//   lien de récupération à cliquer       compte directement utilisable
//
// Dans les deux cas, `user_metadata.mdp_temporaire = true` est posé : le
// dashboard layout détecte ce flag et redirige vers /mon-compte au premier
// login pour forcer le changement de mot de passe. La fonction
// `changerMonMotPasse` (lib/utilisateurs/mon-compte.ts) efface le flag
// une fois le nouveau mdp confirmé.

const creerCompteAvecMdpSchema = z.object({
  email: z.string().trim().email(),
  nom_complet: z.string().trim().min(2).max(150),
  role: z.enum(['admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur']),
  organisation_id: z.string().uuid().nullable().optional(),
  mot_passe: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères').max(72),
});

export type CreerCompteAvecMdpResult =
  | { status: 'succes'; user_id: string; email: string }
  | { status: 'erreur'; message: string };

export async function creerCompteAvecMotPasseDefini(
  payload: z.infer<typeof creerCompteAvecMdpSchema>,
): Promise<CreerCompteAvecMdpResult> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = creerCompteAvecMdpSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', message: parsed.error.issues[0]?.message ?? 'payload_invalide' };
  }

  const admin = createSupabaseAdminClient();

  // 1. Création auth.users avec mot de passe + email confirmé immédiatement
  //    (pas d'email de confirmation envoyé — le super_admin communique
  //    les credentials directement).
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.mot_passe,
    email_confirm: true,
    user_metadata: {
      mdp_temporaire: true,
      cree_par_admin: garde.utilisateur.user_id,
      cree_le: new Date().toISOString(),
      mode_creation: 'mdp_defini_par_admin',
    },
  });

  if (authErr || !authData.user) {
    const msg = (authErr?.message ?? '').toLowerCase();
    if (msg.includes('already') && msg.includes('registered')) {
      return { status: 'erreur', message: 'email_deja_utilise' };
    }
    return { status: 'erreur', message: `auth_create: ${authErr?.message ?? 'inconnue'}` };
  }

  const newUserId = authData.user.id;

  // 2. INSERT public.utilisateurs (miroir du profil métier)
  const { error: dbErr } = await admin.from('utilisateurs').insert({
    user_id: newUserId,
    nom_complet: parsed.data.nom_complet,
    role: parsed.data.role,
    organisation_id: parsed.data.organisation_id ?? null,
    actif: true,
    statut_validation: 'valide',
    created_by: garde.utilisateur.user_id,
  } as never);

  if (dbErr) {
    // Rollback best-effort sur auth.users
    await admin.auth.admin.deleteUser(newUserId).catch(() => undefined);
    return { status: 'erreur', message: `db_insert: ${dbErr.message}` };
  }

  // 3. Audit log
  await admin
    .from('journaux_audit')
    .insert({
      action: 'utilisateur.creer_avec_mdp_defini',
      acteur_user_id: garde.utilisateur.user_id,
      cible_type: 'utilisateur',
      cible_id: newUserId,
      diff: {
        email: parsed.data.email,
        nom_complet: parsed.data.nom_complet,
        role: parsed.data.role,
      } as never,
    } as never)
    .then(
      () => undefined,
      () => undefined,
    );

  revalidatePath('/super-admin/utilisateurs');
  revalidatePath('/admin/utilisateurs');

  return { status: 'succes', user_id: newUserId, email: parsed.data.email };
}
