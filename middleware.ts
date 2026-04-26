import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

/**
 * Rate-limit en mémoire pour les routes publiques d'enquête (Étape 6.5c).
 *
 * Limite : 5 requêtes par minute par IP. Implémentation Map en RAM, suffisante
 * pour V1 mono-instance dev/staging. En V1.5/V2 production multi-instance,
 * remplacer par Upstash Ratelimit ou Cloudflare Rate Limiting Rules.
 *
 * Pas de protection complète (un attaquant motivé contournera via rotation
 * d'IP), mais bloque les abus naïfs (scraping séquentiel, brute-force token).
 */
type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(ip, { count: 1, resetAt });
    // Garbage collection opportuniste : nettoie les entrées expirées
    if (rateLimitMap.size > 1000) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (v.resetAt <= now) rateLimitMap.delete(k);
      }
    }
    return { allowed: true, resetAt };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, resetAt: entry.resetAt };
}

/**
 * Middleware Next.js : rafraîchit la session Supabase + protège les routes
 * (dashboard) + applique le rate-limit aux routes publiques d'enquête.
 *
 * Règles d'auth :
 *   - /enquetes/public/* : route publique, AUCUNE auth requise (cf. 6.5c).
 *   - /enquetes/* (autre) : auth requise.
 *   - /dashboard, /beneficiaires, /structures, /imports, /admin : auth requise.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rate-limit appliqué AVANT toute autre logique sur les routes publiques d'enquête
  if (pathname.startsWith('/enquetes/public/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ erreur: 'Trop de requêtes — réessayez dans quelques instants.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }
    // Routes publiques : on ne touche pas à la session Supabase, on laisse passer
    return NextResponse.next();
  }

  const { response, supabase } = await updateSupabaseSession(request);

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/beneficiaires') ||
    pathname.startsWith('/structures') ||
    pathname.startsWith('/enquetes') || // /enquetes/public/* déjà court-circuité plus haut
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
