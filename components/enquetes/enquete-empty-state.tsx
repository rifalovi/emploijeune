import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EnqueteEmptyStateProps = {
  variante: 'base_vide' | 'aucun_resultat' | 'recherche_vide';
  peutCreer: boolean;
};

export function EnqueteEmptyState({ variante, peutCreer }: EnqueteEmptyStateProps) {
  const titre =
    variante === 'recherche_vide'
      ? 'Aucune enquête ne correspond à votre recherche'
      : variante === 'aucun_resultat'
        ? 'Aucune enquête ne correspond aux filtres'
        : 'Aucune enquête saisie pour l’instant';

  const message =
    variante === 'recherche_vide'
      ? 'Essayez avec un autre nom ou élargissez les filtres.'
      : variante === 'aucun_resultat'
        ? 'Modifiez les filtres pour voir d’autres résultats.'
        : 'Lancez la première session d’enquête sur un bénéficiaire (questionnaire A) ou sur une structure (questionnaire B).';

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <ClipboardList aria-hidden className="text-muted-foreground size-12" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{titre}</h2>
          <p className="text-muted-foreground text-sm">{message}</p>
        </div>
        {variante === 'base_vide' && peutCreer && (
          <Link href="/enquetes/nouvelle" className={cn(buttonVariants({ variant: 'default' }))}>
            <Plus aria-hidden className="size-4" />
            Lancer une nouvelle enquête
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
