'use client';

import { useEffect } from 'react';

/**
 * Boundary d'erreur RACINE — V2.6.
 *
 * Couvre les erreurs survenant DANS le `RootLayout` lui-même (par ex.
 * fonts, providers, métadonnées). Doit définir son propre `<html>` /
 * `<body>` car le layout racine a échoué.
 *
 * Garde un design minimal : pas de dépendance à shadcn/Tailwind utility
 * compilation si tout casse. Styles inline simples pour garantir un
 * rendu lisible.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#0f172a',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 9999,
              background: '#fee2e2',
              color: '#dc2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              marginBottom: 16,
            }}
            aria-hidden
          >
            !
          </div>
          <h1 style={{ fontSize: 24, margin: '0 0 0.5rem 0', fontWeight: 600 }}>Erreur critique</h1>
          <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: 8 }}>
            L&apos;application a rencontré un problème inattendu. Rechargez la page ou contactez le
            SCS.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                color: '#64748b',
                background: '#f1f5f9',
                padding: '4px 8px',
                borderRadius: 4,
                display: 'inline-block',
                marginTop: 4,
              }}
            >
              ID erreur : {error.digest}
            </p>
          )}
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                background: '#0E4F88',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '0.5rem 1rem',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
