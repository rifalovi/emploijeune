'use client';

import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DialogueSuppressionEnquete } from './dialogue-suppression-enquete';
import { cn } from '@/lib/utils';

export type EnqueteDetailActionsProps = {
  sessionId: string;
  cibleLibelle: string;
  peutSupprimer: boolean;
};

/**
 * Actions de la fiche détail enquête (Étape 6e). En V1 :
 *   - Pas d'édition (la session est immuable une fois soumise — l'admin
 *     supprime puis ressaisit). À nuancer en V1.5 si demande terrain.
 *   - Soft-delete admin_scs uniquement.
 */
export function EnqueteDetailActions({
  sessionId,
  cibleLibelle,
  peutSupprimer,
}: EnqueteDetailActionsProps) {
  const [openDialog, setOpenDialog] = useState(false);
  if (!peutSupprimer) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }))}
          aria-label="Plus d’actions"
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setOpenDialog(true)}>
            <Trash2 aria-hidden className="size-4" />
            Supprimer la session
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogueSuppressionEnquete
        sessionId={sessionId}
        cibleLibelle={cibleLibelle}
        open={openDialog}
        onOpenChange={setOpenDialog}
      />
    </>
  );
}
