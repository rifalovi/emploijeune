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
import { setStructureDeleted } from '@/lib/structures/mutations';
import { cn } from '@/lib/utils';

/**
 * Dialogue de confirmation de suppression d'une structure (B1).
 * Pattern miroir de `DialogueSuppression` (Étape 4d) : AlertDialog + textarea
 * raison optionnelle + Server Action `setStructureDeleted` + redirect liste.
 */

export type DialogueSuppressionStructureProps = {
  structureId: string;
  nomStructure: string;
  paysCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DialogueSuppressionStructure({
  structureId,
  nomStructure,
  paysCode,
  open,
  onOpenChange,
}: DialogueSuppressionStructureProps) {
  const router = useRouter();
  const [raison, setRaison] = useState('');
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await setStructureDeleted(structureId, raison);
      if (result.status === 'succes') {
        toast.success('Structure supprimée');
        onOpenChange(false);
        router.push('/structures');
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette structure ?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{nomStructure}</strong> au pays <span className="font-mono">{paysCode}</span>{' '}
            sera supprimée. Cette action peut être annulée par un administrateur SCS (soft-delete,
            restauration possible pendant 90 jours).
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="raison-suppression-structure" className="text-sm font-medium">
            Raison de la suppression{' '}
            <span className="text-muted-foreground font-normal">(optionnel)</span>
          </Label>
          <Textarea
            id="raison-suppression-structure"
            rows={3}
            placeholder="Ex. doublon confirmé avec la fiche AGRI-MLI-002"
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
            maxLength={500}
            disabled={pending}
          />
          <p className="text-muted-foreground text-xs">
            Cette raison est conservée pour traçabilité.
          </p>
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
