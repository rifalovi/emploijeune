'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ShieldOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { suspendreUtilisateur, leverSuspensionParUser } from '@/lib/super-admin/server-actions';
import type { RoleUtilisateur } from '@/lib/supabase/auth';

type Props = {
  userId: string;
  nomComplet: string;
  suspendu: boolean;
  isCourant: boolean;
  role: RoleUtilisateur;
};

export function ActionsUtilisateurRow({ userId, nomComplet, suspendu, isCourant }: Props) {
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [pending, startTransition] = useTransition();

  if (isCourant) {
    return <span className="text-muted-foreground text-xs italic">—</span>;
  }

  if (suspendu) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const res = await leverSuspensionParUser(userId);
            if (res.status === 'erreur') {
              toast.error(`Échec : ${res.message}`);
            } else {
              toast.success(`Suspension levée pour ${nomComplet}`);
            }
          });
        }}
        className="gap-1.5"
      >
        <ShieldCheck className="size-3.5" aria-hidden />
        Lever suspension
      </Button>
    );
  }

  const onSuspendre = () => {
    if (motif.trim().length < 3) {
      toast.error('Le motif doit faire au moins 3 caractères.');
      return;
    }
    const dateFinIso = dateFin ? new Date(dateFin).toISOString() : null;
    startTransition(async () => {
      const res = await suspendreUtilisateur({
        user_id: userId,
        motif: motif.trim(),
        date_fin: dateFinIso,
      });
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
      } else {
        toast.success(`${nomComplet} suspendu`);
        setOpen(false);
        setMotif('');
        setDateFin('');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="border-input bg-background hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors">
        <ShieldOff className="size-3.5" aria-hidden />
        Suspendre
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Suspendre {nomComplet}</DialogTitle>
          <DialogDescription>
            Le compte sera désactivé. Laissez la date vide pour un bannissement définitif.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="motif">Motif</Label>
            <Textarea
              id="motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex. : départ de l'organisation, comportement inapproprié…"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="date-fin">Date de fin (optionnel)</Label>
            <Input
              id="date-fin"
              type="datetime-local"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Vide = bannissement définitif (à lever manuellement).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={onSuspendre} disabled={pending}>
            Confirmer la suspension
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
