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
import { setBeneficiaireDeleted } from '@/lib/beneficiaires/mutations';
import { cn } from '@/lib/utils';

/**
 * Dialogue de confirmation de suppression d'un bénéficiaire.
 *
 * Pattern Q2 Étape 4d :
 *   - AlertDialog shadcn qui bloque la navigation tant qu'on n'a pas confirmé
 *   - Textarea optionnelle pour la raison (archivée dans deleted_reason)
 *   - Message explicite : suppression = soft-delete, réversible par admin SCS
 *   - Au confirm : Server Action setBeneficiaireDeleted → redirection liste
 *     avec toast vert
 *
 * Déclenché depuis la page détail (bouton Supprimer du menu ⋯) ou via le
 * query string `?supprimer=1` (lien direct depuis le menu de la liste 4b).
 */

export type DialogueSuppressionProps = {
  beneficiaireId: string;
  beneficiaireNom: string;
  beneficiairePrenom: string;
  projetCode: string;
  /** État contrôlé depuis le parent (typiquement via useState ou query param). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DialogueSuppression({
  beneficiaireId,
  beneficiaireNom,
  beneficiairePrenom,
  projetCode,
  open,
  onOpenChange,
}: DialogueSuppressionProps) {
  const router = useRouter();
  const [raison, setRaison] = useState('');
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await setBeneficiaireDeleted(beneficiaireId, raison);
      if (result.status === 'succes') {
        toast.success('Bénéficiaire supprimé');
        onOpenChange(false);
        router.push('/beneficiaires');
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce bénéficiaire ?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>
              {beneficiairePrenom} {beneficiaireNom}
            </strong>{' '}
            sera supprimé·e du projet <span className="font-mono">{projetCode}</span>. Cette action
            peut être annulée par un administrateur SCS (soft-delete, restauration possible pendant
            90 jours).
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="raison-suppression" className="text-sm font-medium">
            Raison de la suppression{' '}
            <span className="text-muted-foreground font-normal">(optionnel)</span>
          </Label>
          <Textarea
            id="raison-suppression"
            rows={3}
            placeholder="Ex. doublon confirmé avec la fiche PROJ_A14/12345"
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
