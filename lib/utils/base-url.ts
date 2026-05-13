/**
 * Retourne l'URL de base de l'application.
 *
 * Ordre de priorité :
 *  1. NEXT_PUBLIC_SITE_URL  — variable manuelle dans Vercel (recommandée)
 *  2. NEXT_PUBLIC_APP_URL   — ancienne variable (rétro-compatibilité)
 *  3. VERCEL_URL            — injectée automatiquement par Vercel (sans protocole)
 *  4. http://localhost:3000 — développement local
 *
 * Utilisable côté serveur (Server Actions, Route Handlers, etc.).
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
