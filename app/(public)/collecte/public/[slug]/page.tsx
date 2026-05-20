import type { Metadata } from 'next';
import { LogoOIF } from '@/components/branding/logo-oif';
import { Card, CardContent } from '@/components/ui/card';
import { validerLienSlug } from '@/lib/collecte-publique/actions';
import { CollecteForm } from './collecte-form';

export const metadata: Metadata = {
  title: 'Enregistrement – OIF Emploi Jeunes',
  description: "Formulaire d'enregistrement pour les bénéficiaires et structures partenaires OIF.",
};

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CollectePubliquePage({ params }: PageProps) {
  const { slug } = await params;
  const validation = await validerLienSlug(slug);

  const typeLabel =
    validation.status === 'valide'
      ? validation.lien.type === 'A'
        ? 'Inscription bénéficiaire'
        : validation.lien.type === 'C'
          ? "Questionnaire – Intermédiation vers l'emploi"
          : validation.lien.type === 'D'
            ? "Questionnaire – Écosystèmes et conditions de l'emploi"
            : 'Enregistrement structure partenaire'
      : "Formulaire d'enregistrement";

  return (
    <main className="bg-background flex min-h-screen items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* En-tête OIF */}
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoOIF
            variant="quadri"
            size="lg"
            withProtectedSpace
            priority
            ariaLabel="Logo officiel de l'Organisation Internationale de la Francophonie"
          />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">OIF – Emploi Jeunes</h1>
          <p className="text-muted-foreground mt-1 text-sm">{typeLabel}</p>
          {validation.status === 'valide' && validation.lien.label && (
            <p className="mt-1 text-xs font-medium text-[#5D0073]">{validation.lien.label}</p>
          )}
        </div>

        {/* Contenu principal */}
        {validation.status === 'valide' ? (
          <>
            <div className="mb-6 rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Note :</strong> Votre soumission sera examinée par un coordinateur OIF avant
              d&apos;être intégrée dans la plateforme. Aucun compte n&apos;est requis.
            </div>
            <CollecteForm lien={validation.lien} />
          </>
        ) : (
          <ErreurLien status={validation.status} />
        )}

        <p className="text-muted-foreground mt-8 text-center text-xs">
          Vos données sont traitées conformément à la politique de confidentialité de l&apos;OIF.
        </p>
      </div>
    </main>
  );
}

function ErreurLien({ status }: { status: 'introuvable' | 'inactif' | 'expire' }) {
  const config = {
    introuvable: {
      titre: 'Lien introuvable',
      message:
        "Ce lien d'enregistrement est invalide ou n'existe pas. Vérifiez l'URL ou contactez votre coordinateur de projet OIF.",
    },
    inactif: {
      titre: 'Collecte temporairement suspendue',
      message:
        "Ce lien d'enregistrement est actuellement désactivé. Contactez votre coordinateur de projet OIF pour plus d'informations.",
    },
    expire: {
      titre: 'Lien expiré',
      message:
        "Ce lien d'enregistrement n'est plus valide. La période de collecte est terminée. Contactez votre coordinateur de projet OIF.",
    },
  };

  const { titre, message } = config[status];

  return (
    <Card>
      <CardContent className="space-y-2 p-8 text-center">
        <h2 className="text-lg font-semibold">{titre}</h2>
        <p className="text-muted-foreground text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}
