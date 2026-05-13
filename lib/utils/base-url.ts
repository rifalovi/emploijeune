/**
 * Retourne l'URL de base de l'application.
 *
 * Ordre de priorité :
 *  1. NEXT_PUBLIC_SITE_URL  — variable manuelle dans Vercel (recommandée)
 *  2. NEXT_PUBLIC_APP_URL   — ancienne variable (rétro-compatibilité)
 *  3. VERCEL_URL            — injectée automatiquement par Vercel (sans protocole)
 *  4. http://localhost:3000 — développement local
 *
 * GARDE-FOU PRODUCTION (V2.6.2) : si une variable contient « localhost »
 * alors qu'on est en production (VERCEL_URL défini ou NODE_ENV=production),
 * elle est IGNORÉE et on passe à la suivante. Évite le bug récurrent où
 * `NEXT_PUBLIC_APP_URL=http://localhost:3000` traîne dans les env vars
 * Vercel et casse les liens d'emails (magic link, invitations) en prod.
 *
 * Utilisable côté serveur (Server Actions, Route Handlers, etc.).
 */
export function getBaseUrl(): string {
  const enProduction = Boolean(process.env.VERCEL_URL || process.env.NODE_ENV === 'production');

  const valide = (url: string | undefined): string | null => {
    if (!url) return null;
    if (enProduction && url.includes('localhost')) return null;
    return url;
  };

  return (
    valide(process.env.NEXT_PUBLIC_SITE_URL) ??
    valide(process.env.NEXT_PUBLIC_APP_URL) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    'http://localhost:3000'
  );
}
