'use client';

/**
 * Exports Word (.docx) documentés de l'Atelier d'analyse (SCS DataStudio).
 * Rapport structuré par sections avec tableaux (tris à plat, croisements,
 * réponses multiples, tests) et, si disponible, le rapport IA rédigé.
 * La bibliothèque `docx` est chargée dynamiquement au clic.
 */

import { parseMarkdown } from './markdown-blocks';
import type {
  CrosstabResponse,
  FrequencyResponse,
  MultiResponse,
  PreviewResponse,
  StatTestResponse,
} from './types';

type Libelle = (code: string) => string;

const BLEU = '009FE3';
const FONCE = '29282D';

function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : `${(v * 100).toFixed(1)} %`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function makeTable(docx: any, headers: string[], rows: (string | number)[][]): any {
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType } = docx;
  const cell = (val: string | number, opts: { header?: boolean; bold?: boolean } = {}) =>
    new TableCell({
      shading: opts.header ? { fill: BLEU } : undefined,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: String(val ?? ''),
              bold: opts.header || opts.bold,
              color: opts.header ? 'FFFFFF' : undefined,
              size: 20,
            }),
          ],
        }),
      ],
    });
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => cell(h, { header: true })),
  });
  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        children: r.map((v, i) =>
          cell(v, { bold: i === 0 && (v === 'Total' || v === 'Total répondants valides') }),
        ),
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

function blocsRapport(docx: any, markdown: string): any[] {
  const { Paragraph, HeadingLevel, TextRun } = docx;
  return parseMarkdown(markdown).map((b) => {
    if (b.type === 'h1') return new Paragraph({ text: b.texte, heading: HeadingLevel.HEADING_1 });
    if (b.type === 'h2') return new Paragraph({ text: b.texte, heading: HeadingLevel.HEADING_2 });
    if (b.type === 'h3') return new Paragraph({ text: b.texte, heading: HeadingLevel.HEADING_3 });
    if (b.type === 'li')
      return new Paragraph({ children: [new TextRun(b.texte)], bullet: { level: 0 } });
    return new Paragraph({ children: [new TextRun(b.texte)] });
  });
}

async function construireDocument(
  docx: any,
  children: any[],
  titre: string,
  sousTitre?: string,
): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docx;
  const entete: any[] = [new Paragraph({ text: titre, heading: HeadingLevel.TITLE })];
  if (sousTitre) {
    entete.push(
      new Paragraph({
        children: [new TextRun({ text: sousTitre, italics: true, color: '9AA4B0' })],
      }),
    );
  }
  entete.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `SCS DataStudio · ${new Date().toLocaleDateString('fr-FR')}`,
          color: FONCE,
          size: 18,
        }),
      ],
    }),
    new Paragraph({ text: '' }),
  );
  const doc = new Document({ sections: [{ children: [...entete, ...children] }] });
  return Packer.toBlob(doc);
}

/** Rapport IA rédigé exporté seul en .docx. */
export async function exporterRapportWord(markdown: string, titre = 'Rapport') {
  const docx = await import('docx');
  const blob = await construireDocument(
    docx,
    blocsRapport(docx, markdown),
    titre,
    'Rapport généré',
  );
  telecharger(blob, 'rapport.docx');
}

/** Export Word d'une liste (variables juxtaposées) sous forme de tableau. */
export async function exporterListeWord(liste: PreviewResponse, titre = 'Liste') {
  const docx = await import('docx');
  const rows = liste.rows.map((r) => liste.codes.map((c) => (r[c] ?? '') as string | number));
  const table = makeTable(docx, liste.columns, rows);
  const blob = await construireDocument(
    docx,
    [table],
    titre,
    `${liste.n_rows} ligne(s) · ${liste.columns.length} variable(s)`,
  );
  telecharger(blob, 'liste.docx');
}

/** Export Word documenté de tout ce qui a été produit (+ rapport si présent). */
export async function exporterResultatsWord(opts: {
  freq: FrequencyResponse | null;
  cross: CrosstabResponse | null;
  multi: MultiResponse | null;
  stat: StatTestResponse | null;
  statRow?: string;
  statCol?: string;
  rapport?: string | null;
  libelle: Libelle;
  source?: string;
  nomFichier?: string;
}) {
  const docx = await import('docx');
  const { Paragraph, HeadingLevel, TextRun } = docx;
  const children: any[] = [];

  if (opts.freq) {
    children.push(new Paragraph({ text: 'Tris à plat', heading: HeadingLevel.HEADING_1 }));
    for (const [code, rows] of Object.entries(opts.freq.tables)) {
      children.push(new Paragraph({ text: opts.libelle(code), heading: HeadingLevel.HEADING_2 }));
      children.push(
        makeTable(
          docx,
          ['Modalité', 'Effectif', '%', '% valide', '% cumulé'],
          rows.map((r) => [
            r.Modalité,
            r.Effectif,
            fmtPct(r['%']),
            fmtPct(r['% valide']),
            fmtPct(r['% cumulé']),
          ]),
        ),
      );
      children.push(new Paragraph({ text: '' }));
    }
  }

  if (opts.cross) {
    children.push(new Paragraph({ text: 'Croisements', heading: HeadingLevel.HEADING_1 }));
    for (const lyr of opts.cross.layers) {
      const titre = `${opts.libelle(opts.cross.row)} × ${opts.libelle(opts.cross.col)}${
        opts.cross.layer ? ` · ${lyr.layer_value}` : ''
      }`;
      children.push(new Paragraph({ text: titre, heading: HeadingLevel.HEADING_2 }));
      children.push(
        makeTable(
          docx,
          ['Modalité', ...lyr.columns],
          lyr.index.map((idx, ri) => [
            idx,
            ...lyr.columns.map((_c, ci) => lyr.counts[ri]?.[ci] ?? 0),
          ]),
        ),
      );
      children.push(new Paragraph({ text: '' }));
    }
  }

  if (opts.multi && Object.keys(opts.multi.tables).length > 0) {
    children.push(new Paragraph({ text: 'Réponses multiples', heading: HeadingLevel.HEADING_1 }));
    for (const [prefix, table] of Object.entries(opts.multi.tables)) {
      children.push(new Paragraph({ text: prefix, heading: HeadingLevel.HEADING_2 }));
      children.push(
        makeTable(
          docx,
          ['Option', 'Effectif', '% répondants'],
          table.rows.map((r) => [r.Option, r.Effectif, fmtPct(r['Pourcentage répondants'])]),
        ),
      );
      children.push(new Paragraph({ text: '' }));
    }
  }

  if (opts.stat && opts.statRow && opts.statCol) {
    children.push(new Paragraph({ text: 'Tests statistiques', heading: HeadingLevel.HEADING_1 }));
    children.push(
      new Paragraph({
        text: `${opts.libelle(opts.statRow)} × ${opts.libelle(opts.statCol)}`,
        heading: HeadingLevel.HEADING_2,
      }),
    );
    const chi = opts.stat.chi_square;
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Khi² : ', bold: true }),
          new TextRun(
            chi.applicable
              ? `χ² = ${chi.chi2.toFixed(3)} · ddl = ${chi.dof} · p = ${chi.p.toFixed(4)} · ${chi.significatif ? 'significatif' : 'non significatif'}`
              : chi.message,
          ),
        ],
      }),
    );
    const w = opts.stat.welch_ttest;
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 't-test de Welch : ', bold: true }),
          new TextRun(
            w.applicable
              ? `t = ${w.t.toFixed(3)} · p = ${w.p.toFixed(4)} · ${w.significatif ? 'significatif' : 'non significatif'}`
              : w.message,
          ),
        ],
      }),
    );
  }

  if (opts.rapport) {
    children.push(new Paragraph({ text: '' }));
    children.push(...blocsRapport(docx, opts.rapport));
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: 'Aucun résultat à exporter.' }));
  }

  const blob = await construireDocument(
    docx,
    children,
    'Rapport d’analyse — SCS DataStudio',
    opts.source ? `Source : ${opts.source}` : undefined,
  );
  telecharger(blob, opts.nomFichier || 'rapport_analyse.docx');
}
/* eslint-enable @typescript-eslint/no-explicit-any */
