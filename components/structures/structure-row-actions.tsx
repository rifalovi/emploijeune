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
 * Menu contextuel ⋯ d'une ligne de la liste structures. Identique au menu
 * bénéficiaires (Q8 Étape 4b) : Modifier (droits écriture) + Supprimer
 * (admin_scs uniquement).
 */

export type StructureRowActionsProps = {
  id: string;
  peutEditer: boolean;
  peutSupprimer: boolean;
};

export function StructureRowActions({ id, peutEditer, peutSupprimer }: StructureRowActionsProps) {
  const router = useRouter();
  if (!peutEditer && !peutSupprimer) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
        aria-label="Actions sur cette structure"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <MoreVertical aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {peutEditer && (
          <DropdownMenuItem onClick={() => router.push(`/structures/${id}/modifier`)}>
            <Pencil aria-hidden className="size-4" />
            Modifier
          </DropdownMenuItem>
        )}
        {peutSupprimer && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => router.push(`/structures/${id}?supprimer=1`)}
          >
            <Trash2 aria-hidden className="size-4" />
            Supprimer
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
