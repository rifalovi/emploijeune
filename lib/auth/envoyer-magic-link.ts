'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { envoyerEmail } from '@/lib/email/envoyer';
import { templateMagicLink } from '@/lib/email/templates';
import { connexionMagicLinkSchema, type ConnexionMagicLinkInput } from '@/lib/schemas/auth';

/**
 * Server Action — Envoi d'un magic link de connexion (admin SCS).
 *
 * Refacto hotfix 6.5h-quinquies (26/04/2026) : remplace l'appel
 * client `supabase.auth.signInWithOtp` qui utilisait les templates
 * Supabase par défaut (anglais, sans branding OIF). On passe désormais
 * par `admin.generateLink({type: 'magiclink'})` côté serveur (sans envoi
 * automatique), puis on envoie le mail via Resend avec notre template
 * français centralisé (`templateMagicLink`).
 *
 * Sécurité :
 *   - Politique « ne pas révéler l'existence du compte » : on retourne
 *     toujours `succes` même si l'email n'existe pas (sinon un attaquant
 *     pourrait énumérer les comptes via timing/réponses différenciées).
 *   - L'envoi réel n'a lieu QUE si le compte existe ET est admin_scs
 *     (les autres rôles utilisent login + mdp en V1).
 *   - service_role utilisé côté serveur uniquement, jamais exposé.
 */

export type EnvoyerMagicLinkResult =
  | { status: 'succes' }
  | { status: 'erreur_validation'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function envoyerMagicLink(
  input: ConnexionMagicLinkInput,
): Promise<EnvoyerMagicLinkResult> {
  const parse = connexionMagicLinkSchema.safeParse(input);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      message: parse.error.issues[0]?.message ?? 'Adresse email invalide',
    };
  }
  const { email } = parse.data;

  const adminClient = createSupabaseAdminClient();

  // 1. Vérifie l'existence du compte via auth.admin.listUsers (en cascade
  //    avec public.utilisateurs pour récupérer le rôle + prénom).
  //    Pas de sous-requête SQL via supabase-js → 2 appels successifs.
  const { data: authList } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000, // raisonnable en V1 ; pagination à ajouter si > 1000
  });
  const authUser = authList?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!authUser) {
    // Compte inexistant — on simule un succès pour éviter l'énumération.
    return { status: 'succes' };
  }

  const { data: utilisateurRow } = await adminClient
    .from('utilisateurs')
    .select('nom_complet, role')
    .eq('user_id', authUser.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (
    !utilisateurRow ||
    (utilisateurRow.role !== 'admin_scs' && utilisateurRow.role !== 'super_admin') ||
    !authUser.email
  ) {
    // Compte existant mais pas admin_scs : on simule succès aussi
    // (politique « le magic-link ne sait rien révéler »).
    return { status: 'succes' };
  }

  // 2. Génère le lien magique côté serveur (pas d'envoi auto Supabase)
  //
  // Hotfix v2.0.1.2 : on n'utilise PLUS `action_link` directement (cf.
  // envoyer-reset-mot-passe.ts pour le rationale complet). Supabase
  // /auth/v1/verify redirige avec un hash fragment qui ne reach jamais le
  // serveur. On construit un lien direct vers notre callback avec
  // `token_hash` + `type=magiclink` en query string.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectInterne = '/dashboard';
  const redirectTo = `${origin}/api/auth/callback?redirect=${encodeURIComponent(redirectInterne)}`;

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: authUser.email,
    options: { redirectTo },
  });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    return {
      status: 'erreur_inconnue',
      message: `Génération du lien magique : ${linkError?.message ?? 'hashed_token manquant'}`,
    };
  }

  const lienMagic =
    `${origin}/api/auth/callback` +
    `?token_hash=${encodeURIComponent(hashedToken)}` +
    `&type=magiclink` +
    `&redirect=${encodeURIComponent(redirectInterne)}`;

  // 3. Envoie l'email via Resend avec notre template OIF
  const tpl = templateMagicLink({
    prenom: utilisateurRow.nom_complet.split(' ')[0],
    lienMagic,
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
