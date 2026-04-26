import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bootstrapUtilisateurIfNeeded } from '@/lib/supabase/auth';

/**
 * Échange du code magic link contre une session, puis bootstrap métier.
 *
 * Supabase peut envoyer soit un `code` (PKCE) soit un `token_hash` + `type`
 * (magic link classique). On gère les deux cas.
 *
 * Après échange réussi, on crée la ligne utilisateurs si absente puis on
 * redirige :
 *   - /en-attente-de-validation si statut != 'valide'
 *   - /connexion?message=compte_refuse si rejete
 *   - /dashboard (ou redirect paramétré) sinon
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';

  const supabase = await createSupabaseServerClient();

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: type as any,
        token_hash: tokenHash,
      });
      if (error) throw error;
    } else {
      return NextResponse.redirect(`${origin}/connexion?message=lien_invalide`);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/connexion?message=lien_invalide`);
    }

    const profile = await bootstrapUtilisateurIfNeeded(user);

    if (profile.statut_validation === 'rejete') {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/connexion?message=compte_refuse`);
    }
    if (!profile.actif) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/connexion?message=compte_inactif`);
    }
    if (profile.statut_validation === 'en_attente') {
      return NextResponse.redirect(`${origin}/en-attente-de-validation`);
    }

    return NextResponse.redirect(`${origin}${redirectTo}`);
  } catch (err) {
    // Logging diagnostique enrichi (hotfix 6.5h-quinquies) :
    // l'erreur la plus fréquente est « token already used / expired » causée
    // par les scans anti-phishing des messageries (Yahoo, Outlook ATP) qui
    // pré-cliquent les liens des emails marqués comme spam. Le log inclut
    // les paramètres reçus pour faciliter le diagnostic.
    const message = err instanceof Error ? err.message : 'erreur_inconnue';
    // eslint-disable-next-line no-console
    console.error('[auth/callback] Échec échange code/token', {
      message,
      hadCode: Boolean(code),
      hadTokenHash: Boolean(tokenHash),
      type,
      redirectTo,
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.redirect(`${origin}/connexion?message=lien_expire`);
  }
}
