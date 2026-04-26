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
import { DialogueSuppression } from './dialogue-suppression';
import { cn } from '@/lib/utils';

/**
 * Boutons d'action de la fiche détail : Modifier + menu ⋯ (Supprimer).
 *
 * - Le bouton Modifier est un simple Link vers /beneficiaires/[id]/modifier
 * - Le menu ⋯ n'apparaît que si l'utilisateur peut supprimer (admin_scs)
 * - Ouvre le DialogueSuppression. Ouverture automatique si `?supprimer=1`
 *   est présent dans l'URL (déclenché depuis le menu de la liste 4b).
 */

export type BeneficiaireDetailActionsProps = {
  beneficiaireId: string;
  beneficiaireNom: string;
  beneficiairePrenom: string;
  projetCode: string;
  peutEditer: boolean;
  peutSupprimer: boolean;
};

export function BeneficiaireDetailActions({
  beneficiaireId,
  beneficiaireNom,
  beneficiairePrenom,
  projetCode,
  peutEditer,
  peutSupprimer,
}: BeneficiaireDetailActionsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dialogueOpen, setDialogueOpen] = useState(false);

  // Auto-ouverture du dialogue de suppression via query string (déclenché
  // par le menu ⋯ de la liste, cf. beneficiaire-row-actions.tsx).
  useEffect(() => {
    if (searchParams.get('supprimer') === '1' && peutSupprimer) {
      setDialogueOpen(true);
    }
  }, [searchParams, peutSupprimer]);

  const handleOpenChange = (open: boolean) => {
    setDialogueOpen(open);
    if (!open && searchParams.get('supprimer')) {
      // Nettoyer la query string à la fermeture
      router.replace(pathname);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/enquetes/nouvelle?cible_type=beneficiaire&cible_id=${beneficiaireId}`}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
      >
        <ClipboardList aria-hidden className="size-4" />
        Lancer une enquête
      </Link>
      {peutEditer && (
        <Link
          href={`/beneficiaires/${beneficiaireId}/modifier`}
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
          <DialogueSuppression
            beneficiaireId={beneficiaireId}
            beneficiaireNom={beneficiaireNom}
            beneficiairePrenom={beneficiairePrenom}
            projetCode={projetCode}
            open={dialogueOpen}
            onOpenChange={handleOpenChange}
          />
        </>
      )}
    </div>
  );
}
