'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { envoyerEmail } from '@/lib/email/envoyer';
import { templateResetMotPasse } from '@/lib/email/templates';
import { demanderResetSchema, type DemanderResetInput } from '@/lib/schemas/auth';

/**
 * Server Action — Envoi d'un lien de réinitialisation de mot de passe.
 *
 * Refacto hotfix 6.5h-quinquies : remplace l'appel client
 * `supabase.auth.resetPasswordForEmail` qui utilisait les templates
 * Supabase par défaut (anglais, sans branding OIF). On passe désormais
 * par `admin.generateLink({type: 'recovery'})` côté serveur (sans envoi
 * automatique), puis on envoie via Resend avec `templateResetMotPasse`
 * (centralisé dans lib/email/templates).
 *
 * Sécurité : politique « ne pas révéler l'existence du compte » — toujours
 * succès apparent même si email inconnu.
 */

export type EnvoyerResetMotPasseResult =
  | { status: 'succes' }
  | { status: 'erreur_validation'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function envoyerResetMotPasse(
  input: DemanderResetInput,
): Promise<EnvoyerResetMotPasseResult> {
  const parse = demanderResetSchema.safeParse(input);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      message: parse.error.issues[0]?.message ?? 'Adresse email invalide',
    };
  }
  const { email } = parse.data;

  const adminClient = createSupabaseAdminClient();

  // 1. Vérifie l'existence du compte via auth.admin (pas de fuite info)
  const { data: authList } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const authUser = authList?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!authUser?.email) {
    // Compte inexistant — succès simulé.
    return { status: 'succes' };
  }

  // Récupère le prénom pour personnaliser le template (ne jamais bloquer si absent)
  const { data: utilisateurRow } = await adminClient
    .from('utilisateurs')
    .select('nom_complet')
    .eq('user_id', authUser.id)
    .is('deleted_at', null)
    .maybeSingle();
  const prenom = utilisateurRow?.nom_complet.split(' ')[0];

  // 2. Génère le lien de récupération (pas d'envoi auto Supabase)
  //
  // Hotfix v2.0.1.2 : on n'utilise PLUS `action_link` directement.
  // Pourquoi : `action_link` pointe sur l'endpoint Supabase /auth/v1/verify
  // qui, après vérification, redirige avec un HASH FRAGMENT
  // (`#access_token=…&refresh_token=…`). Le hash n'est JAMAIS envoyé au
  // serveur, donc notre callback `/api/auth/callback` reçoit la requête
  // sans aucun paramètre d'auth → rejet en « lien_invalide ».
  //
  // Solution : on contourne /auth/v1/verify et on pointe le lien directement
  // sur notre callback avec `token_hash` + `type=recovery` en query string.
  // Le callback appelle alors `verifyOtp({type, token_hash})` côté serveur,
  // ce qui pose le cookie de session et permet la redirection server-side
  // vers /motpasse/changer.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectInterne = '/motpasse/changer?reset=1';
  const redirectTo = `${origin}/api/auth/callback?redirect=${encodeURIComponent(redirectInterne)}`;

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: authUser.email,
    options: { redirectTo },
  });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    return {
      status: 'erreur_inconnue',
      message: `Génération du lien de réinitialisation : ${linkError?.message ?? 'hashed_token manquant'}`,
    };
  }

  // Construction du lien à usage unique pointant vers NOTRE callback,
  // avec token_hash et type en query string (pas en hash fragment).
  const lienReset =
    `${origin}/api/auth/callback` +
    `?token_hash=${encodeURIComponent(hashedToken)}` +
    `&type=recovery` +
    `&redirect=${encodeURIComponent(redirectInterne)}`;

  // 3. Envoie via Resend avec notre template OIF
  const tpl = templateResetMotPasse({
    prenom,
    lienReset,
  });

  const envoi = await envoyerEmail({
    to: authUser.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });

  if (envoi.status === 'erreur') {
    return { status: 'erreur_inconnue', message: envoi.message };
  }

  return { status: 'succes' };
}
