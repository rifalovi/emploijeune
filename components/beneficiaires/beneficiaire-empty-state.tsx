import Link from 'next/link';
import { Users, Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type BeneficiaireEmptyStateProps = {
  /**
   * `aucun_resultat` : aucun bénéficiaire pour ces filtres (mais la base en contient).
   * `base_vide` : la base ne contient aucun bénéficiaire (utilisateur peut créer).
   * `recherche_vide` : la recherche textuelle n'a renvoyé aucun résultat.
   */
  variante: 'aucun_resultat' | 'base_vide' | 'recherche_vide';
  peutCreer: boolean;
};

export function BeneficiaireEmptyState({ variante, peutCreer }: BeneficiaireEmptyStateProps) {
  const messages = {
    aucun_resultat: {
      titre: 'Aucun bénéficiaire correspondant',
      description: 'Ajustez les filtres ou effacez-les pour voir plus de résultats.',
    },
    base_vide: {
      titre: 'Aucun bénéficiaire pour le moment',
      description: peutCreer
        ? 'Commencez par créer votre premier bénéficiaire.'
        : 'Aucun bénéficiaire n\u2019a encore été saisi dans votre périmètre.',
    },
    recherche_vide: {
      titre: 'Aucun bénéficiaire trouvé',
      description: 'Vérifiez l\u2019orthographe ou essayez une recherche plus courte.',
    },
  } as const;

  const { titre, description } = messages[variante];

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground inline-flex size-12 items-center justify-center rounded-full">
        <Users aria-hidden className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold">{titre}</p>
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      </div>
      {variante === 'base_vide' && peutCreer && (
        <Link
          href="/beneficiaires/nouveau"
          className={cn(buttonVariants({ variant: 'default' }), 'mt-2')}
        >
          <Plus aria-hidden className="size-4" />
          Créer un bénéficiaire
        </Link>
      )}
    </div>
  );
}
