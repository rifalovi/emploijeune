'use client';

import Link from 'next/link';
import { CheckCircle2, Repeat, Eye, List } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Écran de succès après création d'un bénéficiaire.
 *
 * Propose 3 chemins possibles :
 *   1. Créer un autre bénéficiaire de la même cohorte (saisie à la chaîne) —
 *      redirige vers /beneficiaires/nouveau avec query string conservée
 *   2. Voir la fiche créée — /beneficiaires/[id]
 *   3. Retour à la liste — /beneficiaires
 *
 * Remplace le formulaire dans la page de création après un INSERT réussi.
 */

export type EcranSuccesCreationProps = {
  beneficiaireId: string;
  prenom: string;
  nom: string;
  /** Query string pour conserver les valeurs pré-remplies (mode à la chaîne). */
  queryCohorte: string;
};

export function EcranSuccesCreation({
  beneficiaireId,
  prenom,
  nom,
  queryCohorte,
}: EcranSuccesCreationProps) {
  const hrefChaine = queryCohorte
    ? `/beneficiaires/nouveau?${queryCohorte}`
    : '/beneficiaires/nouveau';

  return (
    <Card className="border-[var(--color-oif-vert)]/40">
      <CardHeader>
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden className="mt-1 size-6 shrink-0 text-[var(--color-oif-vert)]" />
          <div className="space-y-1">
            <CardTitle>Bénéficiaire créé</CardTitle>
            <CardDescription>
              <strong>
                {prenom} {nom}
              </strong>{' '}
              a été enregistré·e avec succès.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">Que souhaitez-vous faire ensuite&nbsp;?</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link
            href={hrefChaine}
            className={cn(buttonVariants({ variant: 'default' }), 'justify-start gap-2')}
          >
            <Repeat aria-hidden className="size-4" />
            Créer un autre de la même cohorte
          </Link>
          <Link
            href={`/beneficiaires/${beneficiaireId}`}
            className={cn(buttonVariants({ variant: 'outline' }), 'justify-start gap-2')}
          >
            <Eye aria-hidden className="size-4" />
            Voir la fiche créée
          </Link>
          <Link
            href="/beneficiaires"
            className={cn(buttonVariants({ variant: 'outline' }), 'justify-start gap-2')}
          >
            <List aria-hidden className="size-4" />
            Retour à la liste
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
