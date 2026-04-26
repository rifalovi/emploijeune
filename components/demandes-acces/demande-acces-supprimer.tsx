'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { supprimerDemandeAcces } from '@/lib/demandes-acces/mutations';
import { cn } from '@/lib/utils';

export type DemandeAccesSupprimerProps = {
  demandeId: string;
  demandeurLibelle: string;
};

/**
 * Bouton « Supprimer définitivement » pour les demandes au statut 'rejected'
 * (V1-Enrichie-A — hotfix 6.5h-quinquies).
 *
 * Affichage UNIQUEMENT sur les demandes rejetées (filtre côté page admin).
 * Garde-fou côté Server Action : revérifie le statut='rejected' avant DELETE.
 */
export function DemandeAccesSupprimer({ demandeId, demandeurLibelle }: DemandeAccesSupprimerProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSupprimer = () => {
    startTransition(async () => {
      const result = await supprimerDemandeAcces(demandeId);
      if (result.status === 'succes') {
        toast.success('Demande supprimée définitivement');
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 gap-1"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        <Trash2 aria-hidden className="size-3.5" />
        Supprimer définitivement
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement cette demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              La demande de <strong>{demandeurLibelle}</strong> sera supprimée de la base de
              données. <strong>Cette action est irréversible.</strong> Le demandeur ne sera pas
              notifié (l’email de rejet a déjà été envoyé lors de la décision initiale).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <button
              type="button"
              onClick={handleSupprimer}
              disabled={pending}
              className={cn(buttonVariants({ variant: 'destructive' }), 'gap-1')}
            >
              <Trash2 aria-hidden className="size-3.5" />
              {pending ? 'Suppression…' : 'Confirmer la suppression'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
