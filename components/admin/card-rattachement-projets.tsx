'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Trash2, ArrowRightLeft, History, Info } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ajouterProjetAUtilisateur,
  retirerProjetAUtilisateur,
  transfererProjet,
} from '@/lib/utilisateurs/affectation-projet';
import { ROLE_DANS_PROJET_LIBELLES, type RoleDansProjet } from '@/lib/schemas/affectation-projet';
import type {
  AffectationCourante,
  ProjetReferentiel,
} from '@/lib/utilisateurs/queries-affectation';
import { cn } from '@/lib/utils';

export type CoordonnateurOption = { user_id: string; nom_complet: string };

export type CardRattachementProjetsProps = {
  utilisateur: {
    id: string;
    user_id: string;
    nom_complet: string;
    role: string;
    organisation_nom: string | null;
  };
  affectations: AffectationCourante[];
  projets: ProjetReferentiel[];
  coordonnateurs: CoordonnateurOption[];
};

export function CardRattachementProjets({
  utilisateur,
  affectations,
  projets,
  coordonnateurs,
}: CardRattachementProjetsProps) {
  if (utilisateur.role === 'admin_scs' || utilisateur.role === 'super_admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projets attribués</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="bg-muted/30 flex items-start gap-2 rounded-md border p-3 text-sm">
            <Info aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <p>
              Les administrateurs SCS ont accès à <strong>tous les projets</strong> et structures de
              la plateforme. Aucun rattachement individuel à gérer.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (utilisateur.role === 'contributeur_partenaire' || utilisateur.role === 'lecteur') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projets accessibles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="bg-muted/30 flex items-start gap-2 rounded-md border p-3 text-sm">
            <Info aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <p>
              Les projets accessibles à cet utilisateur dérivent automatiquement des structures
              rattachées à son organisation
              {utilisateur.organisation_nom && (
                <>
                  {' '}
                  (<strong>{utilisateur.organisation_nom}</strong>)
                </>
              )}
              . Pour ajuster, modifiez les projets des structures depuis la liste structures.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <CoordonnateurUI
      utilisateur={utilisateur}
      affectations={affectations}
      projets={projets}
      coordonnateurs={coordonnateurs}
    />
  );
}

function CoordonnateurUI({
  utilisateur,
  affectations,
  projets,
  coordonnateurs,
}: CardRattachementProjetsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [transfertOuvert, setTransfertOuvert] = useState(false);
  const [retraitCible, setRetraitCible] = useState<AffectationCourante | null>(null);

  const codesAttribues = new Set(affectations.map((a) => a.projet_code));
  const projetsDisponibles = projets.filter((p) => !codesAttribues.has(p.code));

  const onAjout = (codes: string[], roleDansProjet: RoleDansProjet, raison: string) => {
    startTransition(async () => {
      let nbOk = 0;
      const erreurs: string[] = [];
      for (const code of codes) {
        const result = await ajouterProjetAUtilisateur({
          userId: utilisateur.user_id,
          projet_code: code,
          role_dans_projet: roleDansProjet,
          raison: raison || undefined,
        });
        if (result.status === 'succes') nbOk++;
        else if ('message' in result) erreurs.push(`${code} : ${result.message}`);
      }
      if (nbOk > 0) toast.success(`${nbOk} projet(s) ajouté(s)`);
      if (erreurs.length > 0) toast.error(erreurs.join(' · '), { duration: 8000 });
      setAjoutOuvert(false);
      router.refresh();
    });
  };

  const onRetrait = (affectation: AffectationCourante, raison: string) => {
    startTransition(async () => {
      const result = await retirerProjetAUtilisateur({
        userId: affectation.user_id,
        projet_code: affectation.projet_code,
        raison: raison || undefined,
      });
      if (result.status === 'succes') {
        toast.success(`Projet ${affectation.projet_code} retiré`);
      } else if ('message' in result) {
        toast.error(result.message);
      }
      setRetraitCible(null);
      router.refresh();
    });
  };

  const onTransfert = (
    projetCode: string,
    toUserId: string,
    roleDansProjet: RoleDansProjet,
    raison: string,
  ) => {
    startTransition(async () => {
      const result = await transfererProjet({
        fromUserId: utilisateur.user_id,
        toUserId,
        projet_code: projetCode,
        role_dans_projet: roleDansProjet,
        raison,
      });
      if (result.status === 'succes') {
        toast.success(`Projet ${projetCode} transféré`);
      } else if ('message' in result) {
        toast.error(result.message);
      } else if (result.status === 'erreur_validation') {
        toast.error(result.issues.map((i) => i.message).join(' · '));
      }
      setTransfertOuvert(false);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Projets gérés</CardTitle>
            <CardDescription>
              {affectations.length} projet(s) attribué(s) · {projets.length} dans le référentiel
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/utilisateurs/${utilisateur.id}/historique`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}
            >
              <History aria-hidden className="size-4" />
              Historique
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTransfertOuvert(true)}
              disabled={pending || affectations.length === 0}
              className="gap-1"
            >
              <ArrowRightLeft aria-hidden className="size-4" />
              Transférer
            </Button>
            <Button
              size="sm"
              onClick={() => setAjoutOuvert(true)}
              disabled={pending || projetsDisponibles.length === 0}
              className="gap-1"
            >
              <Plus aria-hidden className="size-4" />
              Ajouter
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {affectations.length === 0 ? (
          <p className="text-muted-foreground rounded-md border p-4 text-center text-sm italic">
            Aucun projet attribué. Cliquez sur « Ajouter » pour en attribuer.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {affectations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <Badge variant="outline" className="font-mono text-xs">
                  {a.projet_code}
                </Badge>
                <span className="flex-1 truncate">{a.projet_libelle ?? '—'}</span>
                <Badge variant="secondary" className="text-xs">
                  {ROLE_DANS_PROJET_LIBELLES[a.role_dans_projet as RoleDansProjet] ??
                    a.role_dans_projet}
                </Badge>
                <span className="text-muted-foreground text-xs tabular-nums">
                  depuis {format(new Date(a.date_debut), 'd MMM yyyy', { locale: fr })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRetraitCible(a)}
                  disabled={pending}
                  className="text-destructive hover:text-destructive"
                  aria-label={`Retirer ${a.projet_code}`}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Dialog ajout */}
      <DialogAjoutProjets
        open={ajoutOuvert}
        onClose={() => setAjoutOuvert(false)}
        projets={projetsDisponibles}
        pending={pending}
        onSubmit={onAjout}
      />

      {/* Dialog transfert */}
      <DialogTransfertProjet
        open={transfertOuvert}
        onClose={() => setTransfertOuvert(false)}
        affectations={affectations}
        coordonnateurs={coordonnateurs.filter((c) => c.user_id !== utilisateur.user_id)}
        pending={pending}
        onSubmit={onTransfert}
      />

      {/* Confirmation retrait */}
      <AlertDialog
        open={retraitCible !== null}
        onOpenChange={(open) => !open && setRetraitCible(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le projet {retraitCible?.projet_code} ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{utilisateur.nom_complet}</strong> ne pourra plus accéder à ce projet ni à ses
              bénéficiaires/structures. Une trace sera conservée dans l'historique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RetraitForm
            cible={retraitCible}
            pending={pending}
            onConfirm={onRetrait}
            onCancel={() => setRetraitCible(null)}
          />
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function RetraitForm({
  cible,
  pending,
  onConfirm,
  onCancel,
}: {
  cible: AffectationCourante | null;
  pending: boolean;
  onConfirm: (a: AffectationCourante, raison: string) => void;
  onCancel: () => void;
}) {
  const [raison, setRaison] = useState('');
  if (!cible) return null;
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="raison-retrait" className="text-xs">
          Raison du retrait (optionnel, conservé dans l'historique)
        </Label>
        <Textarea
          id="raison-retrait"
          rows={2}
          maxLength={500}
          value={raison}
          onChange={(e) => setRaison(e.target.value)}
          placeholder="Ex. réaffectation interne, fin de mission…"
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} onClick={onCancel}>
          Annuler
        </AlertDialogCancel>
        <button
          type="button"
          disabled={pending}
          onClick={() => onConfirm(cible, raison)}
          className={cn(buttonVariants({ variant: 'destructive' }))}
        >
          {pending ? 'Retrait…' : 'Confirmer le retrait'}
        </button>
      </AlertDialogFooter>
    </div>
  );
}

function DialogAjoutProjets({
  open,
  onClose,
  projets,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  projets: ProjetReferentiel[];
  pending: boolean;
  onSubmit: (codes: string[], role: RoleDansProjet, raison: string) => void;
}) {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<RoleDansProjet>('gestionnaire_principal');
  const [raison, setRaison] = useState('');

  const toggle = (code: string) => {
    setSelection((s) => {
      const ns = new Set(s);
      if (ns.has(code)) ns.delete(code);
      else ns.add(code);
      return ns;
    });
  };

  const tousCoches = projets.length > 0 && selection.size === projets.length;
  const toggleTout = () => {
    setSelection(tousCoches ? new Set() : new Set(projets.map((p) => p.code)));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setSelection(new Set());
          setRaison('');
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attribuer des projets</DialogTitle>
          <DialogDescription>
            Cochez les projets à attribuer. Une ligne dans l'historique sera créée pour chacun.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {selection.size} sélectionné(s) sur {projets.length}
            </span>
            <Button size="sm" variant="ghost" onClick={toggleTout} disabled={pending}>
              {tousCoches ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Button>
          </div>

          <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
            {projets.length === 0 && (
              <p className="text-muted-foreground p-2 text-sm italic">
                Aucun projet supplémentaire à attribuer (tous déjà gérés).
              </p>
            )}
            {projets.map((p) => (
              <label
                key={p.code}
                className="hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded p-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selection.has(p.code)}
                  onChange={() => toggle(p.code)}
                  disabled={pending}
                  className="mt-0.5 size-4 cursor-pointer"
                />
                <span className="flex-1 leading-snug">
                  <span className="font-mono text-xs">{p.code}</span>
                  <span className="text-muted-foreground"> · {p.libelle}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="role-projet" className="text-xs">
                Rôle dans le projet
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as RoleDansProjet)}>
                <SelectTrigger id="role-projet">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gestionnaire_principal">Gestionnaire principal</SelectItem>
                  <SelectItem value="co_gestionnaire">Co-gestionnaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="raison-ajout" className="text-xs">
                Raison de l'attribution (optionnel)
              </Label>
              <Textarea
                id="raison-ajout"
                rows={2}
                maxLength={500}
                value={raison}
                onChange={(e) => setRaison(e.target.value)}
                placeholder="Contexte, mission, etc."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button
            onClick={() => onSubmit(Array.from(selection), role, raison)}
            disabled={pending || selection.size === 0}
          >
            {pending ? 'Attribution…' : `Attribuer ${selection.size || ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogTransfertProjet({
  open,
  onClose,
  affectations,
  coordonnateurs,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  affectations: AffectationCourante[];
  coordonnateurs: CoordonnateurOption[];
  pending: boolean;
  onSubmit: (projetCode: string, toUserId: string, role: RoleDansProjet, raison: string) => void;
}) {
  const [projet, setProjet] = useState<string>('');
  const [destUserId, setDestUserId] = useState<string>('');
  const [role, setRole] = useState<RoleDansProjet>('gestionnaire_principal');
  const [raison, setRaison] = useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setProjet('');
          setDestUserId('');
          setRaison('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transférer un projet</DialogTitle>
          <DialogDescription>
            Le projet sera retiré de la source et attribué au destinataire. L'historique gardera la
            trace du transfert (qui, quand, pourquoi).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="t-projet" className="text-xs">
              Projet à transférer
            </Label>
            <Select value={projet} onValueChange={(v) => setProjet(v ?? '')}>
              <SelectTrigger id="t-projet">
                <SelectValue placeholder="Sélectionner un projet" />
              </SelectTrigger>
              <SelectContent>
                {affectations.map((a) => (
                  <SelectItem key={a.projet_code} value={a.projet_code}>
                    {a.projet_code} — {a.projet_libelle ?? '—'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="t-dest" className="text-xs">
              Nouveau gestionnaire
            </Label>
            <Select value={destUserId} onValueChange={(v) => setDestUserId(v ?? '')}>
              <SelectTrigger id="t-dest">
                <SelectValue placeholder="Sélectionner un coordonnateur" />
              </SelectTrigger>
              <SelectContent>
                {coordonnateurs.length === 0 && (
                  <SelectItem value="" disabled>
                    Aucun autre coordonnateur disponible
                  </SelectItem>
                )}
                {coordonnateurs.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {c.nom_complet}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="t-role" className="text-xs">
              Rôle du nouveau gestionnaire
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as RoleDansProjet)}>
              <SelectTrigger id="t-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gestionnaire_principal">Gestionnaire principal</SelectItem>
                <SelectItem value="co_gestionnaire">Co-gestionnaire</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="t-raison" className="text-xs">
              Raison du transfert *
            </Label>
            <Textarea
              id="t-raison"
              rows={2}
              maxLength={500}
              required
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Départ, réorganisation, transfert de portefeuille…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button
            onClick={() => onSubmit(projet, destUserId, role, raison)}
            disabled={pending || !projet || !destUserId || raison.trim().length < 3}
          >
            {pending ? 'Transfert…' : 'Confirmer le transfert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
