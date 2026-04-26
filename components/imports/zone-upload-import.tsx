'use client';

import { useState, useRef, useTransition } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RapportImport, ResultatImport } from '@/lib/imports/types';
import { cn } from '@/lib/utils';

export type ZoneUploadImportProps = {
  /** Endpoint POST qui accepte multipart/form-data avec champ `fichier`. */
  endpoint: string;
  titre: string;
  description: string;
  /** Nom de fichier modèle pour le lien « Télécharger le template ». */
  templateLabel?: string;
  /** Callback quand un import réussit (avec rapport). */
  onRapport: (rapport: RapportImport) => void;
};

const MAX_TAILLE_MO = 5;

export function ZoneUploadImport({
  endpoint,
  titre,
  description,
  templateLabel,
  onRapport,
}: ZoneUploadImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();

  const validerFichier = (f: File): string | null => {
    if (!f.name.toLowerCase().endsWith('.xlsx')) return 'Format attendu : .xlsx (Excel).';
    if (f.size > MAX_TAILLE_MO * 1024 * 1024) {
      return `Fichier trop volumineux (max ${MAX_TAILLE_MO} MB).`;
    }
    return null;
  };

  const handleFichierSelectionne = (f: File) => {
    const err = validerFichier(f);
    if (err) {
      toast.error(err);
      return;
    }
    setFichier(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFichierSelectionne(f);
  };

  const handleLancerImport = () => {
    if (!fichier) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.append('fichier', fichier);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
        });

        if (!response.ok) {
          const errPayload = await response.json().catch(() => ({ erreur: response.statusText }));
          toast.error('Import impossible', {
            description: errPayload.erreur ?? response.statusText,
          });
          return;
        }

        const result = (await response.json()) as ResultatImport;
        if (result.status !== 'succes') {
          toast.error('Import refusé', { description: result.message });
          return;
        }

        const rapport = result.rapport;
        if (rapport.nb_lignes_inserees > 0) {
          toast.success(
            `${rapport.nb_lignes_inserees} ligne${rapport.nb_lignes_inserees > 1 ? 's' : ''} importée${rapport.nb_lignes_inserees > 1 ? 's' : ''}`,
            {
              description:
                rapport.erreurs.length > 0
                  ? `${rapport.erreurs.length} erreur(s) — voir le rapport.`
                  : 'Aucune erreur.',
            },
          );
        } else if (rapport.erreurs.length > 0) {
          toast.error('Aucune ligne importée', {
            description: `${rapport.erreurs.length} erreur(s) — voir le rapport.`,
          });
        } else {
          toast.info('Fichier vide', { description: 'Aucune ligne de données détectée.' });
        }

        onRapport(rapport);
        setFichier(null);
        if (inputRef.current) inputRef.current.value = '';
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur réseau';
        toast.error('Import impossible', { description: msg });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titre}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent/30',
            pending && 'pointer-events-none opacity-60',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFichierSelectionne(f);
            }}
            disabled={pending}
          />
          {fichier ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="text-primary size-8" aria-hidden />
              <p className="text-sm font-medium">{fichier.name}</p>
              <p className="text-muted-foreground text-xs">{(fichier.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="text-muted-foreground size-8" aria-hidden />
              <p className="text-sm">Glissez votre fichier .xlsx ici ou cliquez pour parcourir</p>
              <p className="text-muted-foreground text-xs">Maximum {MAX_TAILLE_MO} MB</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {templateLabel && (
            <p className="text-muted-foreground text-xs">
              💡 {templateLabel} — utilisez le bouton « Exporter vers Excel » de la liste pour
              récupérer un modèle.
            </p>
          )}
          <Button
            type="button"
            onClick={handleLancerImport}
            disabled={!fichier || pending}
            className="gap-2"
          >
            {pending ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Import en cours…
              </>
            ) : (
              <>
                <Upload aria-hidden className="size-4" />
                Lancer l’import
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PetitBadgeStatut({ rapport }: { rapport: RapportImport }) {
  const ok = rapport.nb_lignes_inserees > 0 && rapport.erreurs.length === 0;
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
        <CheckCircle2 aria-hidden className="size-3" />
        {rapport.nb_lignes_inserees} importé(s)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
      <AlertCircle aria-hidden className="size-3" />
      {rapport.nb_lignes_inserees} importé(s) · {rapport.erreurs.length} erreur(s)
    </span>
  );
}
