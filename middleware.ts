import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

/**
 * Rate-limits en mémoire pour les routes publiques sensibles.
 *
 * Implémentation Map RAM par bucket — suffisante pour V1 mono-instance.
 * En V1.5/V2 multi-instance, remplacer par Upstash Ratelimit ou Cloudflare.
 *
 * Buckets V1 :
 *   - 'enquete-public' : 5 req/min/IP sur /enquetes/public/* (Étape 6.5c)
 *   - 'demande-acces'  : 5 POST/heure/IP sur /demande-acces (V1-Enrichie-A)
 *
 * Pas de protection complète (rotation d'IP contourne), mais bloque les
 * abus naïfs (scraping, brute-force token, spam de demandes).
 */
type RateLimitEntry = { count: number; resetAt: number };
const rateLimitBuckets = new Map<string, Map<string, RateLimitEntry>>();

function checkRateLimit(
  bucket: string,
  ip: string,
  windowMs: number,
  max: number,
): { allowed: boolean; resetAt: number } {
  let mapForBucket = rateLimitBuckets.get(bucket);
  if (!mapForBucket) {
    mapForBucket = new Map();
    rateLimitBuckets.set(bucket, mapForBucket);
  }
  const now = Date.now();
  const entry = mapForBucket.get(ip);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    mapForBucket.set(ip, { count: 1, resetAt });
    // GC opportuniste si la map grossit
    if (mapForBucket.size > 1000) {
      for (const [k, v] of mapForBucket.entries()) {
        if (v.resetAt <= now) mapForBucket.delete(k);
      }
    }
    return { allowed: true, resetAt };
  }
  if (entry.count >= max) {
    return { allowed: false, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, resetAt: entry.resetAt };
}

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function tooManyRequestsResponse(resetAt: number): NextResponse {
  return new NextResponse(JSON.stringify({ erreur: 'Trop de requêtes — réessayez plus tard.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
    },
  });
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
    const rl = checkRateLimit('enquete-public', getIp(request), 60_000, 5);
    if (!rl.allowed) return tooManyRequestsResponse(rl.resetAt);
    // Routes publiques : on ne touche pas à la session Supabase, on laisse passer
    return NextResponse.next();
  }

  // Rate-limit sur la création de demande d'accès (uniquement sur POST :
  // les Server Actions Next.js utilisent POST sur la même URL que la page).
  // Limite : 5 requêtes/heure/IP — suffisamment large pour une saisie
  // honnête + retry, suffisamment serré pour bloquer le spam.
  if (pathname === '/demande-acces' && request.method === 'POST') {
    const rl = checkRateLimit('demande-acces', getIp(request), 60 * 60_000, 5);
    if (!rl.allowed) return tooManyRequestsResponse(rl.resetAt);
  }
  if (pathname === '/demande-acces') {
    // Page publique : pas de garde auth, pas de session Supabase à rafraîchir
    return NextResponse.next();
  }

  const { response, supabase } = await updateSupabaseSession(request);

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/beneficiaires') ||
    pathname.startsWith('/structures') ||
    pathname.startsWith('/enquetes') || // /enquetes/public/* déjà court-circuité plus haut
    pathname.startsWith('/imports') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/super-admin') ||
    pathname.startsWith('/assistant-ia');

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
