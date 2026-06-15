'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2, Sparkles, ArrowLeft, Info } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { enregistrerSaisiesLot } from '@/lib/indicateurs-annuels/server-actions';

type ValeurExtraite = {
  code: string;
  libelle: string;
  annee: number;
  valeur: number;
  est_taux: boolean;
  auto: boolean;
  note: string;
  confiance: number;
};

type LigneEditable = ValeurExtraite & { inclure: boolean };

const EXTENSIONS = ['.pdf', '.docx', '.txt', '.xlsx', '.xlsm'];

export function ImportRapportClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [fichier, setFichier] = useState<File | null>(null);
  const [extraction, startExtraction] = useTransition();
  const [enregistrement, startEnregistrement] = useTransition();
  const [lignes, setLignes] = useState<LigneEditable[] | null>(null);
  const [notes, setNotes] = useState<string>('');

  const choisirFichier = (f: File) => {
    const nom = f.name.toLowerCase();
    if (!EXTENSIONS.some((e) => nom.endsWith(e))) {
      toast.error('Format non supporté', { description: 'Acceptés : PDF, DOCX, TXT, XLSX.' });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 MB).');
      return;
    }
    setFichier(f);
    setLignes(null);
  };

  const lancerExtraction = () => {
    if (!fichier) return;
    startExtraction(async () => {
      try {
        const fd = new FormData();
        fd.append('fichier', fichier);
        const res = await fetch('/api/imports/rapport-indicateurs', {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
        });
        const data = await res.json().catch(() => ({ erreur: res.statusText }));
        if (!res.ok) {
          toast.error('Extraction impossible', { description: data.erreur ?? res.statusText });
          return;
        }
        const valeurs = (data.valeurs ?? []) as ValeurExtraite[];
        if (valeurs.length === 0) {
          toast.info('Aucune valeur détectée', {
            description: 'Le rapport ne contient pas de valeurs d’ensemble reconnaissables.',
          });
        }
        // Par défaut on écarte les indicateurs auto-calculés (A1/B1).
        setLignes(valeurs.map((v) => ({ ...v, inclure: !v.auto })));
        setNotes(data.notes ?? '');
      } catch (err) {
        toast.error('Erreur réseau', {
          description: err instanceof Error ? err.message : 'inconnue',
        });
      }
    });
  };

  const majLigne = (code: string, patch: Partial<LigneEditable>) => {
    setLignes((prev) => prev?.map((l) => (l.code === code ? { ...l, ...patch } : l)) ?? prev);
  };

  const enregistrer = (publier: boolean) => {
    if (!lignes) return;
    const aEnregistrer = lignes.filter((l) => l.inclure);
    if (aEnregistrer.length === 0) {
      toast.error('Aucune ligne sélectionnée.');
      return;
    }
    startEnregistrement(async () => {
      const res = await enregistrerSaisiesLot({
        lignes: aEnregistrer.map((l) => ({
          code: l.code,
          annee: l.annee,
          valeur_directe: l.valeur,
          note: l.note || null,
        })),
        publier,
      });
      if (res.status === 'erreur') {
        toast.error('Enregistrement impossible', { description: res.message });
        return;
      }
      const desc = publier
        ? `${res.nb_publiees} publiée(s) sur ${res.nb_enregistrees} enregistrée(s).`
        : `${res.nb_enregistrees} valeur(s) en brouillon.`;
      if (res.erreurs.length > 0) {
        toast.warning(`${res.nb_enregistrees} enregistrée(s), ${res.erreurs.length} en échec`, {
          description: res.erreurs.slice(0, 3).join(' · '),
        });
      } else {
        toast.success('Indicateurs mis à jour', { description: desc });
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/indicateurs"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Retour aux indicateurs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Importer un rapport d’indicateurs</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Chargez un rapport d’enquête (PDF, Word, texte ou Excel). L’IA extrait les valeurs d’
          <strong>ensemble</strong> des indicateurs <strong>non calculables automatiquement</strong>{' '}
          (A2–A5, B2–B4, C, D, F1). Vous validez avant enregistrement.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Fichier source</CardTitle>
          <CardDescription>Formats : PDF, DOCX, TXT, XLSX — max 10 MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) choisirFichier(f);
            }}
            className="border-input hover:bg-muted/40 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center"
          >
            {fichier ? (
              <>
                <FileText className="size-8" aria-hidden />
                <span className="font-medium">{fichier.name}</span>
                <span className="text-muted-foreground text-xs">
                  {(fichier.size / 1024).toFixed(0)} KB
                </span>
              </>
            ) : (
              <>
                <Upload className="size-8" aria-hidden />
                <span>Glissez un rapport ici ou cliquez pour parcourir</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={EXTENSIONS.join(',')}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) choisirFichier(f);
              }}
            />
          </div>
          <Button
            type="button"
            onClick={lancerExtraction}
            disabled={!fichier || extraction}
            className="gap-2"
          >
            {extraction ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {extraction ? 'Analyse en cours…' : 'Analyser avec l’IA'}
          </Button>
        </CardContent>
      </Card>

      {lignes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Valeurs détectées — à valider</CardTitle>
            {notes && (
              <CardDescription className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                {notes}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {lignes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune valeur exploitable détectée.</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Inclure</TableHead>
                        <TableHead>Indicateur</TableHead>
                        <TableHead className="w-24">Année</TableHead>
                        <TableHead className="w-32">Valeur</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lignes.map((l) => (
                        <TableRow key={l.code} className={l.auto ? 'opacity-60' : undefined}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={l.inclure}
                              onChange={(e) => majLigne(l.code, { inclure: e.target.checked })}
                              aria-label={`Inclure ${l.code}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">
                                {l.code}
                              </Badge>
                              <span className="text-sm">{l.libelle}</span>
                              {l.auto && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 text-amber-700"
                                  title="Indicateur calculé automatiquement depuis vos imports — saisie déconseillée"
                                >
                                  auto-calculé
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <input
                              type="number"
                              value={l.annee}
                              onChange={(e) =>
                                majLigne(l.code, { annee: Number(e.target.value) || l.annee })
                              }
                              className="border-input w-20 rounded border bg-transparent px-2 py-1 text-sm tabular-nums"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                value={l.valeur}
                                onChange={(e) =>
                                  majLigne(l.code, { valeur: Number(e.target.value) })
                                }
                                className="border-input w-24 rounded border bg-transparent px-2 py-1 text-sm tabular-nums"
                              />
                              {l.est_taux && (
                                <span className="text-muted-foreground text-xs">%</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[16rem] truncate text-xs">
                            {l.note || '–'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <p className="text-muted-foreground text-xs">
                  Les indicateurs « auto-calculé » (A1, B1) sont décochés par défaut : leurs valeurs
                  proviennent de vos imports bénéficiaires/structures. « Brouillon » enregistre sans
                  publier ; « Enregistrer et publier » rend les valeurs visibles publiquement.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => enregistrer(false)}
                    disabled={enregistrement}
                    className="gap-2"
                  >
                    {enregistrement && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    Enregistrer en brouillon
                  </Button>
                  <Button
                    type="button"
                    onClick={() => enregistrer(true)}
                    disabled={enregistrement}
                    className="gap-2"
                  >
                    {enregistrement && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    Enregistrer et publier
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
