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
import { Database, FileText, FlaskConical, Loader2, Sigma, Table2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  computeCrosstab,
  computeFrequency,
  ingestFile,
  uploadSpssFile,
  type ComputeSource,
} from '@/lib/atelier-analyse/api-client';
import { genererRapportAction } from '@/lib/atelier-analyse/rapport';
import { FORMATS_RAPPORT } from '@/lib/atelier-analyse/types';
import type {
  AnalyzeResponse,
  CrosstabResponse,
  DatasetInput,
  FormatRapport,
  FrequencyResponse,
  HistoriqueJob,
  IndicateurSource,
} from '@/lib/atelier-analyse/types';

const AUCUNE = '__aucune__';

function pct(v: number | null): string {
  return v === null || v === undefined ? '' : `${(v * 100).toFixed(1)} %`;
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

  // Rapport (API Claude)
  const [formatRapport, setFormatRapport] = useState<FormatRapport>('synthese');
  const [consignes, setConsignes] = useState('');
  const [rapport, setRapport] = useState<string | null>(null);
  const [busyRapport, setBusyRapport] = useState(false);

  const variables = analyse?.variables ?? [];

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
    setRapport(null);
    setAnalyse(null);
  }

  function appliquerAnalyse(a: AnalyzeResponse) {
    setAnalyse(a);
    setVarsSel(a.variables.slice(0, 1).map((v) => v.name));
    setRow(a.variables[0]?.name ?? '');
    setCol(a.variables[1]?.name ?? a.variables[0]?.name ?? '');
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

  function toggleVar(name: string) {
    setVarsSel((prev) => (prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]));
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
            Analysez les réponses d’enquête de la plateforme, ou importez un fichier SPSS (.sav),
            Kobo/CSPro (.xlsx) ou .csv.
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
                accept=".sav,.xlsx,.xls,.csv"
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

      {/* Espace d'analyse */}
      {analyse && source && (
        <Tabs defaultValue="freq" className="space-y-4">
          <TabsList>
            <TabsTrigger value="freq" className="gap-1">
              <Sigma className="size-4" /> Tris à plat
            </TabsTrigger>
            <TabsTrigger value="cross" className="gap-1">
              <Table2 className="size-4" /> Croisements
            </TabsTrigger>
            <TabsTrigger value="rapport" className="gap-1">
              <FileText className="size-4" /> Rapport
            </TabsTrigger>
          </TabsList>

          {/* --- Tris à plat --- */}
          <TabsContent value="freq" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Variables à analyser</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid max-h-56 grid-cols-1 gap-1 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                  {variables.map((v) => (
                    <label key={v.name} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={varsSel.includes(v.name)}
                        onCheckedChange={() => toggleVar(v.name)}
                      />
                      <span className="truncate" title={v.display}>
                        {v.display}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={exclure} onCheckedChange={setExclure} />
                    Exclure les valeurs manquantes
                  </label>
                  <Button onClick={lancerFreq} disabled={busyFreq || varsSel.length === 0}>
                    {busyFreq && <Loader2 className="size-4 animate-spin" />}
                    Produire les tris à plat
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
                    <CardHeader>
                      <CardTitle className="text-base">{name}</CardTitle>
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
              </CardContent>
            </Card>

            {cross &&
              cross.layers.map((lyr, li) => (
                <Card key={li}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {cross.layer ? `Couche : ${lyr.layer_value}` : 'Ensemble'}
                    </CardTitle>
                    <CardDescription>
                      Base valide : {lyr.base} · pourcentages en {cross.pct_mode.toLowerCase()}
                    </CardDescription>
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
                <CardHeader>
                  <CardTitle className="text-base">Rapport généré</CardTitle>
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
