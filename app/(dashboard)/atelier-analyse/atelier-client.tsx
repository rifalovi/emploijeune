'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCheck,
  Database,
  Download,
  FileText,
  FlaskConical,
  ListChecks,
  Loader2,
  Search,
  Sigma,
  Sparkles,
  SquareDashed,
  Table2,
  Upload,
  Wand2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/ia/markdown-renderer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { couleurRang, tooltipPropsPremium } from '@/lib/design/charts';

import {
  chargerDatasetEnqueteAction,
  enregistrerTraitementAction,
} from '@/lib/atelier-analyse/actions';
import {
  analyzeDataset,
  computeClean,
  computeCrosstab,
  computeFrequency,
  computeMulti,
  computeStatTest,
  ingestFile,
  uploadSpssFile,
  type ComputeSource,
} from '@/lib/atelier-analyse/api-client';
import { genererRapportAction } from '@/lib/atelier-analyse/rapport';
import {
  exporterCrossExcel,
  exporterFreqExcel,
  exporterGlobalExcel,
  exporterMultiExcel,
} from '@/lib/atelier-analyse/exports';
import { exporterRapportWord, exporterResultatsWord } from '@/lib/atelier-analyse/word-export';
import { exporterRapportPdf } from '@/lib/atelier-analyse/pdf-export';
import { FORMATS_RAPPORT } from '@/lib/atelier-analyse/types';
import type {
  AnalyzeResponse,
  CleanResponse,
  CrosstabResponse,
  DatasetInput,
  FormatRapport,
  FrequencyResponse,
  HistoriqueJob,
  IndicateurSource,
  MultiResponse,
  StatTestResponse,
} from '@/lib/atelier-analyse/types';

const AUCUNE = '__aucune__';

function pct(v: number | null): string {
  return v === null || v === undefined ? '' : `${(v * 100).toFixed(1)} %`;
}

/** Types de mesure du moteur, avec libellé court et teinte de badge. */
const MESURES: Record<string, { court: string; classe: string }> = {
  NOMINAL: { court: 'Nom.', classe: 'bg-sky-100 text-sky-800' },
  ORDINAL: { court: 'Ord.', classe: 'bg-violet-100 text-violet-800' },
  ÉCHELLE: { court: 'Éch.', classe: 'bg-emerald-100 text-emerald-800' },
};

// Motifs de variables « techniques » (identifiants, métadonnées d'entretien…)
// exclues de la présélection par défaut.
const MOTIFS_TECHNIQUES =
  /\b(id|ids|identifier|identifiant|uuid|guid|index|clé|cle|key|random|al[ée]atoire|interview|entretien|assignment|submission|instance|timestamp|status|statut|errors?\s*count|duration|dur[ée]e|d[ée]but|start|end|latitude|longitude|gps|geopoint|deviceid|version)\b/i;

/** Une variable est « technique » (peu pertinente pour un tri à plat direct). */
function estVariableTechnique(
  v: { name: string; display: string; cardinality: number },
  nRows: number,
): boolean {
  if (MOTIFS_TECHNIQUES.test(`${v.name} ${v.display}`)) return true;
  // Identifiant / texte libre : cardinalité quasi unique ou très élevée.
  if (v.cardinality > 100) return true;
  if (nRows > 0 && v.cardinality >= 0.9 * nRows) return true;
  return false;
}

/** Présélection intelligente : variables analysables, hors variables techniques. */
function preselectionIntelligente(
  variables: { name: string; display: string; cardinality: number }[],
  nRows: number,
): string[] {
  const retenues = variables.filter((v) => !estVariableTechnique(v, nRows)).map((v) => v.name);
  // Repli : si tout a été exclu, on garde les 20 premières pour ne pas bloquer.
  return retenues.length > 0 ? retenues : variables.slice(0, 20).map((v) => v.name);
}

// ------------------------------------------------------------------ Exports
/** Déclenche le téléchargement d'un fichier texte (CSV/Markdown) côté navigateur. */
function telechargerFichier(nom: string, contenu: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['﻿' + contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Convertit des enregistrements en CSV (séparateur « ; », compatible Excel FR). */
function versCsv(rows: Record<string, unknown>[], colonnes?: string[]): string {
  if (rows.length === 0) return '';
  const cols = colonnes ?? Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
}

/** Nom de fichier sûr (accents/espaces/ponctuation remplacés). */
function nomSur(base: string): string {
  return base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

type Props = {
  indicateurs: IndicateurSource[];
  historique: { jobs: HistoriqueJob[]; erreur: string | null };
};

export function AtelierClient({ indicateurs, historique }: Props) {
  const router = useRouter();
  const [sourceMode, setSourceMode] = useState<'enquete' | 'fichier'>('enquete');
  const [indicateur, setIndicateur] = useState('');
  const [dataset, setDataset] = useState<DatasetInput | null>(null);
  const [datasetRef, setDatasetRef] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [fichierNom, setFichierNom] = useState('');
  const [analyse, setAnalyse] = useState<AnalyzeResponse | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Tris à plat
  const [varsSel, setVarsSel] = useState<string[]>([]);
  const [exclure, setExclure] = useState(false);
  const [freq, setFreq] = useState<FrequencyResponse | null>(null);
  const [busyFreq, setBusyFreq] = useState(false);

  // Croisements
  const [row, setRow] = useState('');
  const [col, setCol] = useState('');
  const [layer, setLayer] = useState(AUCUNE);
  const [pctMode, setPctMode] = useState<'Ligne' | 'Colonne'>('Ligne');
  const [cross, setCross] = useState<CrosstabResponse | null>(null);
  const [busyCross, setBusyCross] = useState(false);

  // Tests statistiques (Khi² / Welch)
  const [statRow, setStatRow] = useState('');
  const [statCol, setStatCol] = useState('');
  const [stat, setStat] = useState<StatTestResponse | null>(null);
  const [busyStat, setBusyStat] = useState(false);

  // Réponses multiples (batteries 0/1)
  const [multi, setMulti] = useState<MultiResponse | null>(null);
  const [busyMulti, setBusyMulti] = useState(false);

  // Nettoyage / épuration de la base
  const [dropEmpty, setDropEmpty] = useState(true);
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [clean, setClean] = useState<CleanResponse | null>(null);
  const [busyClean, setBusyClean] = useState(false);

  // Rapport (API Claude)
  const [formatRapport, setFormatRapport] = useState<FormatRapport>('synthese');
  const [consignes, setConsignes] = useState('');
  const [rapport, setRapport] = useState<string | null>(null);
  const [busyRapport, setBusyRapport] = useState(false);

  const variables = analyse?.variables ?? [];

  // Libellé lisible d'une variable (question posée) à partir de son code.
  const libelleVariable = (code: string) => variables.find((v) => v.name === code)?.display ?? code;

  // Enveloppe d'export : signale une éventuelle erreur sans casser l'UI.
  const exporter = (fn: () => Promise<void>) =>
    fn().catch((e) => setErreur(e instanceof Error ? e.message : 'Export impossible.'));

  const aDesResultats = Boolean(freq || cross || multi || stat);

  // Source active des calculs (enquête en ligne ou fichier importé).
  const source: ComputeSource | null = datasetRef ? { datasetRef } : dataset ? { dataset } : null;
  const sourceKind = datasetRef ? 'upload' : 'enquete';
  const sourceRef = datasetRef ? fichierNom : indicateur;
  const sourceLabel = datasetRef
    ? fichierNom
    : (indicateurs.find((i) => i.code === indicateur)?.libelle ?? indicateur);

  function reinitAnalyse() {
    setFreq(null);
    setCross(null);
    setStat(null);
    setMulti(null);
    setClean(null);
    setRapport(null);
    setAnalyse(null);
  }

  function appliquerAnalyse(a: AnalyzeResponse) {
    setAnalyse(a);
    setVarsSel(preselectionIntelligente(a.variables, a.n_rows));
    // Défauts de croisement/tests : premières variables non techniques.
    const analysables = a.variables.filter((v) => !estVariableTechnique(v, a.n_rows));
    const first = (analysables[0] ?? a.variables[0])?.name ?? '';
    const second =
      (analysables[1] ?? analysables[0] ?? a.variables[1] ?? a.variables[0])?.name ?? '';
    setRow(first);
    setCol(second);
    setStatRow(first);
    setStatCol(second);
  }

  async function charger() {
    if (!indicateur) return;
    setChargement(true);
    setErreur(null);
    reinitAnalyse();
    try {
      const ds = await chargerDatasetEnqueteAction(indicateur);
      if (ds.rows.length === 0) {
        setErreur('Aucune réponse d’enquête pour cet indicateur.');
        return;
      }
      setDataset(ds);
      setDatasetRef(null);
      appliquerAnalyse(await analyzeDataset(ds));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setChargement(false);
    }
  }

  async function chargerFichier() {
    if (!fichier) return;
    setChargement(true);
    setErreur(null);
    reinitAnalyse();
    try {
      const path = await uploadSpssFile(fichier);
      const res = await ingestFile(path);
      setDatasetRef(res.dataset_ref);
      setDataset(null);
      setFichierNom(res.name || fichier.name);
      appliquerAnalyse(res);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setChargement(false);
    }
  }

  async function lancerFreq() {
    if (!source || varsSel.length === 0) return;
    setBusyFreq(true);
    setErreur(null);
    try {
      const res = await computeFrequency(source, varsSel, exclure);
      setFreq(res);
      // Enregistrement best-effort dans l'historique (n'interrompt pas l'analyse).
      await enregistrerTraitementAction({
        type: 'frequency',
        titre: `Tris à plat — ${varsSel.length} variable(s)`,
        source: sourceKind,
        source_ref: sourceRef,
        params: { cols: varsSel, exclure, source: sourceRef },
        payload: res as unknown as Record<string, unknown>,
        apercu: `${varsSel.length} variable(s)`,
      });
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyFreq(false);
    }
  }

  async function lancerCross() {
    if (!source || !row || !col) return;
    setBusyCross(true);
    setErreur(null);
    try {
      const lyr = layer === AUCUNE ? null : layer;
      const res = await computeCrosstab(source, row, col, lyr, pctMode);
      setCross(res);
      await enregistrerTraitementAction({
        type: 'crosstab',
        titre: `Croisement ${row} × ${col}`,
        source: sourceKind,
        source_ref: sourceRef,
        params: { row, col, layer: lyr, pctMode, source: sourceRef },
        payload: res as unknown as Record<string, unknown>,
        apercu: `${res.layers.length} table(s)`,
      });
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyCross(false);
    }
  }

  async function lancerStat() {
    if (!source || !statRow || !statCol) return;
    setBusyStat(true);
    setErreur(null);
    try {
      const res = await computeStatTest(source, statRow, statCol);
      setStat(res);
      await enregistrerTraitementAction({
        type: 'stat_test',
        titre: `Tests statistiques ${statRow} × ${statCol}`,
        source: sourceKind,
        source_ref: sourceRef,
        params: { row: statRow, col: statCol, source: sourceRef },
        payload: res as unknown as Record<string, unknown>,
        apercu: [
          res.chi_square.applicable ? `χ² p=${res.chi_square.p.toFixed(4)}` : 'χ² n/a',
          res.welch_ttest.applicable ? `t p=${res.welch_ttest.p.toFixed(4)}` : 't n/a',
        ].join(' · '),
      });
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyStat(false);
    }
  }

  async function lancerMulti() {
    if (!source) return;
    setBusyMulti(true);
    setErreur(null);
    try {
      const res = await computeMulti(source);
      setMulti(res);
      const nb = Object.keys(res.tables).length;
      if (nb > 0) {
        await enregistrerTraitementAction({
          type: 'multi',
          titre: `Réponses multiples — ${nb} batterie(s)`,
          source: sourceKind,
          source_ref: sourceRef,
          params: { source: sourceRef },
          payload: res as unknown as Record<string, unknown>,
          apercu: `${nb} batterie(s)`,
        });
        router.refresh();
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyMulti(false);
    }
  }

  async function lancerClean() {
    if (!source) return;
    setBusyClean(true);
    setErreur(null);
    try {
      const res = await computeClean(source, { dropEmpty, dropDuplicates });
      setClean(res);
      await enregistrerTraitementAction({
        type: 'cleaning',
        titre: `Base épurée — ${res.n_rows_cleaned}/${res.n_rows_source} lignes`,
        source: sourceKind,
        source_ref: sourceRef,
        params: { drop_empty: dropEmpty, drop_duplicates: dropDuplicates, source: sourceRef },
        apercu: `${res.n_removed} ligne(s) retirée(s)`,
      });
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyClean(false);
    }
  }

  async function lancerRapport() {
    if (!freq && !cross) return;
    setBusyRapport(true);
    setErreur(null);
    try {
      const res = await genererRapportAction({
        indicateur: sourceRef,
        indicateurLibelle: sourceLabel,
        format: formatRapport,
        consignes: consignes || undefined,
        frequences: freq,
        croisement: cross,
      });
      if (res.status === 'succes') {
        setRapport(res.rapport);
        router.refresh();
      } else {
        setErreur(res.message);
      }
    } finally {
      setBusyRapport(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Source de données */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" /> Source des données
          </CardTitle>
          <CardDescription>
            Analysez les réponses d’enquête de la plateforme, ou importez un fichier : SPSS (.sav),
            Excel (.xlsx, .xls), LibreOffice (.ods), CSV/TSV/TAB, JSON, tableau Word (.docx), et
            tout export Kobo/CSPro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Choix de la source */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={sourceMode === 'enquete' ? 'default' : 'outline'}
              onClick={() => setSourceMode('enquete')}
            >
              <Database className="size-4" /> Depuis une enquête
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sourceMode === 'fichier' ? 'default' : 'outline'}
              onClick={() => setSourceMode('fichier')}
            >
              <Upload className="size-4" /> Importer un fichier
            </Button>
          </div>

          {sourceMode === 'enquete' ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <Select value={indicateur} onValueChange={(v) => setIndicateur(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un indicateur…" />
                  </SelectTrigger>
                  <SelectContent>
                    {indicateurs.map((i) => (
                      <SelectItem key={i.code} value={i.code}>
                        {i.libelle} [{i.code}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={charger} disabled={!indicateur || chargement}>
                {chargement ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FlaskConical className="size-4" />
                )}
                Charger
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <input
                type="file"
                accept=".sav,.xlsx,.xls,.ods,.csv,.tsv,.tab,.json,.docx"
                onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                className="file:border-input file:bg-background text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
              />
              <Button onClick={chargerFichier} disabled={!fichier || chargement}>
                {chargement ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Importer et analyser
              </Button>
            </div>
          )}

          {analyse && (
            <Badge variant="secondary">
              {datasetRef ? fichierNom : `${analyse.n_rows} réponses`} · {analyse.n_rows} lignes ·{' '}
              {variables.length} variables
            </Badge>
          )}
        </CardContent>
      </Card>

      {erreur && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {erreur}
        </div>
      )}

      {/* Espace d'analyse — rail des commandes (façon DataStudio desktop) + panneau */}
      {analyse && source && (
        <Tabs
          defaultValue="freq"
          orientation="vertical"
          className="grid items-start gap-4 md:grid-cols-[220px_minmax(0,1fr)]"
        >
          <div className="space-y-3 md:sticky md:top-4">
            <div className="bg-muted/40 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs font-medium">Jeu de données</p>
              <p className="mt-1 truncate text-sm font-semibold" title={sourceLabel}>
                {sourceLabel}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {analyse.n_rows} lignes · {variables.length} variables
              </p>
            </div>
            <p className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
              Commandes
            </p>
            <TabsList className="flex h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
              <TabsTrigger value="freq" className="w-full justify-start gap-2">
                <Sigma className="size-4" /> Tris à plat
              </TabsTrigger>
              <TabsTrigger value="cross" className="w-full justify-start gap-2">
                <Table2 className="size-4" /> Croisements
              </TabsTrigger>
              <TabsTrigger value="stat" className="w-full justify-start gap-2">
                <Sparkles className="size-4" /> Tests statistiques
              </TabsTrigger>
              <TabsTrigger value="multi" className="w-full justify-start gap-2">
                <ListChecks className="size-4" /> Réponses multiples
              </TabsTrigger>
              <TabsTrigger value="clean" className="w-full justify-start gap-2">
                <Wand2 className="size-4" /> Nettoyage
              </TabsTrigger>
              <TabsTrigger value="rapport" className="w-full justify-start gap-2">
                <FileText className="size-4" /> Rapport
              </TabsTrigger>
            </TabsList>
            <Separator />
            <p className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
              Exporter
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={!aDesResultats}
              onClick={() =>
                exporter(() =>
                  exporterGlobalExcel({
                    freq,
                    cross,
                    multi,
                    stat,
                    statRow,
                    statCol,
                    libelle: libelleVariable,
                    nomFichier: `export_global_${nomSur(sourceRef || 'datastudio')}.xlsx`,
                  }),
                )
              }
            >
              <Download className="size-4" /> Excel global
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={!aDesResultats && !rapport}
              onClick={() =>
                exporter(() =>
                  exporterResultatsWord({
                    freq,
                    cross,
                    multi,
                    stat,
                    statRow,
                    statCol,
                    rapport,
                    libelle: libelleVariable,
                    source: sourceLabel,
                    nomFichier: `rapport_analyse_${nomSur(sourceRef || 'datastudio')}.docx`,
                  }),
                )
              }
            >
              <FileText className="size-4" /> Word documenté
            </Button>
          </div>

          {/* --- Tris à plat --- */}
          <TabsContent value="freq" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tris à plat</CardTitle>
                <CardDescription>
                  Choisissez les variables à analyser. Recherchez, filtrez par type de mesure ou
                  sélectionnez en masse. Les variables techniques (identifiants, métadonnées) sont
                  décochées par défaut.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <VariablePicker variables={variables} selected={varsSel} onChange={setVarsSel} />
                <Separator />
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={exclure} onCheckedChange={setExclure} />
                    Exclure les valeurs manquantes
                  </label>
                  <Button onClick={lancerFreq} disabled={busyFreq || varsSel.length === 0}>
                    {busyFreq && <Loader2 className="size-4 animate-spin" />}
                    Produire les tris à plat ({varsSel.length})
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1"
                    disabled={!freq}
                    onClick={() => freq && exporter(() => exporterFreqExcel(freq, libelleVariable))}
                  >
                    <Download className="size-4" /> Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {freq &&
              Object.entries(freq.tables).map(([name, rows]) => {
                const chartData = rows
                  .filter((r) => r.Modalité !== 'Total' && r.Modalité !== '[Manquant]')
                  .map((r) => ({ modalite: r.Modalité, effectif: r.Effectif }));
                return (
                  <Card key={name}>
                    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                      <div className="min-w-0">
                        <CardTitle className="text-base">{libelleVariable(name)}</CardTitle>
                        <CardDescription className="font-mono text-xs">{name}</CardDescription>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1"
                        onClick={() =>
                          telechargerFichier(
                            `tri_a_plat_${nomSur(name)}.csv`,
                            versCsv(rows as unknown as Record<string, unknown>[]),
                          )
                        }
                      >
                        <Download className="size-4" /> CSV
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Modalité</TableHead>
                            <TableHead className="text-right">Effectif</TableHead>
                            <TableHead className="text-right">%</TableHead>
                            <TableHead className="text-right">% valide</TableHead>
                            <TableHead className="text-right">% cumulé</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r, idx) => (
                            <TableRow
                              key={idx}
                              className={r.Modalité === 'Total' ? 'font-semibold' : ''}
                            >
                              <TableCell>{r.Modalité}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {r.Effectif}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {pct(r['%'])}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {pct(r['% valide'])}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {pct(r['% cumulé'])}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="modalite"
                              tick={{ fontSize: 11 }}
                              interval={0}
                              angle={-20}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip {...tooltipPropsPremium} />
                            <Bar dataKey="effectif" radius={[4, 4, 0, 0]}>
                              {chartData.map((_, i) => (
                                <Cell key={i} fill={couleurRang(i)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>

          {/* --- Croisements --- */}
          <TabsContent value="cross" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Paramètres du croisement</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <SelectChamp label="Lignes" value={row} onChange={setRow} options={variables} />
                <SelectChamp label="Colonnes" value={col} onChange={setCol} options={variables} />
                <SelectChamp
                  label="Couche"
                  value={layer}
                  onChange={setLayer}
                  options={variables}
                  aucune
                />
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Pourcentages</p>
                  <Select
                    value={pctMode}
                    onValueChange={(v) => setPctMode((v ?? 'Ligne') as 'Ligne' | 'Colonne')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ligne">Ligne</SelectItem>
                      <SelectItem value="Colonne">Colonne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={lancerCross} disabled={busyCross || !row || !col}>
                  {busyCross && <Loader2 className="size-4 animate-spin" />}
                  Croiser
                </Button>
                <Button
                  variant="outline"
                  className="gap-1"
                  disabled={!cross}
                  onClick={() =>
                    cross && exporter(() => exporterCrossExcel(cross, libelleVariable))
                  }
                >
                  <Download className="size-4" /> Excel
                </Button>
              </CardContent>
            </Card>

            {cross &&
              cross.layers.map((lyr, li) => (
                <Card key={li}>
                  <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="text-base">
                        {libelleVariable(cross.row)} × {libelleVariable(cross.col)}
                        {cross.layer ? ` · ${lyr.layer_value}` : ''}
                      </CardTitle>
                      <CardDescription>
                        Base valide : {lyr.base} · pourcentages en {cross.pct_mode.toLowerCase()}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => {
                        const lignes = lyr.index.map((idx, ri) => {
                          const row: Record<string, unknown> = { Modalité: idx };
                          lyr.columns.forEach((c, ci) => {
                            row[c] = lyr.counts[ri]?.[ci] ?? 0;
                          });
                          return row;
                        });
                        telechargerFichier(
                          `croisement_${nomSur(cross.row)}_x_${nomSur(cross.col)}.csv`,
                          versCsv(lignes, ['Modalité', ...lyr.columns]),
                        );
                      }}
                    >
                      <Download className="size-4" /> CSV
                    </Button>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Modalité</TableHead>
                          {lyr.columns.map((c) => (
                            <TableHead key={c} className="text-right">
                              {c}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lyr.index.map((idx, ri) => (
                          <TableRow key={idx} className={idx === 'Total' ? 'font-semibold' : ''}>
                            <TableCell>{idx}</TableCell>
                            {lyr.columns.map((c, ci) => {
                              const eff = lyr.counts[ri]?.[ci] ?? 0;
                              const p = lyr.pct[ri]?.[ci] ?? null;
                              return (
                                <TableCell key={c} className="text-right tabular-nums">
                                  {eff}
                                  {p !== null && p !== undefined && (
                                    <span className="text-muted-foreground">
                                      {' '}
                                      ({(p * 100).toFixed(1)} %)
                                    </span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>

          {/* --- Tests statistiques (Khi² / Welch) --- */}
          <TabsContent value="stat" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tests statistiques</CardTitle>
                <CardDescription>
                  Khi² d’indépendance entre deux variables, et t-test de Welch lorsqu’une variable
                  d’échelle est croisée à une variable à exactement 2 modalités. Valeurs manquantes
                  exclues, seuil de 5 %.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <SelectChamp
                  label="Variable 1"
                  value={statRow}
                  onChange={setStatRow}
                  options={variables}
                />
                <SelectChamp
                  label="Variable 2"
                  value={statCol}
                  onChange={setStatCol}
                  options={variables}
                />
                <Button
                  onClick={lancerStat}
                  disabled={busyStat || !statRow || !statCol || statRow === statCol}
                >
                  {busyStat ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Lancer les tests
                </Button>
              </CardContent>
            </Card>

            {stat && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Khi² d’indépendance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stat.chi_square.applicable ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">χ² = {stat.chi_square.chi2.toFixed(3)}</Badge>
                          <Badge variant="secondary">ddl = {stat.chi_square.dof}</Badge>
                          <Badge variant="secondary">p = {stat.chi_square.p.toFixed(4)}</Badge>
                          <Badge variant={stat.chi_square.significatif ? 'default' : 'outline'}>
                            {stat.chi_square.significatif ? 'Significatif' : 'Non significatif'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">{stat.chi_square.message}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        {stat.chi_square.message}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">t-test de Welch</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stat.welch_ttest.applicable ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">t = {stat.welch_ttest.t.toFixed(3)}</Badge>
                          <Badge variant="secondary">p = {stat.welch_ttest.p.toFixed(4)}</Badge>
                          <Badge variant={stat.welch_ttest.significatif ? 'default' : 'outline'}>
                            {stat.welch_ttest.significatif ? 'Significatif' : 'Non significatif'}
                          </Badge>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Groupe</TableHead>
                              <TableHead className="text-right">Moyenne</TableHead>
                              <TableHead className="text-right">n</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stat.welch_ttest.groups.map((g) => (
                              <TableRow key={g.nom}>
                                <TableCell>{g.nom}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {g.moyenne.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{g.n}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <p className="text-muted-foreground text-sm">{stat.welch_ttest.message}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        {stat.welch_ttest.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* --- Réponses multiples --- */}
          <TabsContent value="multi" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Questions à réponses multiples</CardTitle>
                <CardDescription>
                  Détection automatique des batteries de variables binaires (0/1) partageant un même
                  intitulé. Le total des pourcentages peut dépasser 100 % (plusieurs réponses par
                  répondant).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={lancerMulti} disabled={busyMulti}>
                    {busyMulti ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ListChecks className="size-4" />
                    )}
                    Analyser les réponses multiples
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1"
                    disabled={!multi || Object.keys(multi.tables).length === 0}
                    onClick={() => multi && exporter(() => exporterMultiExcel(multi))}
                  >
                    <Download className="size-4" /> Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {multi && Object.keys(multi.tables).length === 0 && (
              <p className="text-muted-foreground text-sm italic">
                Aucune batterie de réponses multiples détectée dans ce jeu de données.
              </p>
            )}

            {multi &&
              Object.entries(multi.tables).map(([prefix, table]) => {
                const chartData = table.rows
                  .filter((r) => r.Option !== 'Total répondants valides')
                  .map((r) => ({ option: r.Option, effectif: r.Effectif }));
                return (
                  <Card key={prefix}>
                    <CardHeader>
                      <CardTitle className="text-base">{prefix}</CardTitle>
                      <CardDescription>Base valide : {table.base} répondant(s)</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Option</TableHead>
                            <TableHead className="text-right">Effectif</TableHead>
                            <TableHead className="text-right">% répondants</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {table.rows.map((r, idx) => (
                            <TableRow
                              key={idx}
                              className={
                                r.Option === 'Total répondants valides' ? 'font-semibold' : ''
                              }
                            >
                              <TableCell>{r.Option}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {r.Effectif}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {pct(r['Pourcentage répondants'])}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="option"
                              tick={{ fontSize: 11 }}
                              interval={0}
                              angle={-20}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip {...tooltipPropsPremium} />
                            <Bar dataKey="effectif" radius={[4, 4, 0, 0]}>
                              {chartData.map((_, i) => (
                                <Cell key={i} fill={couleurRang(i)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>

          {/* --- Nettoyage / épuration --- */}
          <TabsContent value="clean" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Épuration de la base</CardTitle>
                <CardDescription>
                  Produit un aperçu de la base nettoyée. Les données source ne sont pas modifiées :
                  l’aperçu et ses caractéristiques sont enregistrés dans l’historique.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={dropEmpty} onCheckedChange={setDropEmpty} />
                    Retirer les lignes entièrement vides
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={dropDuplicates} onCheckedChange={setDropDuplicates} />
                    Retirer les doublons
                  </label>
                  <Button onClick={lancerClean} disabled={busyClean}>
                    {busyClean ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Wand2 className="size-4" />
                    )}
                    Épurer la base
                  </Button>
                </div>
              </CardContent>
            </Card>

            {clean && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Résultat de l’épuration</CardTitle>
                  <CardDescription>
                    <span className="inline-flex flex-wrap gap-2">
                      <Badge variant="secondary">Source : {clean.n_rows_source} lignes</Badge>
                      <Badge variant="secondary">Épurée : {clean.n_rows_cleaned} lignes</Badge>
                      <Badge variant={clean.n_removed > 0 ? 'default' : 'outline'}>
                        {clean.n_removed} retirée(s)
                      </Badge>
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {clean.preview.length > 0 ? (
                    <>
                      <p className="text-muted-foreground text-xs">
                        Aperçu des {Math.min(clean.preview.length, 100)} premières lignes épurées.
                      </p>
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {clean.specs.map((s) => (
                                <TableHead key={s.name} title={`${s.measure}`}>
                                  {s.name}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clean.preview.slice(0, 20).map((r, ri) => (
                              <TableRow key={ri}>
                                {clean.specs.map((s) => (
                                  <TableCell key={s.name} className="tabular-nums">
                                    {String(r[s.name] ?? '')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {clean.preview.length > 20 && (
                        <p className="text-muted-foreground text-xs italic">
                          20 lignes affichées sur {clean.preview.length} de l’aperçu.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      La base épurée ne contient aucune ligne.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* --- Rapport (API Claude) --- */}
          <TabsContent value="rapport" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Générer un rapport</CardTitle>
                <CardDescription>
                  Claude rédige un rapport à partir des résultats déjà produits (tri à plat et/ou
                  croisement de cet indicateur). Les chiffres ne sont ni inventés ni recalculés.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Format</p>
                    <Select
                      value={formatRapport}
                      onValueChange={(v) => setFormatRapport((v ?? 'synthese') as FormatRapport)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FORMATS_RAPPORT).map(([key, f]) => (
                          <SelectItem key={key} value={key}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={lancerRapport} disabled={busyRapport || (!freq && !cross)}>
                    {busyRapport ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                    Générer le rapport
                  </Button>
                </div>
                <Textarea
                  value={consignes}
                  onChange={(e) => setConsignes(e.target.value)}
                  placeholder="Consignes complémentaires (optionnel) : angle, public visé, longueur…"
                  rows={2}
                />
                {!freq && !cross && (
                  <p className="text-muted-foreground text-sm italic">
                    Produisez d’abord un tri à plat ou un croisement pour alimenter le rapport.
                  </p>
                )}
              </CardContent>
            </Card>

            {rapport && (
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle className="text-base">Rapport généré</CardTitle>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => navigator.clipboard?.writeText(rapport)}
                    >
                      Copier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        exporter(() => exporterRapportPdf(rapport, `Rapport — ${sourceLabel}`))
                      }
                    >
                      <Download className="size-4" /> PDF
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        exporter(() => exporterRapportWord(rapport, `Rapport — ${sourceLabel}`))
                      }
                    >
                      <Download className="size-4" /> Word
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        telechargerFichier(
                          `rapport_${nomSur(sourceRef || 'datastudio')}.md`,
                          rapport,
                          'text/markdown;charset=utf-8;',
                        )
                      }
                    >
                      <Download className="size-4" /> Markdown
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <MarkdownRenderer>{rapport}</MarkdownRenderer>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des traitements</CardTitle>
          <CardDescription>
            Vos analyses enregistrées (base épurée, tris, croisements).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historique.erreur ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Historique indisponible</p>
              <p className="mt-1">
                La table <code className="font-mono">datastudio_jobs</code> n’est pas encore
                appliquée en base. Lancez la migration{' '}
                <code className="font-mono">20260918000001_datastudio_historique.sql</code>, puis
                rechargez.
              </p>
            </div>
          ) : historique.jobs.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">
              Aucun traitement enregistré pour l’instant.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historique.jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>{j.titre}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{j.type}</Badge>
                    </TableCell>
                    <TableCell>{j.source}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(j.created_at).toLocaleString('fr-FR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Sélecteur de variables riche : recherche plein texte, filtres par type de
 * mesure, sélection en masse (tout / aucun / inverser) sur la liste filtrée,
 * compteur, libellés complets + code + badge de mesure. Remplace la grille de
 * cases à cocher ingérable sur les bases à nombreuses variables.
 */
function VariablePicker({
  variables,
  selected,
  onChange,
}: {
  variables: { name: string; display: string; measure: string; cardinality: number }[];
  selected: string[];
  onChange: (names: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [mesure, setMesure] = useState<string>('TOUTES');

  const requete = q.trim().toLowerCase();
  const filtrees = variables.filter((v) => {
    if (mesure !== 'TOUTES' && v.measure !== mesure) return false;
    if (!requete) return true;
    return `${v.display} ${v.name}`.toLowerCase().includes(requete);
  });

  const selSet = new Set(selected);
  const nbFiltreesSel = filtrees.filter((v) => selSet.has(v.name)).length;

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange([...next]);
  }
  function toutFiltrees() {
    onChange([...new Set([...selected, ...filtrees.map((v) => v.name)])]);
  }
  function aucuneFiltrees() {
    const noms = new Set(filtrees.map((v) => v.name));
    onChange(selected.filter((n) => !noms.has(n)));
  }
  function inverserFiltrees() {
    const next = new Set(selected);
    for (const v of filtrees) {
      if (next.has(v.name)) next.delete(v.name);
      else next.add(v.name);
    }
    onChange([...next]);
  }

  const compteMesure = (m: string) =>
    m === 'TOUTES' ? variables.length : variables.filter((v) => v.measure === m).length;
  const filtresMesure: { cle: string; label: string }[] = [
    { cle: 'TOUTES', label: 'Toutes' },
    { cle: 'NOMINAL', label: 'Nominales' },
    { cle: 'ORDINAL', label: 'Ordinales' },
    { cle: 'ÉCHELLE', label: 'Échelle' },
  ];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une variable (libellé ou code)…"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filtresMesure.map((f) => (
          <Button
            key={f.cle}
            type="button"
            size="sm"
            variant={mesure === f.cle ? 'default' : 'outline'}
            className="h-7 px-2.5 text-xs"
            onClick={() => setMesure(f.cle)}
          >
            {f.label} ({compteMesure(f.cle)})
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={toutFiltrees}
        >
          <CheckCheck className="size-3.5" /> Tout sélectionner
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={aucuneFiltrees}
        >
          <SquareDashed className="size-3.5" /> Aucun
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2.5 text-xs"
          onClick={inverserFiltrees}
        >
          Inverser
        </Button>
        <span className="text-muted-foreground ml-auto text-xs">
          {selected.length} sélectionnée(s) · {nbFiltreesSel}/{filtrees.length} affichée(s)
        </span>
      </div>

      <div className="max-h-72 divide-y overflow-auto rounded-md border">
        {filtrees.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm italic">
            Aucune variable ne correspond à la recherche.
          </p>
        ) : (
          filtrees.map((v) => {
            const m = MESURES[v.measure];
            return (
              <label
                key={v.name}
                className="hover:bg-muted/50 flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={selSet.has(v.name)}
                  onCheckedChange={() => toggle(v.name)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug" title={v.display}>
                    {v.display}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">{v.name}</span>
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${m?.classe ?? 'bg-muted text-muted-foreground'}`}
                  title={v.measure}
                >
                  {m?.court ?? v.measure}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function SelectChamp({
  label,
  value,
  onChange,
  options,
  aucune = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { name: string; display: string }[];
  aucune?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Choisir…" />
        </SelectTrigger>
        <SelectContent>
          {aucune && <SelectItem value={AUCUNE}>[Aucune]</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.name} value={o.name}>
              {o.display}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
