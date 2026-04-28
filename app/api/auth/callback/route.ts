import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bootstrapUtilisateurIfNeeded } from '@/lib/supabase/auth';

/**
 * Échange du code magic link / recovery contre une session, puis bootstrap métier.
 *
 * Hotfix v2.0.1.2 :
 *   - Les emails de reset / magic-link / invitation envoient désormais des
 *     liens directs vers ce callback avec `token_hash` + `type` en query
 *     string (cf. lib/auth/envoyer-reset-mot-passe.ts). On ne passe plus par
 *     l'endpoint `/auth/v1/verify` de Supabase qui redirigeait avec un hash
 *     fragment côté client (perdu au passage serveur).
 *   - Méthode HEAD : on répond 200 sans rien consommer, pour les scanners
 *     anti-phishing (Microsoft ATP, Yahoo Mail) qui pré-cliquent les liens.
 *     Sans ça, le token serait grillé avant que l'utilisateur ne clique.
 *   - Idempotence GET : si la verification échoue MAIS qu'une session
 *     valide existe déjà pour ce navigateur (cas du double-clic, de la
 *     navigation arrière), on considère que c'est OK et on continue.
 *   - Logs enrichis : les paramètres reçus + l'erreur Supabase sont logués
 *     côté serveur pour faciliter le diagnostic.
 *   - Validation `redirect` : whitelist stricte des chemins internes pour
 *     bloquer les open-redirect.
 */

/**
 * Validation stricte du paramètre `redirect` pour éviter open-redirect.
 * Seuls les chemins internes (commençant par `/`, sans `//` ni `\\`) sont
 * autorisés. Sinon on retombe sur `/dashboard`.
 */
function safeRedirectPath(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/')) return '/dashboard';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/dashboard';
  return raw;
}

/**
 * HEAD : répond 200 immédiatement. Les scanners anti-phishing (Microsoft
 * SafeLinks, Outlook ATP, Gmail) envoient parfois HEAD avant GET. On évite
 * ainsi de griller le token à usage unique.
 */
export async function HEAD(_request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const redirectTo = safeRedirectPath(searchParams.get('redirect'));

  const supabase = await createSupabaseServerClient();

  // Helper de logging défensif (jamais de PII dans le log).
  const logEchec = (raison: string) => {
    // eslint-disable-next-line no-console
    console.error('[auth/callback] Échec verification', {
      raison,
      hadCode: Boolean(code),
      hadTokenHash: Boolean(tokenHash),
      type,
      redirectTo,
      userAgent: request.headers.get('user-agent'),
    });
  };

  // Helper de poursuite du flux métier après obtention d'un user authentifié.
  const poursuivreFluxMetier = async (user: User) => {
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
  };

  // Tentative 1 : exchange code (PKCE) ou verifyOtp (token_hash).
  let echecVerification: string | null = null;

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) echecVerification = `exchangeCodeForSession: ${error.message}`;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: type as any,
        token_hash: tokenHash,
      });
      if (error) echecVerification = `verifyOtp: ${error.message}`;
    } else {
      echecVerification = 'aucun_parametre_token';
    }
  } catch (err) {
    echecVerification = `exception: ${err instanceof Error ? err.message : 'inconnue'}`;
  }

  // Que la vérification ait réussi ou échoué, on tente de récupérer
  // l'utilisateur courant. Cas idempotents :
  //   - Verification OK → user présent
  //   - Verification KO mais double-clic → user déjà présent (cookie session)
  //   - Verification KO et pas de session → vraie erreur
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (echecVerification) logEchec(echecVerification);
    // Si on a essayé d'utiliser un token (code/tokenHash présent) sans succès
    // et sans session existante : lien expiré / déjà utilisé.
    const messageQuery = code || tokenHash ? 'lien_expire' : 'lien_invalide';
    return NextResponse.redirect(`${origin}/connexion?message=${messageQuery}`);
  }

  // user présent → on poursuit le flux normal, même si la vérification a
  // échoué (cas idempotent du double-clic / prefetch).
  if (echecVerification) {
    // eslint-disable-next-line no-console
    console.warn('[auth/callback] Verification a échoué mais session existante — flux poursuivi', {
      raison: echecVerification,
      userId: user.id,
    });
  }

  return await poursuivreFluxMetier(user);
}
