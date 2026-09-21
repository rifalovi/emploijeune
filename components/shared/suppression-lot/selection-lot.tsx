'use client';

/**
 * Sélection multiple + suppression groupée + purge par projet, réutilisable pour
 * les listes Bénéficiaires et Structures (jumeaux A1 / B1).
 *
 * - Un provider client détient la sélection (`Set<string>`) et fournit le
 *   contexte aux cases à cocher rendues À L'INTÉRIEUR du tableau serveur (les
 *   cases sont des îlots clients ; le contexte traverse les composants serveur).
 * - Barre d'actions flottante quand ≥ 1 ligne cochée → « Supprimer la sélection ».
 * - Panneau « Vider un projet » : sélection du projet, aperçu du nombre de
 *   lignes, confirmation en RETAPANT le code du projet (garde anti-erreur).
 *
 * Les actions serveur (soft-delete gardé par la permission `suppression_lot`)
 * sont injectées en props depuis la page serveur.
 */

import { createContext, useContext, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, FolderMinus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type SuppressionLotResultat = { status: string; count?: number; message?: string };

type Ctx = {
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  count: number;
};

const SelectionCtx = createContext<Ctx | null>(null);

/** Case à cocher d'une ligne (îlot client dans le tableau serveur). */
export function SelectionCheckbox({ id }: { id: string }) {
  const ctx = useContext(SelectionCtx);
  if (!ctx) return null;
  return (
    <span onClick={(e) => e.stopPropagation()} className="flex items-center" role="presentation">
      <Checkbox
        checked={ctx.isSelected(id)}
        onCheckedChange={() => ctx.toggle(id)}
        aria-label="Sélectionner la ligne"
      />
    </span>
  );
}

/** Case « tout cocher / décocher » de la page courante. */
export function SelectionHeaderCheckbox({ pageIds }: { pageIds: string[] }) {
  const ctx = useContext(SelectionCtx);
  if (!ctx) return null;
  const tousCoches = pageIds.length > 0 && pageIds.every((id) => ctx.isSelected(id));
  return (
    <Checkbox
      checked={tousCoches}
      onCheckedChange={() => ctx.setMany(pageIds, !tousCoches)}
      aria-label="Tout sélectionner la page"
    />
  );
}

type ProviderProps = {
  entiteSingulier: string; // « bénéficiaire »
  entitePluriel: string; // « bénéficiaires »
  pageIds: string[];
  projets: { code: string; libelle: string }[];
  peutSupprimerEnLot: boolean;
  supprimerLotAction: (ids: string[], raison?: string) => Promise<SuppressionLotResultat>;
  viderProjetAction: (projetCode: string, raison?: string) => Promise<SuppressionLotResultat>;
  compterProjetAction: (projetCode: string) => Promise<{ ok: boolean; count: number }>;
  children: React.ReactNode;
};

export function SelectionLotProvider({
  entiteSingulier,
  entitePluriel,
  projets,
  peutSupprimerEnLot,
  supprimerLotAction,
  viderProjetAction,
  compterProjetAction,
  children,
}: ProviderProps) {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirmLot, setConfirmLot] = useState(false);
  const [raisonLot, setRaisonLot] = useState('');
  const [pending, startTransition] = useTransition();

  const ctx = useMemo<Ctx>(
    () => ({
      isSelected: (id) => selection.has(id),
      toggle: (id) =>
        setSelection((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      setMany: (ids, on) =>
        setSelection((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            if (on) next.add(id);
            else next.delete(id);
          }
          return next;
        }),
      count: selection.size,
    }),
    [selection],
  );

  // Sans droit de suppression en lot : on n'expose pas le contexte (pas de cases).
  if (!peutSupprimerEnLot) return <>{children}</>;

  function lancerSuppressionLot() {
    const ids = Array.from(selection);
    startTransition(async () => {
      const res = await supprimerLotAction(ids, raisonLot || undefined);
      if (res.status === 'succes') {
        toast.success(`${res.count ?? ids.length} ${entitePluriel} supprimé(s).`);
        setSelection(new Set());
        setRaisonLot('');
        setConfirmLot(false);
      } else {
        toast.error(res.message ?? 'Suppression impossible.');
      }
    });
  }

  return (
    <SelectionCtx.Provider value={ctx}>
      <div className="space-y-3">
        <ViderProjetPanel
          entiteSingulier={entiteSingulier}
          entitePluriel={entitePluriel}
          projets={projets}
          viderProjetAction={viderProjetAction}
          compterProjetAction={compterProjetAction}
        />
        {children}
      </div>

      {/* Barre d'actions groupées — flottante en bas quand une sélection existe. */}
      {selection.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border bg-white px-4 py-2 shadow-lg dark:bg-slate-900">
            <span className="text-sm font-medium">
              {selection.size} {selection.size > 1 ? entitePluriel : entiteSingulier} sélectionné
              {selection.size > 1 ? 's' : ''}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setSelection(new Set())}>
              Annuler
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmLot(true)}
              disabled={pending}
            >
              <Trash2 className="size-4" /> Supprimer la sélection
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmLot} onOpenChange={(o) => !o && setConfirmLot(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {selection.size} {entitePluriel} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Les {selection.size} {entitePluriel} sélectionné{selection.size > 1 ? 's' : ''} seront
              retiré{selection.size > 1 ? 's' : ''} des listes et des analyses (suppression
              réversible par le super administrateur). Cette action est journalisée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={raisonLot}
            onChange={(e) => setRaisonLot(e.target.value)}
            placeholder="Raison (facultatif)…"
            rows={2}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                lancerSuppressionLot();
              }}
              disabled={pending}
              className="bg-red-600 hover:bg-red-700"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SelectionCtx.Provider>
  );
}

/** Panneau « Vider un projet » : purge par projet avec confirmation par code. */
function ViderProjetPanel({
  entiteSingulier,
  entitePluriel,
  projets,
  viderProjetAction,
  compterProjetAction,
}: {
  entiteSingulier: string;
  entitePluriel: string;
  projets: { code: string; libelle: string }[];
  viderProjetAction: (projetCode: string, raison?: string) => Promise<SuppressionLotResultat>;
  compterProjetAction: (projetCode: string) => Promise<{ ok: boolean; count: number }>;
}) {
  const [open, setOpen] = useState(false);
  const [projet, setProjet] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [busyCount, setBusyCount] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [raison, setRaison] = useState('');
  const [pending, startTransition] = useTransition();

  const projetLibelle = projets.find((p) => p.code === projet)?.libelle ?? projet;

  async function choisirProjet(code: string) {
    setProjet(code);
    setConfirmCode('');
    setCount(null);
    if (!code) return;
    setBusyCount(true);
    const res = await compterProjetAction(code);
    setCount(res.ok ? res.count : null);
    setBusyCount(false);
  }

  function reset() {
    setProjet('');
    setCount(null);
    setConfirmCode('');
    setRaison('');
  }

  const arme = !!projet && confirmCode.trim() === projet && (count ?? 0) > 0;

  function lancer() {
    startTransition(async () => {
      const res = await viderProjetAction(projet, raison || undefined);
      if (res.status === 'succes') {
        toast.success(`${res.count ?? 0} ${entitePluriel} du projet ${projet} supprimé(s).`);
        setOpen(false);
        reset();
      } else {
        toast.error(res.message ?? 'Purge impossible.');
      }
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-red-600 hover:text-red-700"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <FolderMinus className="size-4" /> Vider un projet
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : (setOpen(false), reset()))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vider les {entitePluriel} d’un projet</DialogTitle>
            <DialogDescription>
              Supprime (soft-delete, réversible par le super administrateur) TOUS les{' '}
              {entitePluriel} d’un projet. Action massive et journalisée : confirmez en retapant le
              code du projet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Projet</p>
              <Select value={projet || undefined} onValueChange={(v) => choisirProjet(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un projet…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {projets.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.libelle} [{p.code}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {projet && (
              <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {busyCount ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Calcul du nombre de {entitePluriel}…
                  </span>
                ) : count === null ? (
                  'Impossible de compter les lignes de ce projet.'
                ) : count === 0 ? (
                  `Aucun ${entiteSingulier} actif pour ce projet.`
                ) : (
                  <>
                    <strong>{count}</strong> {count > 1 ? entitePluriel : entiteSingulier} du projet{' '}
                    <strong>{projetLibelle}</strong> seront supprimé{count > 1 ? 's' : ''}.
                  </>
                )}
              </div>
            )}

            {projet && (count ?? 0) > 0 && (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Pour confirmer, retapez le code du projet : <code>{projet}</code>
                  </p>
                  <Input
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    placeholder={projet}
                    autoComplete="off"
                  />
                </div>
                <Textarea
                  value={raison}
                  onChange={(e) => setRaison(e.target.value)}
                  placeholder="Raison (facultatif)…"
                  rows={2}
                />
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => (setOpen(false), reset())} disabled={pending}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={lancer}
              disabled={!arme || pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Vider le projet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
