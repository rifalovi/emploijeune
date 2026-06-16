'use client';

import { useMemo, useState } from 'react';
import { Download, GripVertical, RotateCcw, Table2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SOURCES_TCD, type CubeRow, type SourceTCD } from '@/lib/analyses/pivot-config';
import { INDICATIFS_PAYS } from '@/lib/data/indicatifs-pays';

/**
 * Convertit une valeur brute de dimension en libellé lisible. Pour le pays :
 * code ISO-3 → nom du pays ; ZZZ / vide → mention « inconnu ». Les autres
 * dimensions sont affichées telles quelles.
 */
function formatValeurDimension(cle: string, v: string): string {
  if (cle === 'pays') {
    if (v === 'ZZZ') return 'Inconnu (ZZZ)';
    if (v === '—' || v === '') return 'Non renseigné';
    return INDICATIFS_PAYS[v]?.libelle ?? v;
  }
  return v;
}

type Zone = 'dispo' | 'lignes' | 'colonnes' | 'filtres';
const SEP = '';

export function PivotTableClient({ a1, b1 }: { a1: CubeRow[]; b1: CubeRow[] }) {
  const [source, setSource] = useState<SourceTCD>('A1');
  const config = SOURCES_TCD[source];
  const cube = source === 'A1' ? a1 : b1;

  const [lignes, setLignes] = useState<string[]>([]);
  const [colonnes, setColonnes] = useState<string[]>([]);
  const [filtres, setFiltres] = useState<string[]>([]);
  const [filtreSel, setFiltreSel] = useState<Record<string, Set<string>>>({});
  const [mesure, setMesure] = useState<string>(config.mesures[0]!.cle);
  const [drag, setDrag] = useState<{ cle: string; from: Zone } | null>(null);

  const champsUtilises = new Set([...lignes, ...colonnes, ...filtres]);
  const champsDispo = config.champs.filter((c) => !champsUtilises.has(c.cle));
  const labelChamp = (cle: string) => config.champs.find((c) => c.cle === cle)?.label ?? cle;
  const mesureDef = config.mesures.find((m) => m.cle === mesure) ?? config.mesures[0]!;

  const changerSource = (s: SourceTCD) => {
    setSource(s);
    setLignes([]);
    setColonnes([]);
    setFiltres([]);
    setFiltreSel({});
    setMesure(SOURCES_TCD[s].mesures[0]!.cle);
  };

  const reinitialiser = () => {
    setLignes([]);
    setColonnes([]);
    setFiltres([]);
    setFiltreSel({});
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const retirerDePartout = (cle: string) => {
    setLignes((l) => l.filter((x) => x !== cle));
    setColonnes((c) => c.filter((x) => x !== cle));
    setFiltres((f) => f.filter((x) => x !== cle));
  };

  const deposer = (zone: Zone) => {
    if (!drag) return;
    const { cle } = drag;
    retirerDePartout(cle);
    if (zone === 'lignes') setLignes((l) => [...l, cle]);
    else if (zone === 'colonnes') setColonnes((c) => [...c, cle]);
    else if (zone === 'filtres') setFiltres((f) => [...f, cle]);
    setDrag(null);
  };

  // ── Valeurs distinctes par champ (pour les filtres) ─────────────────────────
  const valeursParChamp = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const c of config.champs) {
      const set = new Set<string>();
      for (const row of cube) set.add(String(row[c.cle]));
      map[c.cle] = [...set].sort((a, b) => a.localeCompare(b, 'fr'));
    }
    return map;
  }, [cube, config.champs]);

  // ── Calcul du pivot ─────────────────────────────────────────────────────────
  const pivot = useMemo(() => {
    const valeurMesure = (row: CubeRow): number => {
      if (mesureDef.type === 'count') return Number(row.n) || 0;
      return Number(row[mesureDef.champ ?? '']) || 0;
    };

    // Filtrage
    const filtres_actifs = filtres.filter((f) => (filtreSel[f]?.size ?? 0) > 0);
    const lignesFiltrees = cube.filter((row) =>
      filtres_actifs.every((f) => filtreSel[f]!.has(String(row[f]))),
    );

    const cleCombo = (row: CubeRow, champs: string[]) =>
      champs.map((c) => String(row[c])).join(SEP);

    const rowKeys = new Set<string>();
    const colKeys = new Set<string>();
    const cells = new Map<string, number>();
    const totLignes = new Map<string, number>();
    const totColonnes = new Map<string, number>();
    let grandTotal = 0;

    for (const row of lignesFiltrees) {
      const rk = lignes.length ? cleCombo(row, lignes) : 'Total';
      const ck = colonnes.length ? cleCombo(row, colonnes) : 'Total';
      rowKeys.add(rk);
      colKeys.add(ck);
      const v = valeurMesure(row);
      cells.set(rk + SEP + SEP + ck, (cells.get(rk + SEP + SEP + ck) ?? 0) + v);
      totLignes.set(rk, (totLignes.get(rk) ?? 0) + v);
      totColonnes.set(ck, (totColonnes.get(ck) ?? 0) + v);
      grandTotal += v;
    }

    const triCombos = (keys: Set<string>) => [...keys].sort((a, b) => a.localeCompare(b, 'fr'));
    return {
      rows: triCombos(rowKeys),
      cols: triCombos(colKeys),
      cells,
      totLignes,
      totColonnes,
      grandTotal,
      nbLignesSource: lignesFiltrees.length,
    };
  }, [cube, lignes, colonnes, filtres, filtreSel, mesureDef]);

  const fmt = (v: number) =>
    mesureDef.format === 'montant' ? `${v.toLocaleString('fr-FR')} €` : v.toLocaleString('fr-FR');
  const split = (k: string) => k.split(SEP);

  // ── Export CSV (ouvrable dans Excel) ────────────────────────────────────────
  const exporter = () => {
    const sepCsv = ';';
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const enTete = [
      ...lignes.map(labelChamp),
      ...pivot.cols.map((ck) =>
        colonnes.length
          ? split(ck)
              .map((v, i) => formatValeurDimension(colonnes[i]!, v))
              .join(' / ')
          : mesureDef.label,
      ),
      'Total',
    ];
    const lignesCsv = [enTete.map(esc).join(sepCsv)];
    for (const rk of pivot.rows) {
      const cellules = pivot.cols.map((ck) => String(pivot.cells.get(rk + SEP + SEP + ck) ?? 0));
      const ligne = [
        ...(lignes.length
          ? split(rk).map((v, i) => formatValeurDimension(lignes[i]!, v))
          : ['Total']),
        ...cellules,
        String(pivot.totLignes.get(rk) ?? 0),
      ];
      lignesCsv.push(ligne.map((c) => esc(String(c))).join(sepCsv));
    }
    const totaux = [
      ...(lignes.length ? ['Total', ...Array(lignes.length - 1).fill('')] : ['Total']),
      ...pivot.cols.map((ck) => String(pivot.totColonnes.get(ck) ?? 0)),
      String(pivot.grandTotal),
    ];
    lignesCsv.push(totaux.map((c) => esc(String(c))).join(sepCsv));

    const blob = new Blob(['﻿' + lignesCsv.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TCD_${source}_${mesureDef.cle}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md border">
          {(['A1', 'B1'] as SourceTCD[]).map((s) => (
            <button
              key={s}
              onClick={() => changerSource(s)}
              className={`px-3 py-1.5 text-sm font-medium ${
                source === s ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'
              }`}
            >
              {SOURCES_TCD[s].label}
            </button>
          ))}
        </div>
        <label className="text-sm">
          Mesure :{' '}
          <select
            value={mesure}
            onChange={(e) => setMesure(e.target.value)}
            className="border-input rounded border bg-transparent px-2 py-1 text-sm"
          >
            {config.mesures.map((m) => (
              <option key={m.cle} value={m.cle}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" onClick={reinitialiser} className="gap-1">
          <RotateCcw className="size-3.5" /> Réinitialiser
        </Button>
        <Button type="button" size="sm" onClick={exporter} className="gap-1">
          <Download className="size-3.5" /> Exporter (Excel)
        </Button>
        <span className="text-muted-foreground text-xs">
          {cube.length.toLocaleString('fr-FR')} combinaisons agrégées
        </span>
      </div>

      {/* Champs disponibles */}
      <ZoneDnD
        titre="Champs disponibles — glissez-les dans Lignes, Colonnes ou Filtres"
        zone="dispo"
        onDrop={deposer}
        className="bg-muted/30"
      >
        {champsDispo.map((c) => (
          <Puce
            key={c.cle}
            label={c.label}
            onDragStart={() => setDrag({ cle: c.cle, from: 'dispo' })}
          />
        ))}
        {champsDispo.length === 0 && <Vide />}
      </ZoneDnD>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ZoneDnD titre="Lignes" zone="lignes" onDrop={deposer}>
          {lignes.map((cle) => (
            <Puce
              key={cle}
              label={labelChamp(cle)}
              onDragStart={() => setDrag({ cle, from: 'lignes' })}
              onRetirer={() => retirerDePartout(cle)}
            />
          ))}
          {lignes.length === 0 && <Vide />}
        </ZoneDnD>
        <ZoneDnD titre="Colonnes" zone="colonnes" onDrop={deposer}>
          {colonnes.map((cle) => (
            <Puce
              key={cle}
              label={labelChamp(cle)}
              onDragStart={() => setDrag({ cle, from: 'colonnes' })}
              onRetirer={() => retirerDePartout(cle)}
            />
          ))}
          {colonnes.length === 0 && <Vide />}
        </ZoneDnD>
        <ZoneDnD titre="Filtres" zone="filtres" onDrop={deposer}>
          {filtres.map((cle) => (
            <div key={cle} className="w-full space-y-1">
              <Puce
                label={labelChamp(cle)}
                onDragStart={() => setDrag({ cle, from: 'filtres' })}
                onRetirer={() => retirerDePartout(cle)}
              />
              <select
                multiple
                value={[...(filtreSel[cle] ?? [])]}
                onChange={(e) =>
                  setFiltreSel((prev) => ({
                    ...prev,
                    [cle]: new Set(Array.from(e.target.selectedOptions, (o) => o.value)),
                  }))
                }
                className="border-input h-24 w-full rounded border bg-transparent p-1 text-xs"
              >
                {valeursParChamp[cle]?.map((v) => (
                  <option key={v} value={v}>
                    {formatValeurDimension(cle, v)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {filtres.length === 0 && <Vide />}
        </ZoneDnD>
      </div>

      {/* Tableau croisé */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {lignes.length === 0 && colonnes.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 p-10 text-center text-sm">
              <Table2 className="size-8" />
              Glissez au moins un champ dans <strong>Lignes</strong> ou <strong>Colonnes</strong>.
              <span>
                Total {mesureDef.label.toLowerCase()} : <strong>{fmt(pivot.grandTotal)}</strong>
              </span>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {lignes.map((cle) => (
                    <th key={cle} className="border px-3 py-2 text-left font-semibold">
                      {labelChamp(cle)}
                    </th>
                  ))}
                  {pivot.cols.map((ck) => (
                    <th
                      key={ck}
                      className="border px-3 py-2 text-right font-semibold whitespace-nowrap"
                    >
                      {colonnes.length
                        ? split(ck)
                            .map((v, i) => formatValeurDimension(colonnes[i]!, v))
                            .join(' / ')
                        : mesureDef.label}
                    </th>
                  ))}
                  <th className="bg-muted border px-3 py-2 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {pivot.rows.map((rk) => (
                  <tr key={rk} className="hover:bg-muted/30">
                    {lignes.length ? (
                      split(rk).map((v, i) => (
                        <td key={i} className="border px-3 py-1.5 font-medium">
                          {formatValeurDimension(lignes[i]!, v)}
                        </td>
                      ))
                    ) : (
                      <td className="border px-3 py-1.5 font-medium">Total</td>
                    )}
                    {pivot.cols.map((ck) => (
                      <td key={ck} className="border px-3 py-1.5 text-right tabular-nums">
                        {fmt(pivot.cells.get(rk + SEP + SEP + ck) ?? 0)}
                      </td>
                    ))}
                    <td className="bg-muted/40 border px-3 py-1.5 text-right font-semibold tabular-nums">
                      {fmt(pivot.totLignes.get(rk) ?? 0)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted font-bold">
                  <td className="border px-3 py-2" colSpan={Math.max(1, lignes.length)}>
                    Total
                  </td>
                  {pivot.cols.map((ck) => (
                    <td key={ck} className="border px-3 py-2 text-right tabular-nums">
                      {fmt(pivot.totColonnes.get(ck) ?? 0)}
                    </td>
                  ))}
                  <td className="border px-3 py-2 text-right tabular-nums">
                    {fmt(pivot.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ZoneDnD({
  titre,
  zone,
  onDrop,
  children,
  className,
}: {
  titre: string;
  zone: Zone;
  onDrop: (z: Zone) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(zone);
      }}
      className={`rounded-lg border border-dashed p-3 ${className ?? 'bg-card'}`}
    >
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {titre}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Puce({
  label,
  onDragStart,
  onRetirer,
}: {
  label: string;
  onDragStart: () => void;
  onRetirer?: () => void;
}) {
  return (
    <span
      draggable
      onDragStart={onDragStart}
      className="bg-primary/10 text-primary inline-flex cursor-grab items-center gap-1 rounded-md px-2 py-1 text-xs font-medium active:cursor-grabbing"
    >
      <GripVertical className="size-3" />
      {label}
      {onRetirer && (
        <button
          type="button"
          onClick={onRetirer}
          className="hover:text-destructive ml-0.5"
          aria-label={`Retirer ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

function Vide() {
  return <span className="text-muted-foreground/60 text-xs italic">déposez un champ ici</span>;
}
