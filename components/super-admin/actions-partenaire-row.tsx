'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Archive, ArchiveRestore } from 'lucide-react';
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
import { archiverPartenaire, desarchiverPartenaire } from '@/lib/super-admin/server-actions';

type Props = {
  organisationId: string;
  nomOrg: string;
  archive: boolean;
  utilisateursCount: number;
};

export function ActionsPartenaireRow({
  organisationId,
  nomOrg,
  archive,
  utilisateursCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState('');
  const [pending, startTransition] = useTransition();

  if (archive) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const res = await desarchiverPartenaire(organisationId);
            if (res.status === 'erreur') toast.error(`Échec : ${res.message}`);
            else toast.success(`${nomOrg} désarchivé`);
          });
        }}
        className="gap-1.5"
      >
        <ArchiveRestore className="size-3.5" aria-hidden />
        Désarchiver
      </Button>
    );
  }

  const onArchiver = () => {
    if (motif.trim().length < 3) {
      toast.error('Le motif doit faire au moins 3 caractères.');
      return;
    }
    startTransition(async () => {
      const res = await archiverPartenaire({
        organisation_id: organisationId,
        motif: motif.trim(),
      });
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
      } else {
        toast.success(`${nomOrg} archivé · ${utilisateursCount} utilisateur(s) désactivé(s)`);
        setOpen(false);
        setMotif('');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="border-input bg-background hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors">
        <Archive className="size-3.5" aria-hidden />
        Archiver
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Archiver {nomOrg}</DialogTitle>
          <DialogDescription>
            {utilisateursCount > 0
              ? `${utilisateursCount} utilisateur(s) lié(s) seront automatiquement désactivés.`
              : 'Aucun utilisateur lié à cette organisation.'}{' '}
            Les données restent accessibles en lecture seule.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="motif-archive">Motif</Label>
          <Textarea
            id="motif-archive"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : fin du partenariat, fusion, dissolution…"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={onArchiver} disabled={pending}>
            Confirmer l'archivage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
