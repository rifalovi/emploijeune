'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Boundary d'erreur route — V2.6.
 *
 * Capté par Next.js sur toute exception non interceptée dans un Server
 * Component ou un Client Component du segment. Doit être un Client
 * Component (le `'use client'` est obligatoire).
 *
 * Ce fichier répond aussi au warning « missing required error components,
 * refreshing... » : Next.js le cherche par convention à la racine de `app/`.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[error-boundary]', error);
  }, [error]);

  return (
    <main className="bg-background flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="size-6" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Une erreur est survenue
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          La page n&apos;a pas pu être chargée. Si le problème persiste, contactez le SCS en
          précisant l&apos;identifiant ci-dessous.
        </p>
        {error.digest && (
          <p className="mt-3 inline-block rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500">
            ID erreur : {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button onClick={reset} variant="default" size="sm">
            <RotateCcw className="mr-2 size-4" aria-hidden />
            Réessayer
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">
              <Home className="mr-2 size-4" aria-hidden />
              Retour à l&apos;accueil
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
