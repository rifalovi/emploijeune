import type { Metadata } from 'next';
import { LogoOIF } from '@/components/branding/logo-oif';
import { Card, CardContent } from '@/components/ui/card';
import { validerToken } from '@/lib/enquetes/tokens-publics';
import { EnqueteSaisiePublique } from '@/components/enquetes/enquete-saisie-publique';

export const metadata: Metadata = {
  title: 'Enquête OIF — Plateforme Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function EnquetePubliquePage({ params }: PageProps) {
  const { token } = await params;
  const validation = await validerToken(token);

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
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Enquête OIF Emploi Jeunes</h1>
        </div>

        {validation.status === 'valide' ? (
          <EnqueteSaisiePublique
            token={token}
            questionnaire={validation.cible.questionnaire}
            cibleId={validation.cible.cible_id}
            cibleLibelle={validation.cible.cible_libelle}
          />
        ) : (
          <ErreurToken status={validation.status} />
        )}

        <p className="text-muted-foreground mt-8 text-center text-xs">
          Vos réponses sont confidentielles et utilisées uniquement à des fins de suivi des projets
          OIF.
        </p>
      </div>
    </main>
  );
}

function ErreurToken({ status }: { status: 'inconnu' | 'expire' | 'consomme' }) {
  const titre =
    status === 'expire'
      ? 'Lien expiré'
      : status === 'consomme'
        ? 'Lien déjà utilisé'
        : 'Lien introuvable';
  const message =
    status === 'expire'
      ? 'Ce lien d’enquête a expiré. Contactez votre coordonnateur de projet OIF pour en recevoir un nouveau.'
      : status === 'consomme'
        ? 'Ce lien a déjà été utilisé. Une seule réponse est possible par invitation. Si vous pensez qu’il s’agit d’une erreur, contactez votre coordonnateur de projet OIF.'
        : 'Ce lien d’enquête est invalide ou n’existe pas. Vérifiez l’URL ou contactez votre coordonnateur de projet OIF.';

  return (
    <Card>
      <CardContent className="space-y-2 p-8 text-center">
        <h2 className="text-lg font-semibold">{titre}</h2>
        <p className="text-muted-foreground text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}
