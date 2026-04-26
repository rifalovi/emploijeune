'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { approuverDemandeAcces, rejeterDemandeAcces } from '@/lib/demandes-acces/mutations';
import { cn } from '@/lib/utils';

export type DemandeAccesActionsProps = {
  demandeId: string;
  demandeurLibelle: string;
};

/**
 * Boutons « Approuver » / « Rejeter » avec dialogues de confirmation.
 */
export function DemandeAccesActions({ demandeId, demandeurLibelle }: DemandeAccesActionsProps) {
  const [openApprouver, setOpenApprouver] = useState(false);
  const [openRejeter, setOpenRejeter] = useState(false);
  const [raison, setRaison] = useState('');
  const [pending, startTransition] = useTransition();

  const handleApprouver = () => {
    startTransition(async () => {
      const result = await approuverDemandeAcces(demandeId);
      if (result.status === 'succes') {
        toast.success('Demande approuvée et compte créé', {
          description:
            result.emailEnvoi === 'mock'
              ? `MOCK — Lien d’activation : ${result.lienActivation}`
              : `Email d’invitation envoyé`,
          duration: 12000,
        });
        setOpenApprouver(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleRejeter = () => {
    if (raison.trim().length < 10) {
      toast.error('La raison doit contenir au moins 10 caractères.');
      return;
    }
    startTransition(async () => {
      const result = await rejeterDemandeAcces({ demandeId, raison });
      if (result.status === 'succes') {
        toast.success('Demande rejetée — email envoyé');
        setOpenRejeter(false);
        setRaison('');
      } else if (result.status === 'erreur_validation') {
        toast.error(result.issues[0]?.message ?? 'Validation KO');
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() => setOpenApprouver(true)}
        disabled={pending}
        className="gap-1"
      >
        <Check aria-hidden className="size-3.5" />
        Approuver
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpenRejeter(true)}
        disabled={pending}
        className="gap-1"
      >
        <X aria-hidden className="size-3.5" />
        Rejeter
      </Button>

      <AlertDialog open={openApprouver} onOpenChange={setOpenApprouver}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approuver la demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un compte sera créé pour <strong>{demandeurLibelle}</strong> avec le rôle indiqué dans
              la demande, et un email d’activation sera envoyé. Cette action est irréversible (à
              part la désactivation manuelle ultérieure).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <button
              type="button"
              onClick={handleApprouver}
              disabled={pending}
              className={cn(buttonVariants({ variant: 'default' }), 'gap-1')}
            >
              <Check aria-hidden className="size-3.5" />
              {pending ? 'Création…' : 'Confirmer l’approbation'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={openRejeter} onOpenChange={setOpenRejeter}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeter la demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{demandeurLibelle}</strong> recevra un email l’informant du rejet, avec la
              raison saisie ci-dessous.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="raison-rejet" className="text-sm font-medium">
              Raison du rejet * (transmise au demandeur)
            </Label>
            <Textarea
              id="raison-rejet"
              rows={3}
              maxLength={500}
              placeholder="Ex. Votre profil n’entre pas dans le périmètre du pilote actuel."
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              disabled={pending}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <button
              type="button"
              onClick={handleRejeter}
              disabled={pending}
              className={cn(buttonVariants({ variant: 'destructive' }), 'gap-1')}
            >
              <X aria-hidden className="size-3.5" />
              {pending ? 'Rejet…' : 'Confirmer le rejet'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
