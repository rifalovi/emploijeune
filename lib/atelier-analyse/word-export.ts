'use client';

/**
 * Exports Word (.docx) documentés de l'Atelier d'analyse (SCS DataStudio).
 * Rapport structuré par sections avec tableaux (tris à plat, croisements,
 * réponses multiples, tests) et, si disponible, le rapport IA rédigé.
 * La bibliothèque `docx` est chargée dynamiquement au clic.
 */

import { inlineTokens, parseMarkdown } from './markdown-blocks';
import type {
  CrosstabResponse,
  FrequencyResponse,
  MultiResponse,
  PreviewResponse,
  StatTestResponse,
} from './types';

type Libelle = (code: string) => string;

// Palette institutionnelle OIF (mêmes teintes que l'aperçu plateforme).
const BLEU = '0E4F88'; // titres H1 / en-têtes de tableau
const VIOLET = '5D0073'; // titres H2
const FONCE = '29282D';
const GRIS = '64748B';
const GRIS_LIGNE = 'D9E1EA';
const BANDE = 'F4F6F8';
const POLICE = 'Calibri';

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

/** Fragments stylés (gras / italique) d'un texte en ligne → TextRun[]. */
function runs(docx: any, texte: string, base: any = {}): any[] {
  const { TextRun } = docx;
  return inlineTokens(texte).map(
    (t) =>
      new TextRun({
        text: t.text,
        bold: base.bold || t.bold,
        italics: base.italics || t.italic,
        color: base.color,
        size: base.size,
        font: POLICE,
      }),
  );
}

function makeTable(docx: any, headers: string[], rows: (string | number)[][]): any {
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle, AlignmentType } =
    docx;
  const bord = { style: BorderStyle.SINGLE, size: 4, color: GRIS_LIGNE };
  const bordures = {
    top: bord,
    bottom: bord,
    left: bord,
    right: bord,
    insideHorizontal: bord,
    insideVertical: bord,
  };
  const marges = { top: 60, bottom: 60, left: 100, right: 100 };
  const cell = (
    val: string | number,
    opts: { header?: boolean; bold?: boolean; band?: boolean; align?: any } = {},
  ) =>
    new TableCell({
      margins: marges,
      shading: opts.header ? { fill: BLEU } : opts.band ? { fill: BANDE } : undefined,
      children: [
        new Paragraph({
          alignment: opts.align,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: String(val ?? ''),
              bold: opts.header || opts.bold,
              color: opts.header ? 'FFFFFF' : FONCE,
              size: 19,
              font: POLICE,
            }),
          ],
        }),
      ],
    });
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((hd, i) =>
      cell(hd, { header: true, align: i === 0 ? AlignmentType.LEFT : AlignmentType.LEFT }),
    ),
  });
  const bodyRows = rows.map((r, ri) => {
    const total = r[0] === 'Total' || r[0] === 'Total répondants valides';
    return new TableRow({
      children: r.map((v, ci) =>
        cell(v, { bold: total || (ci === 0 && false), band: !total && ri % 2 === 1 }),
      ),
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordures,
    rows: [headerRow, ...bodyRows],
  });
}

function titreParagraphe(docx: any, niveau: 1 | 2 | 3, texte: string): any {
  const { Paragraph, TextRun, BorderStyle } = docx;
  const conf =
    niveau === 1
      ? { color: BLEU, size: 30, before: 320, after: 120, bord: true }
      : niveau === 2
        ? { color: VIOLET, size: 26, before: 260, after: 100, bord: false }
        : { color: FONCE, size: 23, before: 200, after: 80, bord: false };
  return new Paragraph({
    spacing: { before: conf.before, after: conf.after },
    border: conf.bord
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: GRIS_LIGNE, space: 4 } }
      : undefined,
    children: [
      new TextRun({ text: texte, bold: true, color: conf.color, size: conf.size, font: POLICE }),
    ],
  });
}

async function blocsRapport(docx: any, markdown: string): Promise<any[]> {
  const { Paragraph, ImageRun, AlignmentType, BorderStyle } = docx;
  const { chartSpecToPng } = await import('./chart-svg');
  const out: any[] = [];
  for (const b of parseMarkdown(markdown)) {
    if (b.type === 'h1') out.push(titreParagraphe(docx, 1, b.texte));
    else if (b.type === 'h2') out.push(titreParagraphe(docx, 2, b.texte));
    else if (b.type === 'h3') out.push(titreParagraphe(docx, 3, b.texte));
    else if (b.type === 'li') {
      out.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 20, after: 20 },
          children: runs(docx, b.texte, { size: 22 }),
        }),
      );
    } else if (b.type === 'quote') {
      // Témoignage / citation : filet bleu à gauche, italique, retrait.
      out.push(
        new Paragraph({
          indent: { left: 240 },
          spacing: { before: 80, after: 80 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: BLEU, space: 8 } },
          children: runs(docx, b.texte, { italics: true, color: GRIS, size: 22 }),
        }),
      );
    } else if (b.type === 'table') {
      out.push(makeTable(docx, b.headers, b.rows));
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (b.type === 'chart') {
      const png = await chartSpecToPng(b.spec, 560, 300).catch(() => null);
      if (png) {
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 120 },
            children: [
              new ImageRun({
                type: 'png',
                data: png.bytes,
                transformation: { width: 500, height: 268 },
              }),
            ],
          }),
        );
      }
    } else {
      out.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 40, after: 120, line: 276 },
          children: runs(docx, b.texte, { size: 22 }),
        }),
      );
    }
  }
  return out;
}

async function construireDocument(
  docx: any,
  children: any[],
  titre: string,
  sousTitre?: string,
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, BorderStyle } = docx;
  const entete: any[] = [
    new Paragraph({
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLEU, space: 6 } },
      children: [new TextRun({ text: titre, bold: true, color: BLEU, size: 34, font: POLICE })],
    }),
  ];
  if (sousTitre) {
    entete.push(
      new Paragraph({
        spacing: { after: 20 },
        children: [
          new TextRun({ text: sousTitre, italics: true, color: GRIS, size: 20, font: POLICE }),
        ],
      }),
    );
  }
  entete.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `SCS DataStudio · ${new Date().toLocaleDateString('fr-FR')}`,
          color: GRIS,
          size: 18,
          font: POLICE,
        }),
      ],
    }),
  );
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: POLICE, size: 22, color: FONCE },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        children: [...entete, ...children],
      },
    ],
  });
  return Packer.toBlob(doc);
}

/** Rapport IA rédigé exporté seul en .docx (avec tableaux et graphiques). */
export async function exporterRapportWord(markdown: string, titre = 'Rapport') {
  const docx = await import('docx');
  const blob = await construireDocument(
    docx,
    await blocsRapport(docx, markdown),
    titre,
    'Rapport généré',
  );
  telecharger(blob, 'rapport.docx');
}

/** Export Word d'UN seul tri à plat (tableau effectifs / %). */
export async function exporterFreqTableWord(
  titre: string,
  code: string,
  rows: FrequencyResponse['tables'][string],
) {
  const docx = await import('docx');
  const table = makeTable(
    docx,
    ['Modalité', 'Effectif', '%', '% valide', '% cumulé'],
    rows.map((r) => [
      r.Modalité,
      r.Effectif,
      fmtPct(r['%']),
      fmtPct(r['% valide']),
      fmtPct(r['% cumulé']),
    ]),
  );
  const blob = await construireDocument(docx, [table], titre, `Tri à plat · ${code}`);
  telecharger(blob, 'tri_a_plat.docx');
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
    children.push(...(await blocsRapport(docx, opts.rapport)));
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
