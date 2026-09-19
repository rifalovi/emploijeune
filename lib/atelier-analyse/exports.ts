'use client';

/**
 * Exports Excel mis en forme de l'Atelier d'analyse (SCS DataStudio en ligne).
 * Reprend l'esprit des exports du desktop v4.8 : en-têtes stylés, totaux en
 * gras, pourcentages formatés, une feuille par tableau, et un « Export global »
 * regroupant tris à plat, croisements, réponses multiples et tests.
 *
 * exceljs est chargé dynamiquement (au clic) pour ne pas alourdir le bundle.
 */

/* exceljs n'expose pas de types précis pour Row/Cell : on manipule ses objets
   en `any` de façon localisée. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CrosstabResponse, FrequencyResponse, MultiResponse, StatTestResponse } from './types';

type Libelle = (code: string) => string;

const COLORS = {
  header: 'FF009FE3', // bleu OIF
  headerText: 'FFFFFFFF',
  band: 'FFF4F6F8',
  total: 'FFEEF2F6',
};

function nomSurExcel(base: string, used: Set<string>): string {
  // Excel : 31 car. max, sans []:*?/\ ; on déduplique.
  const n =
    (base || 'Feuille')
      .replace(/[[\]:*?/\\]/g, ' ')
      .trim()
      .slice(0, 28) || 'Feuille';
  let candidate = n;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${n.slice(0, 25)} ${i}`;
    i += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function styleHeaderRow(row: any) {
  row.eachCell((cell: any) => {
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBFC8D2' } } };
  });
}

function setWidths(ws: any, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function ajouterFreqSheet(
  wb: any,
  titre: string,
  code: string,
  rows: FrequencyResponse['tables'][string],
) {
  const used: Set<string> = wb.__used || (wb.__used = new Set());
  const ws = wb.addWorksheet(nomSurExcel(code || titre, used));
  ws.mergeCells(1, 1, 1, 5);
  const t = ws.getCell(1, 1);
  t.value = titre;
  t.font = { bold: true, size: 13, color: { argb: 'FF29282D' } };
  ws.getCell(2, 1).value = code;
  ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: 'FF9AA4B0' } };
  const header = ws.addRow(['Modalité', 'Effectif', '%', '% valide', '% cumulé']);
  styleHeaderRow(header);
  for (const r of rows) {
    const line = ws.addRow([
      r.Modalité,
      r.Effectif,
      r['%'] ?? null,
      r['% valide'] ?? null,
      r['% cumulé'] ?? null,
    ]);
    const est_total = r.Modalité === 'Total';
    line.getCell(1).font = { bold: est_total };
    for (let c = 3; c <= 5; c += 1) line.getCell(c).numFmt = '0.0%';
    if (est_total) {
      line.eachCell((cell: any) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.total } };
      });
    }
  }
  setWidths(ws, [42, 12, 10, 12, 12]);
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  return ws;
}

function ajouterCrossSheets(wb: any, cross: CrosstabResponse, libelle: Libelle) {
  const used: Set<string> = wb.__used || (wb.__used = new Set());
  cross.layers.forEach((lyr) => {
    const base = cross.layer ? `${cross.row}_${lyr.layer_value}` : `${cross.row}_x_${cross.col}`;
    const ws = wb.addWorksheet(nomSurExcel(base, used));
    const titre = `${libelle(cross.row)} × ${libelle(cross.col)}${cross.layer ? ` · ${lyr.layer_value}` : ''}`;
    ws.mergeCells(1, 1, 1, lyr.columns.length + 1);
    ws.getCell(1, 1).value = titre;
    ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: 'FF29282D' } };
    ws.getCell(2, 1).value =
      `Base valide : ${lyr.base} · pourcentages en ${cross.pct_mode.toLowerCase()}`;
    ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: 'FF9AA4B0' } };
    const header = ws.addRow(['Modalité', ...lyr.columns]);
    styleHeaderRow(header);
    lyr.index.forEach((idx, ri) => {
      const cells: (string | number)[] = [idx];
      lyr.columns.forEach((_c, ci) => cells.push(lyr.counts[ri]?.[ci] ?? 0));
      const line = ws.addRow(cells);
      if (idx === 'Total') {
        line.eachCell((cell: any) => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.total } };
        });
      }
    });
    setWidths(ws, [34, ...lyr.columns.map(() => 14)]);
    ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 1 }];
  });
}

function ajouterMultiSheets(wb: any, multi: MultiResponse) {
  const used: Set<string> = wb.__used || (wb.__used = new Set());
  Object.entries(multi.tables).forEach(([prefix, table]) => {
    const ws = wb.addWorksheet(nomSurExcel(prefix, used));
    ws.mergeCells(1, 1, 1, 3);
    ws.getCell(1, 1).value = prefix;
    ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: 'FF29282D' } };
    ws.getCell(2, 1).value = `Base valide : ${table.base} répondant(s)`;
    ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: 'FF9AA4B0' } };
    const header = ws.addRow(['Option', 'Effectif', '% répondants']);
    styleHeaderRow(header);
    table.rows.forEach((r) => {
      const line = ws.addRow([r.Option, r.Effectif, r['Pourcentage répondants'] ?? null]);
      line.getCell(3).numFmt = '0.0%';
      if (r.Option === 'Total répondants valides') {
        line.eachCell((cell: any) => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.total } };
        });
      }
    });
    setWidths(ws, [46, 12, 14]);
    ws.views = [{ state: 'frozen', ySplit: 3 }];
  });
}

function ajouterStatSheet(
  wb: any,
  stat: StatTestResponse,
  libelle: (c: string) => string,
  row: string,
  col: string,
) {
  const used: Set<string> = wb.__used || (wb.__used = new Set());
  const ws = wb.addWorksheet(nomSurExcel('Tests statistiques', used));
  ws.getCell(1, 1).value = `Tests statistiques : ${libelle(row)} × ${libelle(col)}`;
  ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: 'FF29282D' } };
  let r = 3;
  const chi = stat.chi_square;
  ws.getCell(r, 1).value = 'Khi² d’indépendance';
  ws.getCell(r, 1).font = { bold: true };
  r += 1;
  ws.getCell(r, 1).value = chi.applicable
    ? `χ² = ${chi.chi2.toFixed(3)} · ddl = ${chi.dof} · p = ${chi.p.toFixed(4)} · ${chi.significatif ? 'significatif' : 'non significatif'}`
    : chi.message;
  r += 2;
  const w = stat.welch_ttest;
  ws.getCell(r, 1).value = 't-test de Welch';
  ws.getCell(r, 1).font = { bold: true };
  r += 1;
  ws.getCell(r, 1).value = w.applicable
    ? `t = ${w.t.toFixed(3)} · p = ${w.p.toFixed(4)} · ${w.significatif ? 'significatif' : 'non significatif'}`
    : w.message;
  setWidths(ws, [90]);
}

async function nouveauClasseur() {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SCS DataStudio';
  wb.created = new Date();
  return wb;
}

async function telechargerClasseur(wb: any, nomFichier: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exporterFreqExcel(freq: FrequencyResponse, libelle: Libelle) {
  const wb = await nouveauClasseur();
  Object.entries(freq.tables).forEach(([code, rows]) =>
    ajouterFreqSheet(wb, libelle(code), code, rows),
  );
  await telechargerClasseur(wb, 'tris_a_plat.xlsx');
}

export async function exporterCrossExcel(cross: CrosstabResponse, libelle: Libelle) {
  const wb = await nouveauClasseur();
  ajouterCrossSheets(wb, cross, libelle);
  await telechargerClasseur(wb, 'croisements.xlsx');
}

export async function exporterMultiExcel(multi: MultiResponse) {
  const wb = await nouveauClasseur();
  ajouterMultiSheets(wb, multi);
  await telechargerClasseur(wb, 'reponses_multiples.xlsx');
}

/** Export global : tout ce qui a été produit dans un seul classeur. */
export async function exporterGlobalExcel(opts: {
  freq: FrequencyResponse | null;
  cross: CrosstabResponse | null;
  multi: MultiResponse | null;
  stat: StatTestResponse | null;
  statRow?: string;
  statCol?: string;
  libelle: Libelle;
  nomFichier?: string;
}) {
  const wb = await nouveauClasseur();
  if (opts.freq) {
    Object.entries(opts.freq.tables).forEach(([code, rows]) =>
      ajouterFreqSheet(wb, opts.libelle(code), code, rows),
    );
  }
  if (opts.cross) ajouterCrossSheets(wb, opts.cross, opts.libelle);
  if (opts.multi) ajouterMultiSheets(wb, opts.multi);
  if (opts.stat && opts.statRow && opts.statCol) {
    ajouterStatSheet(wb, opts.stat, opts.libelle, opts.statRow, opts.statCol);
  }
  if (wb.worksheets.length === 0) {
    const ws = wb.addWorksheet('Aucun résultat');
    ws.getCell(1, 1).value =
      'Produisez au moins un tri à plat, un croisement, une analyse multi ou un test.';
  }
  await telechargerClasseur(wb, opts.nomFichier || 'export_global.xlsx');
}
/* eslint-enable @typescript-eslint/no-explicit-any */
