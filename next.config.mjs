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
