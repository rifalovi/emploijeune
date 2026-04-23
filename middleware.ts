import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

/**
 * Middleware Next.js : rafraîchit la session Supabase sur chaque requête
 * et protège les routes du groupe (dashboard) par une vérification
 * d'authentification légère (redirige vers /connexion si pas de session).
 *
 * La vérification fine (statut_validation, rôle) se fait côté Server Component
 * via requireUtilisateurValide() pour éviter les requêtes DB dans le middleware.
 */
export async function middleware(request: NextRequest) {
  const { response, supabase } = await updateSupabaseSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/beneficiaires') ||
    pathname.startsWith('/structures') ||
    pathname.startsWith('/enquetes') ||
    pathname.startsWith('/imports') ||
    pathname.startsWith('/admin');

  if (isProtected) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const url = request.nextUrl.clone();
      url.pathname = '/connexion';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Exclut fichiers statiques, images Next et API auth qui gèrent leur propre redirection.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)',
  ],
};
