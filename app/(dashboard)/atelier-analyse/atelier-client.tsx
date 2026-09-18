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
import { Database, FlaskConical, Loader2, Sigma, Table2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
} from '@/lib/atelier-analyse/api-client';
import type {
  AnalyzeResponse,
  CrosstabResponse,
  DatasetInput,
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
  const [indicateur, setIndicateur] = useState('');
  const [dataset, setDataset] = useState<DatasetInput | null>(null);
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

  const variables = analyse?.variables ?? [];

  async function charger() {
    if (!indicateur) return;
    setChargement(true);
    setErreur(null);
    setFreq(null);
    setCross(null);
    setAnalyse(null);
    try {
      const ds = await chargerDatasetEnqueteAction(indicateur);
      setDataset(ds);
      if (ds.rows.length === 0) {
        setErreur('Aucune réponse d’enquête pour cet indicateur.');
        return;
      }
      const a = await analyzeDataset(ds);
      setAnalyse(a);
      setVarsSel(a.variables.slice(0, 1).map((v) => v.name));
      setRow(a.variables[0]?.name ?? '');
      setCol(a.variables[1]?.name ?? a.variables[0]?.name ?? '');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setChargement(false);
    }
  }

  async function lancerFreq() {
    if (!dataset || varsSel.length === 0) return;
    setBusyFreq(true);
    setErreur(null);
    try {
      const res = await computeFrequency(dataset, varsSel, exclure);
      setFreq(res);
      // Enregistrement best-effort dans l'historique (n'interrompt pas l'analyse).
      await enregistrerTraitementAction({
        type: 'frequency',
        titre: `Tris à plat — ${varsSel.length} variable(s)`,
        source: 'enquete',
        source_ref: indicateur,
        params: { cols: varsSel, exclure, indicateur },
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
    if (!dataset || !row || !col) return;
    setBusyCross(true);
    setErreur(null);
    try {
      const lyr = layer === AUCUNE ? null : layer;
      const res = await computeCrosstab(dataset, row, col, lyr, pctMode);
      setCross(res);
      await enregistrerTraitementAction({
        type: 'crosstab',
        titre: `Croisement ${row} × ${col}`,
        source: 'enquete',
        source_ref: indicateur,
        params: { row, col, layer: lyr, pctMode, indicateur },
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

  return (
    <div className="space-y-5">
      {/* Source de données */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" /> Source des données
          </CardTitle>
          <CardDescription>
            Choisissez un indicateur : ses réponses d’enquête sont chargées comme jeu de données.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
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
          {dataset && analyse && (
            <Badge variant="secondary">
              {analyse.n_rows} réponses · {variables.length} variables
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
      {analyse && dataset && (
        <Tabs defaultValue="freq" className="space-y-4">
          <TabsList>
            <TabsTrigger value="freq" className="gap-1">
              <Sigma className="size-4" /> Tris à plat
            </TabsTrigger>
            <TabsTrigger value="cross" className="gap-1">
              <Table2 className="size-4" /> Croisements
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
