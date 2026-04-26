'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { creerCompteUtilisateurSchema } from '@/lib/schemas/utilisateur';
import { envoyerEmail } from '@/lib/email/envoyer';

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
  if (!utilisateur || utilisateur.role !== 'admin_scs') {
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

  // Étape 6 : email d'invitation (MOCK V1 → Resend V1.5)
  const html = construireHtmlInvitation({
    prenom: data.prenom,
    lienActivation,
    rolelibelle: data.role,
  });

  const envoi = await envoyerEmail({
    to: data.email,
    subject: 'Activation de votre compte — Plateforme OIF Emploi Jeunes',
    html,
    text: `Bonjour ${data.prenom},\n\nVotre compte sur la plateforme OIF Emploi Jeunes a été créé. Activez-le en cliquant sur ce lien (valable 24 h) :\n\n${lienActivation}\n\nCordialement,\nLe SCS — Service de Conception et Suivi de projet`,
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
  if (!utilisateur || utilisateur.role !== 'admin_scs') {
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
  if (!utilisateur || utilisateur.role !== 'admin_scs') {
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

  const envoi = await envoyerEmail({
    to: email,
    subject: 'Réinitialisation de votre mot de passe — Plateforme OIF Emploi Jeunes',
    html: construireHtmlReset({ prenom: u.nom_complet.split(' ')[0] ?? '', lienActivation }),
    text: `Bonjour,\n\nUn lien de réinitialisation de votre mot de passe a été demandé. Cliquez ici (valable 1 h) :\n\n${lienActivation}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
  });

  return {
    status: 'succes',
    lienActivation,
    emailEnvoi: envoi.status === 'envoye' ? 'envoye' : 'mock',
  };
}

// =============================================================================
// Templates HTML simples (à enrichir branding OIF en V1.5-D)
// =============================================================================

function construireHtmlInvitation(args: {
  prenom: string;
  lienActivation: string;
  rolelibelle: string;
}): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">Bienvenue sur la plateforme OIF Emploi Jeunes</h1>
      <p>Bonjour <strong>${escapeHtml(args.prenom)}</strong>,</p>
      <p>Le Service de Conception et Suivi de projet vient de créer un compte à votre nom sur la plateforme OIF Emploi Jeunes. Votre rôle : <strong>${escapeHtml(args.rolelibelle)}</strong>.</p>
      <p>Pour activer votre compte et choisir votre mot de passe, cliquez sur le lien ci-dessous (valable 24 h) :</p>
      <p style="margin: 24px 0;">
        <a href="${args.lienActivation}" style="display: inline-block; background: #1f6feb; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Activer mon compte
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">Si le bouton ne fonctionne pas, copiez-collez cette URL :<br><code style="word-break: break-all;">${args.lienActivation}</code></p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="color: #6b7280; font-size: 12px;">Si vous pensez avoir reçu cet email par erreur, ignorez-le et contactez le SCS.</p>
    </div>
  `.trim();
}

function construireHtmlReset(args: { prenom: string; lienActivation: string }): string {
  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">Réinitialisation de votre mot de passe</h1>
      <p>Bonjour ${args.prenom ? `<strong>${escapeHtml(args.prenom)}</strong>` : ''},</p>
      <p>Un lien de réinitialisation de votre mot de passe a été demandé. Cliquez ci-dessous (valable 1 h) :</p>
      <p style="margin: 24px 0;">
        <a href="${args.lienActivation}" style="display: inline-block; background: #1f6feb; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
    </div>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
