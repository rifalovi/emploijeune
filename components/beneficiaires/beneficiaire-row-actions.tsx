'use client';

import { useRouter } from 'next/navigation';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Menu contextuel ⋯ d'une ligne de la liste bénéficiaires.
 *
 * Décision Q8 Étape 4b : 2 actions uniquement :
 *   - Modifier (visible si l'utilisateur a droit d'écriture)
 *   - Supprimer (visible pour admin_scs seul)
 *
 * Le clic sur la ligne ouvre la vue détail — pas besoin d'action « Voir ».
 * Les options « Dupliquer » et « Historique » sont reportées V1.5 (Q2 et Q6).
 *
 * La primitive DropdownMenu (base-ui) ne supporte pas `asChild`. On navigue
 * donc via `onSelect` + `router.push` et on stoppe la propagation du clic
 * pour éviter d'activer les Link de la cellule parente.
 */

export type BeneficiaireRowActionsProps = {
  id: string;
  peutEditer: boolean;
  peutSupprimer: boolean;
};

export function BeneficiaireRowActions({
  id,
  peutEditer,
  peutSupprimer,
}: BeneficiaireRowActionsProps) {
  const router = useRouter();
  if (!peutEditer && !peutSupprimer) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
        aria-label="Actions sur ce bénéficiaire"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <MoreVertical aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {peutEditer && (
          <DropdownMenuItem onSelect={() => router.push(`/beneficiaires/${id}/modifier`)}>
            <Pencil aria-hidden className="size-4" />
            Modifier
          </DropdownMenuItem>
        )}
        {peutSupprimer && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => router.push(`/beneficiaires/${id}?supprimer=1`)}
          >
            <Trash2 aria-hidden className="size-4" />
            Supprimer
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
