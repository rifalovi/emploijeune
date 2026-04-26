import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LogoOIF } from '@/components/branding/logo-oif';
import { DemandeAccesForm } from '@/components/demandes-acces/demande-acces-form';

export const metadata: Metadata = {
  title: 'Demander l’accès — OIF Emploi Jeunes',
};

/**
 * Page publique de demande d'accès (V1-Enrichie-A).
 *
 * Accessible SANS authentification. Le formulaire crée une entrée
 * `pending` dans `public.demandes_acces` qui sera ensuite traitée par
 * un admin_scs depuis `/admin/demandes-acces`.
 */
export default function DemandeAccesPage() {
  return (
    <main className="bg-background flex min-h-screen items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
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

        <DemandeAccesForm />

        <p className="text-muted-foreground mt-6 text-center text-xs">
          <Link
            href="/connexion"
            className="hover:text-foreground inline-flex items-center gap-1 underline"
          >
            <ArrowLeft className="size-3" aria-hidden />
            Vous avez déjà un compte ? Connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
