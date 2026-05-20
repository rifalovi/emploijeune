'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Pencil, MoreVertical, Trash2, ClipboardList, ChevronDown } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
      {/* Dropdown : choisir entre Questionnaire B (activité éco) et D (écosystèmes).
          NB : @base-ui Menu ne supporte pas `asChild` — on utilise onClick + router.push. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
        >
          <ClipboardList aria-hidden className="size-4" />
          Lancer une enquête
          <ChevronDown aria-hidden className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onClick={() =>
              router.push(`/enquetes/nouvelle?cible_type=structure&cible_id=${structureId}`)
            }
            className="flex flex-col items-start gap-0.5"
          >
            <span className="font-medium">Questionnaire B – Activité économique</span>
            <span className="text-muted-foreground text-xs">Indicateurs B2, B3, B4</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              router.push(
                `/enquetes/nouvelle?cible_type=structure&cible_id=${structureId}&questionnaire=D`,
              )
            }
            className="flex flex-col items-start gap-0.5"
          >
            <span className="font-medium">Questionnaire D – Écosystèmes</span>
            <span className="text-muted-foreground text-xs">Indicateurs D1, D2, D3</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
              <DropdownMenuItem variant="destructive" onClick={() => setDialogueOpen(true)}>
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
