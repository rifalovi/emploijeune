'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { creerCompteUtilisateurSchema } from '@/lib/schemas/utilisateur';
import { envoyerEmail } from '@/lib/email/envoyer';
import { templateInvitationCompte, templateResetMotPasse } from '@/lib/email/templates';
import { ROLE_CREABLE_LIBELLES } from '@/lib/schemas/utilisateur';

export type CreerCompteResult =
  | {
      status: 'succes';
      userId: string;
      email: string;
      lienActivation: string;
      emailEnvoi: 'envoye' | 'mock';
    }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_doublon_email'; message: string }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_inconnue'; message: string };

/**
 * Crée un compte utilisateur (admin_scs uniquement).
 *
 * Pipeline :
 *   1. Garde-fou rôle admin_scs.
 *   2. Validation Zod du payload.
 *   3. Création Auth user via service_role avec mot de passe temporaire
 *      aléatoire (32 chars hex) + user_metadata.mdp_temporaire = true +
 *      email_confirm = true (Supabase ne re-demande pas confirmation).
 *   4. INSERT dans public.utilisateurs avec rôle, organisation/projets,
 *      statut_validation = 'valide' (créé par admin → pas de file d'attente).
 *   5. Génération d'un lien de récupération (type 'recovery') qui forcera
 *      l'utilisateur à définir son vrai mot de passe.
 *   6. Envoi de l'email d'invitation (via envoyerEmail — MOCK V1, Resend V1.5).
 *
 * En cas d'échec en étape 4-6, on tente de rollback l'Auth user créé en 3
 * pour éviter les comptes orphelins (best-effort).
 */
export async function creerCompteUtilisateur(raw: unknown): Promise<CreerCompteResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin')) {
    return {
      status: 'erreur_droits',
      message: 'Seul un administrateur SCS peut créer un compte.',
    };
  }

  const parse = creerCompteUtilisateurSchema.safeParse(raw);
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

  const adminClient = createSupabaseAdminClient();

  // Mot de passe temporaire fort (32 chars hex = 128 bits entropie)
  const mdpTemporaire = randomBytes(16).toString('hex');

  // Étape 3 : créer l'utilisateur Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: mdpTemporaire,
    email_confirm: true,
    user_metadata: {
      mdp_temporaire: true,
      cree_par_admin: utilisateur.user_id,
      cree_le: new Date().toISOString(),
    },
  });

  if (authError || !authData.user) {
    if (authError?.message?.toLowerCase().includes('already')) {
      return {
        status: 'erreur_doublon_email',
        message: 'Un compte existe déjà avec cette adresse email.',
      };
    }
    return {
      status: 'erreur_inconnue',
      message: `Création Auth échouée : ${authError?.message ?? 'erreur inconnue'}`,
    };
  }

  const newUserId = authData.user.id;

  // Étape 4 : INSERT public.utilisateurs
  const supabaseUser = await createSupabaseServerClient();
  const nomComplet = `${data.prenom} ${data.nom}`.trim();

  const { error: insertError } = await supabaseUser.from('utilisateurs').insert({
    user_id: newUserId,
    nom_complet: nomComplet,
    role: data.role as 'editeur_projet' | 'contributeur_partenaire' | 'lecteur',
    organisation_id: data.organisation_id ?? null,
    actif: true,
    statut_validation: 'valide',
    created_by: utilisateur.user_id,
  });

  if (insertError) {
    // Rollback best-effort
    await adminClient.auth.admin.deleteUser(newUserId).catch(() => {});
    return {
      status: 'erreur_inconnue',
      message: `Insertion utilisateur échouée : ${insertError.message}`,
    };
  }

  // Étape 5 : génère un lien de récupération (force changement mdp au login)
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectTo = `${origin}/api/auth/callback?redirect=${encodeURIComponent('/motpasse/changer?premier_login=1')}`;

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: data.email,
    options: { redirectTo },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return {
      status: 'erreur_inconnue',
      message: `Génération lien activation échouée : ${linkError?.message ?? 'erreur'}`,
    };
  }

  const lienActivation = linkData.properties.action_link;

  // Étape 6 : email d'invitation (template centralisé Étape 6.5d)
  const roleLibelle =
    ROLE_CREABLE_LIBELLES[data.role as keyof typeof ROLE_CREABLE_LIBELLES] ?? data.role;
  const tpl = templateInvitationCompte({
    prenom: data.prenom,
    roleLibelle,
    lienActivation,
  });
  const envoi = await envoyerEmail({
    to: data.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });

  revalidatePath('/admin/utilisateurs');

  return {
    status: 'succes',
    userId: newUserId,
    email: data.email,
    lienActivation,
    emailEnvoi: envoi.status === 'envoye' ? 'envoye' : 'mock',
  };
}

// =============================================================================
// Désactivation / réactivation (admin_scs)
// =============================================================================

export type ToggleCompteActifResult =
  | { status: 'succes'; actif: boolean }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function toggleCompteActif(
  utilisateurId: string,
  actif: boolean,
): Promise<ToggleCompteActifResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin')) {
    return { status: 'erreur_droits', message: 'Réservé aux administrateurs SCS.' };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('utilisateurs').update({ actif }).eq('id', utilisateurId);
  if (error) return { status: 'erreur_inconnue', message: error.message };
  revalidatePath('/admin/utilisateurs');
  return { status: 'succes', actif };
}

// =============================================================================
// Réinitialisation du mot de passe (admin_scs envoie un nouveau lien)
// =============================================================================

export type ReinitMdpResult =
  | { status: 'succes'; lienActivation: string; emailEnvoi: 'envoye' | 'mock' }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function reinitialiserMotPasseUtilisateur(
  utilisateurId: string,
): Promise<ReinitMdpResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin')) {
    return { status: 'erreur_droits', message: 'Réservé aux administrateurs SCS.' };
  }
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: u } = await supabase
    .from('utilisateurs')
    .select('user_id, nom_complet')
    .eq('id', utilisateurId)
    .maybeSingle();
  if (!u) return { status: 'erreur_inconnue', message: 'Utilisateur introuvable' };

  const { data: authUser } = await adminClient.auth.admin.getUserById(u.user_id);
  const email = authUser?.user?.email;
  if (!email) return { status: 'erreur_inconnue', message: 'Email introuvable côté Auth' };

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectTo = `${origin}/api/auth/callback?redirect=${encodeURIComponent('/motpasse/changer?reset=1')}`;

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });
  if (linkError || !linkData?.properties?.action_link) {
    return { status: 'erreur_inconnue', message: linkError?.message ?? 'Génération lien KO' };
  }
  const lienActivation = linkData.properties.action_link;

  const tplReset = templateResetMotPasse({
    prenom: u.nom_complet.split(' ')[0] ?? '',
    lienReset: lienActivation,
  });
  const envoi = await envoyerEmail({
    to: email,
    subject: tplReset.subject,
    html: tplReset.html,
    text: tplReset.text,
  });

  return {
    status: 'succes',
    lienActivation,
    emailEnvoi: envoi.status === 'envoye' ? 'envoye' : 'mock',
  };
}
