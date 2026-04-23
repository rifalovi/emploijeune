import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthUser, getCurrentUtilisateur } from '@/lib/supabase/auth';
import { LogoOIF } from '@/components/branding/logo-oif';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Compte en attente de validation — OIF Emploi Jeunes',
};

export default async function EnAttenteValidationPage() {
  const user = await getAuthUser();
  if (!user) redirect('/connexion');

  const profile = await getCurrentUtilisateur();

  // Si déjà validé, rediriger vers le dashboard
  if (profile?.statut_validation === 'valide') redirect('/dashboard');
  if (profile?.statut_validation === 'rejete') redirect('/connexion?message=compte_refuse');

  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center">
        <LogoOIF
          variant="quadri"
          size="md"
          withProtectedSpace
          priority
          ariaLabel="Logo officiel de l'Organisation Internationale de la Francophonie"
        />
      </div>
      <div className="w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Votre compte a bien été créé</CardTitle>
            <CardDescription>
              Connecté en tant que <strong>{user.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              Le Service de Conception et Suivi de projet (SCS) de l'OIF doit à présent{' '}
              <strong>valider votre accès</strong> et vous attribuer un rôle ainsi qu'une
              organisation de rattachement.
            </p>
            <p className="text-sm leading-relaxed">
              Vous recevrez un courriel de confirmation une fois la validation effectuée. En
              attendant, vous pouvez fermer cette fenêtre.
            </p>
            <div className="border-muted bg-muted/40 rounded-md border p-4 text-sm">
              <p className="font-medium">Pour toute question ou urgence :</p>
              <p className="text-muted-foreground mt-1">
                Contactez votre unité chef de file ou écrivez à{' '}
                <a
                  className="text-foreground underline underline-offset-2"
                  href="mailto:projets@francophonie.org"
                >
                  projets@francophonie.org
                </a>
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <form action="/api/auth/sign-out" method="post">
                <Button type="submit" variant="outline">
                  Se déconnecter
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
