'use client';

import Link from 'next/link';
import { CheckCircle2, Repeat, Eye, List } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Écran de succès après création d'une structure (B1). Trois CTA :
 *   1. Créer une autre structure de la même cohorte (saisie à la chaîne) —
 *      conserve les query params cohorte_*
 *   2. Voir la fiche créée — `/structures/[id]`
 *   3. Retour à la liste — `/structures`
 */

export type EcranSuccesCreationStructureProps = {
  structureId: string;
  nomStructure: string;
  /** Query string pour conserver les valeurs pré-remplies (mode à la chaîne). */
  queryCohorte: string;
};

export function EcranSuccesCreationStructure({
  structureId,
  nomStructure,
  queryCohorte,
}: EcranSuccesCreationStructureProps) {
  const hrefChaine = queryCohorte ? `/structures/nouveau?${queryCohorte}` : '/structures/nouveau';

  return (
    <Card className="border-[var(--color-oif-vert)]/40">
      <CardHeader>
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden className="mt-1 size-6 shrink-0 text-[var(--color-oif-vert)]" />
          <div className="space-y-1">
            <CardTitle>Structure créée</CardTitle>
            <CardDescription>
              <strong>{nomStructure}</strong> a été enregistrée avec succès.
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
            Créer une autre de la même cohorte
          </Link>
          <Link
            href={`/structures/${structureId}`}
            className={cn(buttonVariants({ variant: 'outline' }), 'justify-start gap-2')}
          >
            <Eye aria-hidden className="size-4" />
            Voir la fiche créée
          </Link>
          <Link
            href="/structures"
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
