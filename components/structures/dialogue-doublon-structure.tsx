'use client';

import Link from 'next/link';
import { AlertCircle, ExternalLink, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Bandeau d'alerte quand un doublon B1 bloquant a été détecté côté serveur
 * (Q3 Étape 5). Mêmes principes que `DialogueDoublon` côté A1 :
 *   - non bloquant : l'utilisateur peut corriger le nom et réessayer
 *   - lien actionnable vers la fiche existante
 *   - score de similarité affiché pour aider à décider (≥ 0.85 = quasi-jumeau)
 */

export type DialogueDoublonStructureProps = {
  ficheExistante: {
    id: string;
    nom_structure: string;
    pays_code: string;
    projet_code: string;
    similarity_score: number;
  };
  onClose: () => void;
};

export function DialogueDoublonStructure({
  ficheExistante,
  onClose,
}: DialogueDoublonStructureProps) {
  const scorePourcent = Math.round(ficheExistante.similarity_score * 100);

  return (
    <Card role="alert" className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <div className="flex items-start gap-3">
          <AlertCircle aria-hidden className="text-destructive mt-1 size-5 shrink-0" />
          <div className="flex-1 space-y-1">
            <CardTitle className="text-destructive">Une structure similaire existe déjà</CardTitle>
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
          <strong>{ficheExistante.nom_structure}</strong> existe déjà au pays{' '}
          <span className="font-mono">{ficheExistante.pays_code}</span> sur le projet{' '}
          <span className="font-mono">{ficheExistante.projet_code}</span> (similarité{' '}
          {scorePourcent} %).
        </p>
        <p className="text-muted-foreground text-sm">
          Si c&apos;est la même structure, consultez la fiche existante pour la mettre à jour.
          Sinon, précisez le nom (ex. ajouter une mention « antenne », « branche locale »…) puis
          réessayez.
        </p>
        <Link
          href={`/structures/${ficheExistante.id}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
        >
          <ExternalLink aria-hidden className="size-3.5" />
          Voir la fiche existante
        </Link>
      </CardContent>
    </Card>
  );
}
