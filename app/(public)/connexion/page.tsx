import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LogoOIF } from '@/components/branding/logo-oif';
import { ConnexionForm } from './connexion-form';

export const metadata: Metadata = {
  title: 'Connexion — OIF Emploi Jeunes',
};

export default function ConnexionPage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoOIF
            variant="quadri"
            size="lg"
            withProtectedSpace
            priority
            ariaLabel="Logo officiel de l'Organisation Internationale de la Francophonie"
          />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Plateforme Emploi Jeunes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Service de Conception et Suivi de projet
          </p>
        </div>

        <Suspense fallback={<div className="bg-muted h-40 animate-pulse rounded-lg" />}>
          <ConnexionForm />
        </Suspense>

        <p className="text-muted-foreground mt-8 text-center text-xs">
          Besoin d'accès ?{' '}
          <a href="/demande-acces" className="hover:text-foreground underline">
            Faire une demande d'accès
          </a>{' '}
          ou contactez le SCS.
        </p>
      </div>
    </main>
  );
}
