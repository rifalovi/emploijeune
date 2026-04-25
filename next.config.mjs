/**
 * Configuration Next.js — OIF Emploi Jeunes
 *
 * Security headers conformes OWASP minimum, sans casser Supabase Auth
 * (callbacks magic link) ni les images / fonts hébergées sur Supabase Storage.
 *
 * Documentation détaillée : docs/architecture.md section "Sécurité".
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseHost = SUPABASE_URL.replace(/^https?:\/\//, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  /**
   * `reactStrictMode: false` (hotfix 5h, 25/04/2026) — DÉCISION TEMPORAIRE.
   *
   * Pourquoi : en Strict Mode, React double-execute les fonctions d'initialisation
   * de `useState` et les effects. Le composant `Select` de Base-UI 1.4.1 utilise
   * un `useCompositeListItem` interne qui suit les items via un `nextIndexRef`
   * incrémenté à l'init de l'état. Le double-run consume `nextIndexRef.current`
   * deux fois par item, décalant les indices ; les ref callbacks
   * `elementsRef.current[index] = node` ne s'attachent jamais au DOM. Conséquence :
   *   - `useListNavigation.syncCurrentTarget` ne trouve pas l'item dans la liste
   *   - L'item n'est jamais marqué `data-highlighted` au survol
   *   - `SelectItem.onClick` rejette le clic via le guard `!highlighted`
   *   - `useDismiss` interprète le clic comme « clic extérieur » → ferme sans commit
   *
   * Diagnostic complet : voir commit message de hotfix 5h.
   *
   * Coût accepté : on perd les détections debug de Strict Mode (effets non
   * idempotents, Subscribe/unsubscribe asymétriques, etc.). À ré-évaluer
   * lorsque Base-UI corrige son `useCompositeListItem` pour être Strict-Mode-safe
   * (suivi backlog V1.5).
   */
  reactStrictMode: false,

  async headers() {
    const csp = [
      `default-src 'self'`,
      // Next.js inline styles pour le dev + fonts auto-hébergées
      `style-src 'self' 'unsafe-inline'`,
      // Scripts : 'self' + inline (RSC hydratation) + eval (Next dev HMR)
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
      `img-src 'self' data: blob: https://${supabaseHost}`,
      `font-src 'self' data:`,
      // Connexions XHR / WebSocket vers Supabase (REST, Auth, Realtime)
      `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
      `frame-ancestors 'none'`,
      `form-action 'self'`,
      `base-uri 'self'`,
      `object-src 'none'`,
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'Content-Security-Policy', value: csp },
          // HSTS : uniquement en production (dev http local serait cassé)
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
