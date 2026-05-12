'use client';

import { useState, useRef, useTransition } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type {
  RapportImport,
  RapportImportEnrichi,
  ResultatImport,
  ResultatImportEnrichi,
} from '@/lib/imports/types';

/** Discrimine entre rapport classique (RapportImport) et enrichi. */
function estEnrichi(r: RapportImport | RapportImportEnrichi): r is RapportImportEnrichi {
  return 'nb_inserees' in r;
}

export type ZoneUploadImportProps = {
  /** Endpoint POST qui accepte multipart/form-data avec champ `fichier`. */
  endpoint: string;
  titre: string;
  description: string;
  /** Nom de fichier modèle pour le lien « Télécharger le template ». */
  templateLabel?: string;
  /** Callback quand un import réussit (avec rapport). */
  onRapport: (rapport: RapportImport | RapportImportEnrichi) => void;
  /**
   * Endpoint IA optionnel — si fourni, accepte les formats PDF/DOCX/TXT
   * en plus de XLSX. Un toggle « Analyser avec IA » apparaît quand un
   * fichier non-Excel est sélectionné.
   */
  endpointIA?: string;
  /** Si true, signale que le module Import IA est activé pour l'utilisateur courant. */
  iaDispo?: boolean;
};

const MAX_TAILLE_MO = 5;
const EXTENSIONS_IA = ['.pdf', '.docx', '.txt'];

export function ZoneUploadImport({
  endpoint,
  titre,
  description,
  templateLabel,
  onRapport,
  endpointIA,
  iaDispo,
}: ZoneUploadImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const [analyserAvecIA, setAnalyserAvecIA] = useState(false);

  // État du popup "Réessayer avec l'IA"
  type SuggestionIA = {
    fichierEnCours: File;
    nbTotal: number;
    nbImportees: number;
    nbErreurs: number;
  };
  const [suggestionIA, setSuggestionIA] = useState<SuggestionIA | null>(null);

  const iaActivable = Boolean(endpointIA) && Boolean(iaDispo);

  const estFichierIA = (f: File): boolean => {
    const nom = f.name.toLowerCase();
    return EXTENSIONS_IA.some((ext) => nom.endsWith(ext));
  };

  const validerFichier = (f: File): string | null => {
    const nom = f.name.toLowerCase();
    // Accepter .xlsx ET .xlsm (format envoyé par les coordonnateurs OIF)
    const estExcel = nom.endsWith('.xlsx') || nom.endsWith('.xlsm') || nom.endsWith('.xlsb');
    const estIA = estFichierIA(f);

    if (!estExcel && !estIA) {
      if (iaActivable) {
        return 'Format attendu : .xlsx ou .xlsm (Excel) ou .pdf / .docx / .txt (analyse IA).';
      }
      return 'Format attendu : .xlsx ou .xlsm (Excel).';
    }
    if (estIA && !iaActivable) {
      return 'Le format détecté requiert l\'analyse IA, désactivée pour votre rôle. Demandez l\'activation au super_admin.';
    }
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
    // Active automatiquement l'IA si fichier non-Excel (PDF/DOCX/TXT)
    if (estFichierIA(f) && iaActivable) {
      setAnalyserAvecIA(true);
    } else {
      setAnalyserAvecIA(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFichierSelectionne(f);
  };

  const handleLancerImport = () => {
    if (!fichier) return;
    // Endpoint = endpointIA si toggle activé et un endpointIA est dispo,
    // sinon l'endpoint Excel classique.
    const endpointEffectif = analyserAvecIA && endpointIA ? endpointIA : endpoint;
    startTransition(async () => {
      const formData = new FormData();
      formData.append('fichier', fichier);

      try {
        const response = await fetch(endpointEffectif, {
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

        const result = (await response.json()) as ResultatImport | ResultatImportEnrichi;
        if (result.status !== 'succes') {
          toast.error('Import refusé', { description: result.message });
          return;
        }

        const rapport = result.rapport;
        const nbImportees = estEnrichi(rapport)
          ? rapport.nb_inserees + rapport.nb_enrichies + rapport.nb_incompletes
          : rapport.nb_lignes_inserees;
        const nbErreurs = estEnrichi(rapport)
          ? rapport.nb_rejetees
          : rapport.erreurs.length;
        const nbTotal = estEnrichi(rapport)
          ? rapport.nb_lignes_total
          : rapport.nb_lignes_total;

        if (nbImportees > 0) {
          toast.success(
            `${nbImportees} ligne${nbImportees > 1 ? 's' : ''} importée${nbImportees > 1 ? 's' : ''}`,
            {
              description:
                nbErreurs > 0
                  ? `${nbErreurs} erreur(s) – voir le rapport.`
                  : estEnrichi(rapport) && rapport.nb_incompletes > 0
                    ? `Dont ${rapport.nb_incompletes} incomplète(s).`
                    : 'Aucune erreur.',
            },
          );
        } else if (nbErreurs > 0) {
          toast.error('Aucune ligne importée', {
            description: `${nbErreurs} erreur(s) – voir le rapport.`,
          });
        } else {
          toast.info('Fichier vide', { description: 'Aucune ligne de données détectée.' });
        }

        onRapport(rapport);

        // ── Suggestion IA ──────────────────────────────────────────────
        // Proposer de réessayer avec l'IA si :
        //   1. L'import venait d'un fichier Excel (pas déjà via IA)
        //   2. Le module IA est activé (iaActivable)
        //   3. Le résultat est "difficile" :
        //      - Aucune ligne importée avec des erreurs, OU
        //      - Taux d'erreur > 30 % sur au moins 5 lignes
        const etaitImportExcel = !analyserAvecIA;
        const importDifficile =
          (nbImportees === 0 && nbErreurs > 0) ||
          (nbTotal >= 5 && nbErreurs / nbTotal > 0.3);

        if (iaActivable && etaitImportExcel && importDifficile && fichier) {
          setSuggestionIA({ fichierEnCours: fichier, nbTotal, nbImportees, nbErreurs });
        } else {
          setFichier(null);
          if (inputRef.current) inputRef.current.value = '';
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur réseau';
        toast.error('Import impossible', { description: msg });
      }
    });
  };

  // Relance le fichier vers l'endpoint IA depuis le popup de suggestion
  const handleRelancerAvecIA = () => {
    if (!suggestionIA || !endpointIA) return;
    const fichierIA = suggestionIA.fichierEnCours;
    setSuggestionIA(null);
    setFichier(null);
    if (inputRef.current) inputRef.current.value = '';

    startTransition(async () => {
      const formData = new FormData();
      formData.append('fichier', fichierIA);
      try {
        const response = await fetch(endpointIA, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
        });
        if (!response.ok) {
          const errPayload = await response.json().catch(() => ({ erreur: response.statusText }));
          toast.error('Analyse IA impossible', {
            description: errPayload.erreur ?? response.statusText,
          });
          return;
        }
        const result = (await response.json()) as ResultatImport | ResultatImportEnrichi;
        if (result.status !== 'succes') {
          toast.error('Analyse IA refusée', { description: result.message });
          return;
        }
        const rapport = result.rapport;
        const nbIA = estEnrichi(rapport)
          ? rapport.nb_inserees + rapport.nb_enrichies + rapport.nb_incompletes
          : rapport.nb_lignes_inserees;
        toast.success(
          `IA : ${nbIA} ligne${nbIA > 1 ? 's' : ''} extraite${nbIA > 1 ? 's' : ''}`,
          { description: 'Voir le rapport pour le détail.' },
        );
        onRapport(rapport);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur réseau';
        toast.error('Analyse IA impossible', { description: msg });
      }
    });
  };

  return (
    <>
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
            accept={
              iaActivable
                ? '.xlsx,.xlsm,.pdf,.docx,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12'
                : '.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12'
            }
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFichierSelectionne(f);
            }}
            disabled={pending}
          />
          {fichier ? (
            <div className="flex flex-col items-center gap-2">
              {estFichierIA(fichier) ? (
                <Sparkles className="size-8 text-[#5D0073]" aria-hidden />
              ) : (
                <FileSpreadsheet className="text-primary size-8" aria-hidden />
              )}
              <p className="text-sm font-medium">{fichier.name}</p>
              <p className="text-muted-foreground text-xs">{(fichier.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="text-muted-foreground size-8" aria-hidden />
              <p className="text-sm">
                Glissez votre fichier {iaActivable ? '(.xlsx, .xlsm, .pdf, .docx, .txt) ' : '.xlsx ou .xlsm '}
                ici ou cliquez pour parcourir
              </p>
              <p className="text-muted-foreground text-xs">Maximum {MAX_TAILLE_MO} MB</p>
            </div>
          )}
        </div>

        {/* Toggle IA — visible uniquement si un fichier non-Excel est sélectionné
            et que l'utilisateur a le module Import IA activé. */}
        {fichier && estFichierIA(fichier) && iaActivable && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <label
              htmlFor={`ia-toggle-${endpoint}`}
              className="flex cursor-pointer items-start justify-between gap-3"
            >
              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-purple-900">
                  <Sparkles className="size-4" aria-hidden />
                  Analyser avec IA
                </span>
                <span className="mt-1 block text-xs text-purple-700">
                  Claude Haiku 4.5 extrait les bénéficiaires du document et les structure
                  automatiquement. ~200 tokens estimés. Le rapport indique le score de
                  confiance par ligne.
                </span>
              </span>
              <Switch
                id={`ia-toggle-${endpoint}`}
                checked={analyserAvecIA}
                onCheckedChange={setAnalyserAvecIA}
                disabled={pending}
              />
            </label>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {templateLabel && (
            <p className="text-muted-foreground text-xs">
              💡 {templateLabel} – utilisez le bouton « Exporter vers Excel » de la liste pour
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

    {/* ── Dialog : proposition de relance IA ───────────────────────── */}
    <Dialog
      open={Boolean(suggestionIA)}
      onOpenChange={(open) => {
        if (!open) {
          setSuggestionIA(null);
          setFichier(null);
          if (inputRef.current) inputRef.current.value = '';
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-5 text-[#5D0073]" aria-hidden />
            Import difficile — essayer avec l'IA ?
          </DialogTitle>
          <DialogDescription className="sr-only">Proposition de réessayer l'import avec l'IA</DialogDescription>
          <div className="space-y-3 pt-1 text-sm">
            <div>
              <p>
                L'import Excel standard a rencontré des difficultés sur ce fichier :
              </p>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                <ul className="space-y-1 text-amber-900 dark:text-amber-300">
                  <li>
                    <span className="font-semibold">{suggestionIA?.nbImportees ?? 0}</span> ligne
                    {(suggestionIA?.nbImportees ?? 0) !== 1 ? 's' : ''} importée
                    {(suggestionIA?.nbImportees ?? 0) !== 1 ? 's' : ''}
                  </li>
                  <li>
                    <span className="font-semibold">{suggestionIA?.nbErreurs ?? 0}</span> erreur
                    {(suggestionIA?.nbErreurs ?? 0) !== 1 ? 's' : ''} détectée
                    {(suggestionIA?.nbErreurs ?? 0) !== 1 ? 's' : ''}
                  </li>
                </ul>
              </div>
              <p>
                Le module IA (Claude Haiku) peut analyser ce fichier différemment — il lit le
                contenu sans se soucier du format exact des colonnes, et reconnaît les valeurs
                en texte libre.
              </p>
              <p className="text-muted-foreground text-xs">
                Disponible pour les comptes administrateurs. Les lignes extraites passeront
                dans le même pipeline de validation.
              </p>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSuggestionIA(null);
              setFichier(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            Ignorer
          </Button>
          <Button
            type="button"
            onClick={handleRelancerAvecIA}
            disabled={pending}
            className="gap-2 bg-[#5D0073] hover:bg-[#5D0073]/90 text-white"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Analyse en cours…
              </>
            ) : (
              <>
                <Sparkles className="size-4" aria-hidden />
                Analyser avec l'IA
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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
