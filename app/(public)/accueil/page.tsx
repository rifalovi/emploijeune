import { redirect, permanentRedirect } from 'next/navigation';

/**
 * V1.7.0 — `/accueil` est désormais un alias vers `/`.
 *
 * La vitrine publique est servie directement par `app/page.tsx` (racine), y
 * compris pour les utilisateurs authentifiés. Cette route est conservée
 * uniquement pour les liens externes historiques.
 *
 * Permanent redirect (308) pour signaler aux moteurs de recherche que
 * l'URL canonique a changé.
 */
export default function AccueilRedirectPage(): never {
  // permanentRedirect lance NEXT_REDIRECT — TS le déduit comme `never`.
  // Fallback `redirect` si la version de Next ne l'expose pas (les deux
  // sont disponibles depuis Next 14.0).
  if (typeof permanentRedirect === 'function') {
    permanentRedirect('/');
  }
  redirect('/');
}
