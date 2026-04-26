'use client';

import { useState, useTransition } from 'react';
import { Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RapportImport } from '@/lib/imports/types';

export type DialogueRapportImportProps = {
  rapport: RapportImport | null;
  onClose: () => void;
};

/**
 * Dialogue de rapport d'import (Étape 7) :
 *   - Compteurs (insérées / ignorées / erreurs)
 *   - Tableau d'erreurs paginé visuellement (max 50 affichées + lien
 *     "télécharger le rapport complet")
 *   - Bouton de téléchargement Excel pour analyse + correction du fichier
 */
export function DialogueRapportImport({ rapport, onClose }: DialogueRapportImportProps) {
  const [pending, startTransition] = useTransition();

  const handleTelecharger = () => {
    if (!rapport) return;
    startTransition(async () => {
      try {
        const response = await fetch('/api/imports/rapport-erreurs', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rapport),
        });
        if (!response.ok) {
          throw new Error(await response.text().catch(() => response.statusText));
        }
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const match = /filename="([^"]+)"/.exec(disposition);
        const filename = match?.[1] ?? 'Rapport_import.xlsx';
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Rapport téléchargé');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur réseau';
        toast.error('Téléchargement impossible', { description: msg });
      }
    });
  };

  const open = Boolean(rapport);
  const erreursAffichees = rapport?.erreurs.slice(0, 50) ?? [];
  const reste = (rapport?.erreurs.length ?? 0) - erreursAffichees.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Rapport d’import</DialogTitle>
          {rapport && (
            <DialogDescription>
              <strong>{rapport.fichier_nom}</strong> — exécuté le{' '}
              {new Date(rapport.execute_a).toLocaleString('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </DialogDescription>
          )}
        </DialogHeader>

        {rapport && (
          <div className="space-y-4 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Compteur valeur={rapport.nb_lignes_total} libelle="Lignes lues" />
              <Compteur
                valeur={rapport.nb_lignes_inserees}
                libelle="Insérées"
                ton={rapport.nb_lignes_inserees > 0 ? 'succes' : undefined}
                icone="ok"
              />
              <Compteur
                valeur={rapport.nb_lignes_ignorees}
                libelle="Ignorées"
                ton={rapport.nb_lignes_ignorees > 0 ? 'erreur' : undefined}
                icone="erreur"
              />
            </div>

            {rapport.erreurs.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950/30">
                ✓ Aucune erreur détectée. Toutes les lignes ont été importées avec succès.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Détail des erreurs ({rapport.erreurs.length}) :
                </p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Ligne</TableHead>
                        <TableHead>Colonne</TableHead>
                        <TableHead>Valeur</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {erreursAffichees.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs tabular-nums">
                            {e.ligne}
                          </TableCell>
                          <TableCell className="text-xs">{e.colonne ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[12rem] truncate text-xs">
                            {e.valeur ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs">{e.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {reste > 0 && (
                  <p className="text-muted-foreground text-xs italic">
                    ({reste} erreur(s) supplémentaire(s) — téléchargez le rapport pour la liste
                    complète.)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:flex-row">
          {rapport && rapport.erreurs.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleTelecharger}
              disabled={pending}
              className="gap-2"
            >
              <Download aria-hidden className="size-4" />
              {pending ? 'Génération…' : 'Télécharger le rapport Excel'}
            </Button>
          )}
          <Button type="button" onClick={onClose} className="ml-auto">
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Compteur({
  valeur,
  libelle,
  ton,
  icone,
}: {
  valeur: number;
  libelle: string;
  ton?: 'succes' | 'erreur';
  icone?: 'ok' | 'erreur';
}) {
  const couleur =
    ton === 'succes'
      ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300'
      : ton === 'erreur'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
        : 'border-input bg-card';
  return (
    <div className={`rounded-lg border p-3 ${couleur}`}>
      <div className="flex items-center justify-center gap-1">
        {icone === 'ok' && <CheckCircle2 aria-hidden className="size-4" />}
        {icone === 'erreur' && <AlertCircle aria-hidden className="size-4" />}
        <span className="text-2xl font-semibold tabular-nums">
          {valeur.toLocaleString('fr-FR')}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">{libelle}</p>
    </div>
  );
}

// Compose `useState` is used in parent — small wrapper to avoid passing hook.
export function useRapportImport(): {
  rapport: RapportImport | null;
  setRapport: (r: RapportImport | null) => void;
} {
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  return { rapport, setRapport };
}
