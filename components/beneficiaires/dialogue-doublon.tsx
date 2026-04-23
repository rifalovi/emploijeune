'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertCircle, ExternalLink, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Bandeau d'alerte quand un doublon bloquant a été détecté côté serveur
 * (décision Q7 : bloquant avec lien actionnable).
 *
 * Affiché en tête du formulaire quand `status === 'doublon'` renvoyé par
 * `creerBeneficiaire()`. Ne bloque pas le formulaire : l'utilisateur peut
 * corriger les champs pour réessayer, ou suivre le lien vers la fiche
 * existante.
 */

export type DialogueDoublonProps = {
  ficheExistante: {
    id: string;
    prenom: string;
    nom: string;
    date_naissance: string | null;
    projet_code: string;
  };
  onClose: () => void;
};

export function DialogueDoublon({ ficheExistante, onClose }: DialogueDoublonProps) {
  const dateNaissanceLisible = ficheExistante.date_naissance
    ? format(new Date(ficheExistante.date_naissance), 'd MMMM yyyy', { locale: fr })
    : '';

  return (
    <Card role="alert" className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <div className="flex items-start gap-3">
          <AlertCircle aria-hidden className="text-destructive mt-1 size-5 shrink-0" />
          <div className="flex-1 space-y-1">
            <CardTitle className="text-destructive">
              Un bénéficiaire avec ces informations existe déjà
            </CardTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Fermer cette alerte"
            onClick={onClose}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          <strong>
            {ficheExistante.prenom} {ficheExistante.nom}
          </strong>
          {dateNaissanceLisible && <> né·e le {dateNaissanceLisible}</>} existe déjà dans le projet{' '}
          <span className="font-mono">{ficheExistante.projet_code}</span>.
        </p>
        <p className="text-muted-foreground text-sm">
          Si c&apos;est bien la même personne, consultez la fiche existante. Sinon, ajustez le
          prénom, le nom ou la date de naissance et réessayez.
        </p>
        <Link
          href={`/beneficiaires/${ficheExistante.id}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
        >
          <ExternalLink aria-hidden className="size-3.5" />
          Voir la fiche existante
        </Link>
      </CardContent>
    </Card>
  );
}
