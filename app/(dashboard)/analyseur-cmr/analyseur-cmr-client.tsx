'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  CheckCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Loader2,
  ShieldAlert,
  Upload,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { analyserCmr, uploadCmrFile } from '@/lib/analyseur-cmr/api-client';
import {
  construireDashboardHtml,
  construireInfographieHtml,
  construireRapportHtml,
  telechargerHtml,
} from '@/lib/analyseur-cmr/html-export';
import { exporterCmrExcel } from '@/lib/analyseur-cmr/excel-export';
import { exporterRapportWord } from '@/lib/analyseur-cmr/word-export';
import type {
  CMRAnalyseResponse,
  IndicateurCMR,
  ProjetCMR,
  StatutIndicateur,
} from '@/lib/analyseur-cmr/types';

// Couleurs charte OIF (verrouillées).
const OIF = {
  bleu: '#0E4F88',
  cyan: '#0198E9',
  vert: '#7EB301',
  jaune: '#FDCD00',
  violet: '#5D0073',
  rouge: '#E40001',
  gris: '#2E292D',
};

const COULEUR_STATUT: Record<StatutIndicateur, string> = {
  Conforme: OIF.vert,
  Corrigé: OIF.cyan,
  'À vérifier': OIF.jaune,
  Critique: OIF.rouge,
};

function fmt(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${v} %`;
}

function fmtNombre(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

function couleurScore(v: number): string {
  if (v >= 75) return OIF.vert;
  if (v >= 50) return OIF.jaune;
  return OIF.rouge;
}

export function AnalyseurCmrClient() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [res, setRes] = useState<CMRAnalyseResponse | null>(null);
  const [projetActif, setProjetActif] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function lancer() {
    if (!fichier) return;
    setChargement(true);
    setErreur(null);
    try {
      const path = await uploadCmrFile(fichier);
      const data = await analyserCmr(path);
      setRes(data);
      setProjetActif(data.projets[0]?.code ?? '');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
  }

  const [exportExcel, setExportExcel] = useState(false);
  async function telechargerExcel() {
    if (!res) return;
    setExportExcel(true);
    try {
      await exporterCmrExcel(res);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setExportExcel(false);
    }
  }

  const [exportWord, setExportWord] = useState(false);
  async function telechargerWord() {
    if (!res) return;
    setExportWord(true);
    try {
      await exporterRapportWord(res);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setExportWord(false);
    }
  }

  const projet = useMemo<ProjetCMR | null>(
    () => res?.projets.find((p) => p.code === projetActif) ?? res?.projets[0] ?? null,
    [res, projetActif],
  );

  return (
    <div className="space-y-5">
      {/* Zone de chargement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4" /> Charger un CMR
          </CardTitle>
          <CardDescription>
            Classeur Excel (.xlsx) — un onglet par projet, en-têtes « Réf. / Indicateur / Cible /
            Réalisé / % », hiérarchie OG → E → P → I.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                setFichier(e.target.files?.[0] ?? null);
                setRes(null);
              }}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" /> Choisir un fichier
            </Button>
            <span className="text-muted-foreground text-sm">
              {fichier ? fichier.name : 'Aucun fichier sélectionné'}
            </span>
            <Button onClick={lancer} disabled={!fichier || chargement}>
              {chargement ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BarChart3 className="size-4" />
              )}
              {chargement ? 'Analyse en cours…' : 'Analyser le CMR'}
            </Button>
          </div>
          {erreur && (
            <p className="flex items-center gap-2 text-sm text-[color:var(--destructive)]">
              <AlertTriangle className="size-4" /> {erreur}
            </p>
          )}
        </CardContent>
      </Card>

      {res && (
        <>
          <KpisGlobaux res={res} />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => telechargerHtml('rapport_audit_cmr.html', construireRapportHtml(res))}
            >
              <FileText className="size-4" /> Rapport d’audit (HTML)
            </Button>
            <Button variant="outline" size="sm" onClick={telechargerWord} disabled={exportWord}>
              {exportWord ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Rapport d’audit (Word)
            </Button>
            <Button size="sm" onClick={telechargerExcel} disabled={exportExcel}>
              {exportExcel ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              CMR corrigé (Excel, formules)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => telechargerHtml('dashboard_cmr.html', construireDashboardHtml(res))}
            >
              <Download className="size-4" /> Tableau de bord (HTML)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                telechargerHtml('infographie_cmr.html', construireInfographieHtml(res))
              }
            >
              <Download className="size-4" /> Infographie exécutive (HTML)
            </Button>
            {res.onglets_ignores.length > 0 && (
              <span className="text-muted-foreground text-xs">
                Onglets non reconnus ignorés : {res.onglets_ignores.join(', ')}
              </span>
            )}
          </div>

          <Tabs defaultValue="global">
            <TabsList>
              <TabsTrigger value="global">Tableau de bord global</TabsTrigger>
              <TabsTrigger value="projet">Par projet</TabsTrigger>
            </TabsList>

            <TabsContent value="global" className="space-y-5 pt-4">
              <VueGlobale res={res} />
            </TabsContent>

            <TabsContent value="projet" className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Projet :</span>
                <Select value={projet?.code ?? ''} onValueChange={(v) => setProjetActif(v ?? '')}>
                  <SelectTrigger className="w-[320px]">
                    <SelectValue placeholder="Choisir un projet" />
                  </SelectTrigger>
                  <SelectContent>
                    {res.projets.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.code} · {p.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {projet && <VueProjet projet={projet} />}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ KPIs */

function KpisGlobaux({ res }: { res: CMRAnalyseResponse }) {
  const k = res.global.kpi;
  const cartes: { label: string; valeur: string; icone: React.ReactNode }[] = [
    {
      label: 'Projets',
      valeur: String(k.n_projets),
      icone: <FileSpreadsheet className="size-4" />,
    },
    {
      label: 'Indicateurs',
      valeur: String(k.n_indicateurs),
      icone: <BarChart3 className="size-4" />,
    },
    {
      label: '% atteinte (médian)',
      valeur: fmt(k.taux_atteinte_global),
      icone: <Gauge className="size-4" />,
    },
    {
      label: 'Anomalies',
      valeur: String(k.n_anomalies),
      icone: <AlertTriangle className="size-4" />,
    },
    {
      label: 'Fiabilité',
      valeur: `${k.score_fiabilite}/100`,
      icone: <ShieldAlert className="size-4" />,
    },
    {
      label: 'Cohérence',
      valeur: `${k.score_coherence}/100`,
      icone: <CheckCheck className="size-4" />,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cartes.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-4">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wide uppercase">
              {c.icone} {c.label}
            </div>
            <div className="mt-1 text-2xl font-bold" style={{ color: OIF.bleu }}>
              {c.valeur}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- Vue globale */

function VueGlobale({ res }: { res: CMRAnalyseResponse }) {
  const g = res.global;
  const risques = Object.entries(g.repartition_risques).map(([name, value]) => ({
    name,
    value,
    fill: name.includes('Critique')
      ? OIF.rouge
      : name.includes('surveiller')
        ? OIF.jaune
        : OIF.vert,
  }));
  const statuts = (Object.entries(g.repartition_statuts) as [StatutIndicateur, number][]).map(
    ([name, value]) => ({ name, value, fill: COULEUR_STATUT[name] }),
  );
  const tauxProjets = g.classement
    .filter((r) => r.taux_atteinte_moyen !== null)
    .map((r) => ({ code: r.code, taux: r.taux_atteinte_moyen as number }))
    .slice(0, 20);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Répartition des risques</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={risques} dataKey="value" nameKey="name" outerRadius={80} label>
                  {risques.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Statuts des indicateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statuts} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statuts.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Taux d’atteinte médian par projet</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tauxProjets}>
                <XAxis
                  dataKey="code"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="taux" fill={OIF.cyan} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <MessagesCles res={res} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Classement des projets</CardTitle>
          <CardDescription>Triés par fiabilité décroissante.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Projet</TableHead>
                <TableHead>Fiabilité</TableHead>
                <TableHead>Taux médian</TableHead>
                <TableHead>Anomalies</TableHead>
                <TableHead>Critiques</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.classement.map((r) => (
                <TableRow key={r.code}>
                  <TableCell className="text-lg">{r.feu}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-bold">{r.code}</span> {r.nom}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-2 w-20 overflow-hidden rounded-full">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(100, r.fiabilite)}%`,
                            backgroundColor: couleurScore(r.fiabilite),
                          }}
                        />
                      </div>
                      {r.fiabilite}
                    </div>
                  </TableCell>
                  <TableCell>{fmt(r.taux_atteinte_moyen)}</TableCell>
                  <TableCell>{r.n_anomalies}</TableCell>
                  <TableCell>{r.n_critiques}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function MessagesCles({ res }: { res: CMRAnalyseResponse }) {
  const m = res.global.messages_cles;
  const bloc = (titre: string, items: string[], couleur: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm" style={{ color: couleur }}>
          {titre}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {items.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">—</p>
        )}
      </CardContent>
    </Card>
  );
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {bloc('✅ Forces', m.forces, OIF.vert)}
      {bloc('⚠️ Faiblesses', m.faiblesses, OIF.rouge)}
      {bloc('🎯 Recommandations', m.recommandations, OIF.bleu)}
    </div>
  );
}

/* ----------------------------------------------------------- Vue projet */

function VueProjet({ projet }: { projet: ProjetCMR }) {
  const scores: [string, number][] = [
    ['Fiabilité', projet.scores.fiabilite],
    ['Qualité données', projet.scores.qualite_donnees],
    ['Cohérence calculs', projet.scores.coherence_arith],
    ['Cohérence GAR', projet.scores.coherence_gar],
    ['Réalisme cibles', projet.scores.realisme_cibles],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {scores.map(([label, v]) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className="text-muted-foreground text-xs tracking-wide uppercase">{label}</div>
              <div className="mt-1 text-xl font-bold" style={{ color: couleurScore(v) }}>
                {v}/100
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.entries(projet.statuts) as [StatutIndicateur, number][]).map(([s, n]) => (
          <Badge key={s} style={{ backgroundColor: COULEUR_STATUT[s], color: '#fff' }}>
            {s} : {n}
          </Badge>
        ))}
        <span className="text-muted-foreground text-sm">· {projet.mention_qualite}</span>
      </div>

      {/* Livrable 2 : CMR révisé tracé */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CMR révisé — traçabilité des corrections</CardTitle>
          <CardDescription>
            Recalcul arithmétique appliqué ; ré-estimations et vérifications seulement proposées.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf.</TableHead>
                <TableHead>Indicateur</TableHead>
                <TableHead>Réf.</TableHead>
                <TableHead>Cible tot.</TableHead>
                <TableHead>Réalisé tot.</TableHead>
                <TableHead>% saisi</TableHead>
                <TableHead>% corrigé</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projet.indicateurs.map((ind) => (
                <TableRow key={ind.ref}>
                  <TableCell className="font-mono text-xs">{ind.ref}</TableCell>
                  <TableCell className="max-w-[280px] truncate" title={ind.libelle}>
                    {ind.libelle}
                  </TableCell>
                  <TableCell>{fmtNombre(ind.reference)}</TableCell>
                  <TableCell>{fmtNombre(ind.cible_total)}</TableCell>
                  <TableCell>{fmtNombre(ind.total_realise)}</TableCell>
                  <TableCell>{fmt(ind.pct_total)}</TableCell>
                  <TableCell className="font-semibold" style={{ color: OIF.cyan }}>
                    {fmt(ind.pct_total_calc)}
                  </TableCell>
                  <TableCell>
                    <Badge style={{ backgroundColor: COULEUR_STATUT[ind.statut], color: '#fff' }}>
                      {ind.statut}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Livrable 1 : anomalies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Anomalies détectées ({projet.n_anomalies})</CardTitle>
        </CardHeader>
        <CardContent>
          {projet.anomalies.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Risque</TableHead>
                  <TableHead>Constat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projet.anomalies.map((a, i) => (
                  <TableRow key={`${a.ref}-${i}`}>
                    <TableCell className="font-mono text-xs">{a.ref}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell className="whitespace-nowrap">{a.risque}</TableCell>
                    <TableCell>{a.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">Aucune anomalie détectée.</p>
          )}
        </CardContent>
      </Card>

      <DecisionsHumaines indicateurs={projet.indicateurs} />
    </div>
  );
}

/** Section « décisions nécessitant une validation humaine » (corrections non appliquées). */
function DecisionsHumaines({ indicateurs }: { indicateurs: IndicateurCMR[] }) {
  const aValider = indicateurs.flatMap((ind) =>
    ind.corrections.filter((c) => !c.applique).map((c) => ({ ref: ind.ref, ...c })),
  );
  if (!aValider.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Décisions nécessitant une validation humaine</CardTitle>
        <CardDescription>
          Hypothèses et corrections incertaines — non appliquées automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Réf.</TableHead>
              <TableHead>Champ</TableHead>
              <TableHead>Confiance</TableHead>
              <TableHead>Justification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aValider.map((c, i) => (
              <TableRow key={`${c.ref}-${i}`}>
                <TableCell className="font-mono text-xs">{c.ref}</TableCell>
                <TableCell>{c.champ}</TableCell>
                <TableCell>{c.confiance}</TableCell>
                <TableCell>{c.justification}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
