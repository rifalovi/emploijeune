'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Pencil, MoreVertical, Trash2, ClipboardList } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DialogueSuppressionStructure } from './dialogue-suppression-structure';
import { cn } from '@/lib/utils';

/**
 * Boutons d'action de la fiche détail structure : Modifier + menu ⋯
 * (Supprimer admin_scs).
 *
 * - Le bouton Modifier est un Link vers /structures/[id]/modifier
 * - Le menu ⋯ n'apparaît que pour admin_scs
 * - Auto-ouverture du dialogue si `?supprimer=1` (depuis le row-action liste)
 */

export type StructureDetailActionsProps = {
  structureId: string;
  nomStructure: string;
  paysCode: string;
  peutEditer: boolean;
  peutSupprimer: boolean;
};

export function StructureDetailActions({
  structureId,
  nomStructure,
  paysCode,
  peutEditer,
  peutSupprimer,
}: StructureDetailActionsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dialogueOpen, setDialogueOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('supprimer') === '1' && peutSupprimer) {
      setDialogueOpen(true);
    }
  }, [searchParams, peutSupprimer]);

  const handleOpenChange = (open: boolean) => {
    setDialogueOpen(open);
    if (!open && searchParams.get('supprimer')) {
      router.replace(pathname);
    }
  };

  if (!peutEditer && !peutSupprimer) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/enquetes/nouvelle?cible_type=structure&cible_id=${structureId}`}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
      >
        <ClipboardList aria-hidden className="size-4" />
        Lancer une enquête
      </Link>
      {peutEditer && (
        <Link
          href={`/structures/${structureId}/modifier`}
          className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-2')}
        >
          <Pencil aria-hidden className="size-4" />
          Modifier
        </Link>
      )}
      {peutSupprimer && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }))}
              aria-label="Autres actions"
            >
              <MoreVertical aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setDialogueOpen(true)}>
                <Trash2 aria-hidden className="size-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogueSuppressionStructure
            structureId={structureId}
            nomStructure={nomStructure}
            paysCode={paysCode}
            open={dialogueOpen}
            onOpenChange={handleOpenChange}
          />
        </>
      )}
    </div>
  );
}
