'use client';

/**
 * Export PDF du rapport IA de l'Atelier d'analyse (SCS DataStudio).
 * Rendu institutionnel (titres, paragraphes, listes, tableaux, graphiques) via
 * @react-pdf/renderer, chargé dynamiquement au clic. On utilise createElement
 * (pas de JSX) pour garder un simple module .ts.
 */

import { parseMarkdown } from './markdown-blocks';
import { chartSpecToPng } from './chart-svg';

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

export async function exporterRapportPdf(markdown: string, titre = 'Rapport') {
  const [rpdf, reactMod] = await Promise.all([import('@react-pdf/renderer'), import('react')]);
  const { pdf, Document, Page, Text, View, Image, StyleSheet } = rpdf as any;
  const React = (reactMod as any).default ?? reactMod;
  const h = React.createElement;

  const styles = StyleSheet.create({
    page: {
      paddingVertical: 48,
      paddingHorizontal: 54,
      fontSize: 11,
      color: '#39424e',
      lineHeight: 1.5,
    },
    title: { fontSize: 20, color: '#29282d', marginBottom: 2 },
    meta: { fontSize: 9, color: '#9aa4b0', marginBottom: 14 },
    h1: {
      fontSize: 15,
      color: '#0E4F88',
      marginTop: 14,
      marginBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: '#DCE5EE',
      paddingBottom: 3,
    },
    h2: { fontSize: 13, color: '#5D0073', marginTop: 10, marginBottom: 3 },
    h3: { fontSize: 12, color: '#29282d', marginTop: 8, marginBottom: 2 },
    p: { marginBottom: 4, textAlign: 'justify' },
    liRow: { flexDirection: 'row', marginBottom: 2, paddingLeft: 6 },
    bullet: { width: 12, color: '#009fe3' },
    li: { flex: 1 },
    table: { marginVertical: 6, borderWidth: 1, borderColor: '#CBD5E1' },
    trHead: { flexDirection: 'row', backgroundColor: '#0E4F88' },
    tr: { flexDirection: 'row' },
    trAlt: { flexDirection: 'row', backgroundColor: '#F4F6F8' },
    th: {
      flex: 1,
      padding: 4,
      fontSize: 9,
      color: '#FFFFFF',
      borderRightWidth: 1,
      borderRightColor: '#FFFFFF',
    },
    td: {
      flex: 1,
      padding: 4,
      fontSize: 9,
      borderRightWidth: 1,
      borderRightColor: '#E2E8F0',
      borderTopWidth: 1,
      borderTopColor: '#E2E8F0',
    },
    chart: { marginVertical: 8, alignItems: 'center' },
    chartImg: { width: 460, height: 246 },
  });

  const blocs = parseMarkdown(markdown);

  // Pré-rendu des graphiques (rasterisation asynchrone) avant construction.
  const chartImgs = new Map<number, string>();
  await Promise.all(
    blocs.map(async (b, i) => {
      if (b.type === 'chart') {
        const png = await chartSpecToPng(b.spec, 560, 300);
        if (png) chartImgs.set(i, png.dataUrl);
      }
    }),
  );

  const cellW = (n: number) => ({ flex: 1, maxWidth: `${(100 / Math.max(1, n)).toFixed(2)}%` });

  const corps = blocs
    .map((b, i) => {
      if (b.type === 'h1') return h(Text, { key: i, style: styles.h1 }, b.texte);
      if (b.type === 'h2') return h(Text, { key: i, style: styles.h2 }, b.texte);
      if (b.type === 'h3') return h(Text, { key: i, style: styles.h3 }, b.texte);
      if (b.type === 'li')
        return h(
          View,
          { key: i, style: styles.liRow },
          h(Text, { style: styles.bullet }, '•'),
          h(Text, { style: styles.li }, b.texte),
        );
      if (b.type === 'table') {
        const nc = b.headers.length || 1;
        const head = h(
          View,
          { style: styles.trHead },
          ...b.headers.map((c, ci) => h(Text, { key: ci, style: [styles.th, cellW(nc)] }, c)),
        );
        const body = b.rows.map((r, ri) =>
          h(
            View,
            { key: ri, style: ri % 2 ? styles.trAlt : styles.tr },
            ...Array.from({ length: nc }).map((_, ci) =>
              h(Text, { key: ci, style: [styles.td, cellW(nc)] }, String(r[ci] ?? '')),
            ),
          ),
        );
        return h(View, { key: i, style: styles.table, wrap: false }, head, ...body);
      }
      if (b.type === 'chart') {
        const src = chartImgs.get(i);
        if (!src) return null;
        return h(
          View,
          { key: i, style: styles.chart, wrap: false },
          h(Image, { src, style: styles.chartImg }),
        );
      }
      return h(Text, { key: i, style: styles.p }, b.texte);
    })
    .filter(Boolean);

  const doc = h(
    Document,
    {},
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(Text, { style: styles.title }, titre),
      h(Text, { style: styles.meta }, `SCS DataStudio · ${new Date().toLocaleDateString('fr-FR')}`),
      ...corps,
    ),
  );

  const blob = await pdf(doc).toBlob();
  telecharger(blob, 'rapport.pdf');
}
/* eslint-enable @typescript-eslint/no-explicit-any */
