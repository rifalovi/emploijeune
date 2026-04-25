'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { buttonVariants } from '@/components/ui/button';
import { setSessionEnqueteDeleted } from '@/lib/enquetes/mutations';
import { cn } from '@/lib/utils';

/**
 * Dialogue de suppression d'une session d'enquête (Étape 6e).
 * Pattern miroir de DialogueSuppressionStructure / Beneficiaire.
 * Soft-delete = `deleted_at` mis à jour sur les N lignes de la session.
 */

export type DialogueSuppressionEnqueteProps = {
  sessionId: string;
  cibleLibelle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DialogueSuppressionEnquete({
  sessionId,
  cibleLibelle,
  open,
  onOpenChange,
}: DialogueSuppressionEnqueteProps) {
  const router = useRouter();
  const [raison, setRaison] = useState('');
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await setSessionEnqueteDeleted(sessionId, raison);
      if (result.status === 'succes') {
        toast.success('Session d’enquête supprimée');
        onOpenChange(false);
        router.push('/enquetes');
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette session d’enquête ?</AlertDialogTitle>
          <AlertDialogDescription>
            La session pour <strong>{cibleLibelle}</strong> sera supprimée. Toutes les réponses
            associées (1 ligne par indicateur) seront soft-supprimées et restaurables par un
            administrateur SCS pendant 90 jours.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="raison-suppression-enquete" className="text-sm font-medium">
            Raison de la suppression{' '}
            <span className="text-muted-foreground font-normal">(optionnel)</span>
          </Label>
          <Textarea
            id="raison-suppression-enquete"
            rows={3}
            placeholder="Ex. doublon de saisie, erreur sur la cible…"
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
            maxLength={500}
            disabled={pending}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className={cn(buttonVariants({ variant: 'destructive' }), 'gap-2')}
          >
            <Trash2 aria-hidden className="size-4" />
            {pending ? 'Suppression…' : 'Supprimer'}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
