import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LogoOIF } from '@/components/branding/logo-oif';
import { MotPasseOublieForm } from './motpasse-oublie-form';

export const metadata: Metadata = {
  title: 'Mot de passe oublié — OIF Emploi Jeunes',
};

export default function MotPasseOubliePage() {
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
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Recevez par email un lien pour le réinitialiser.
          </p>
        </div>

        <MotPasseOublieForm />

        <p className="text-muted-foreground mt-6 text-center text-xs">
          <Link
            href="/connexion"
            className="hover:text-foreground inline-flex items-center gap-1 underline"
          >
            <ArrowLeft className="size-3" aria-hidden />
            Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
