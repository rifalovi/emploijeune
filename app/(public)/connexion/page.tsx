import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConnexionForm } from './connexion-form';

export const metadata: Metadata = {
  title: 'Connexion — OIF Emploi Jeunes',
};

export default function ConnexionPage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div
            aria-hidden
            className="bg-primary text-primary-foreground mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg"
          >
            <span className="text-xl font-bold">OIF</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Plateforme Emploi Jeunes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Service de Conception et Suivi de projet — Organisation Internationale de la
            Francophonie
          </p>
        </div>

        <Suspense fallback={<div className="bg-muted h-40 animate-pulse rounded-lg" />}>
          <ConnexionForm />
        </Suspense>

        <p className="text-muted-foreground mt-8 text-center text-xs">
          Besoin d'accès ? Contactez le Service de Conception et Suivi de projet.
        </p>
      </div>
    </main>
  );
}
