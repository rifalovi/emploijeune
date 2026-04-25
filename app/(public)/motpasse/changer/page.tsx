import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LogoOIF } from '@/components/branding/logo-oif';
import { ChangerMotPasseForm } from './changer-form';

export const metadata: Metadata = {
  title: 'Changer mon mot de passe — OIF Emploi Jeunes',
};

/**
 * Page de changement de mot de passe (Étape 6.5a).
 *
 * Trois cas d'usage :
 *   1. Premier login après création de compte par admin_scs
 *      (`?premier_login=1`) — utilisateur authentifié avec mdp temporaire.
 *   2. Reset après clic sur lien email (`?reset=1`) — utilisateur
 *      authentifié temporairement par Supabase pour le changement.
 *   3. Changement volontaire depuis l'espace utilisateur (V1.5).
 *
 * Dans tous les cas, l'utilisateur doit avoir une session Supabase
 * active. Le composant client gère la vérification + l'appel à
 * `auth.updateUser({ password })`.
 */
export default function ChangerMotPassePage() {
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
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Définir mon mot de passe</h1>
        </div>

        <Suspense fallback={<div className="bg-muted h-40 animate-pulse rounded-lg" />}>
          <ChangerMotPasseForm />
        </Suspense>
      </div>
    </main>
  );
}
