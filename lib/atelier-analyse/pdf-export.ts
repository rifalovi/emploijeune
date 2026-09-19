'use client';

/**
 * Export PDF du rapport IA de l'Atelier d'analyse (SCS DataStudio).
 * Rendu institutionnel (titres, paragraphes, listes, citations, tableaux,
 * graphiques) via @react-pdf/renderer, chargé dynamiquement au clic. On utilise
 * createElement (pas de JSX) pour garder un simple module .ts.
 */

import { inlineTokens, parseMarkdown } from './markdown-blocks';
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
      paddingVertical: 44,
      paddingHorizontal: 48,
      fontSize: 10.5,
      fontFamily: 'Helvetica',
      color: '#29282d',
      lineHeight: 1.55,
    },
    title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0E4F88', marginBottom: 3 },
    titleRule: { borderBottomWidth: 1.5, borderBottomColor: '#0E4F88', marginBottom: 6 },
    meta: { fontSize: 8.5, color: '#94a3b8', marginBottom: 16 },
    h1: {
      fontSize: 14,
      fontFamily: 'Helvetica-Bold',
      color: '#0E4F88',
      marginTop: 16,
      marginBottom: 6,
      borderBottomWidth: 0.75,
      borderBottomColor: '#DCE5EE',
      paddingBottom: 3,
    },
    h2: {
      fontSize: 12.5,
      fontFamily: 'Helvetica-Bold',
      color: '#5D0073',
      marginTop: 11,
      marginBottom: 4,
    },
    h3: {
      fontSize: 11.5,
      fontFamily: 'Helvetica-Bold',
      color: '#29282d',
      marginTop: 8,
      marginBottom: 3,
    },
    p: { marginBottom: 6, textAlign: 'justify' },
    quote: {
      marginVertical: 5,
      marginLeft: 4,
      paddingLeft: 10,
      borderLeftWidth: 3,
      borderLeftColor: '#0E4F88',
      color: '#64748b',
      fontFamily: 'Helvetica-Oblique',
    },
    liRow: { flexDirection: 'row', marginBottom: 3, paddingLeft: 4 },
    bullet: { width: 12, color: '#0E4F88' },
    li: { flex: 1 },
    bold: { fontFamily: 'Helvetica-Bold' },
    italic: { fontFamily: 'Helvetica-Oblique' },
    table: { marginVertical: 7, borderWidth: 0.75, borderColor: '#D9E1EA', borderRadius: 2 },
    trHead: { flexDirection: 'row', backgroundColor: '#0E4F88' },
    tr: { flexDirection: 'row' },
    trAlt: { flexDirection: 'row', backgroundColor: '#F4F6F8' },
    th: {
      flexGrow: 1,
      flexBasis: 0,
      padding: 5,
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#FFFFFF',
    },
    td: {
      flexGrow: 1,
      flexBasis: 0,
      padding: 5,
      fontSize: 9,
      borderTopWidth: 0.5,
      borderTopColor: '#E2E8F0',
    },
    tdTotal: { fontFamily: 'Helvetica-Bold' },
    chart: { marginVertical: 8, alignItems: 'center' },
    chartImg: { width: 470, height: 252 },
  });

  // Rendu du texte en ligne (gras / italique) en éléments Text imbriqués.
  const inlineEls = (texte: string) =>
    inlineTokens(texte).map((t, k) =>
      h(
        Text,
        { key: k, style: t.bold ? styles.bold : t.italic ? styles.italic : undefined },
        t.text,
      ),
    );

  const blocs = parseMarkdown(markdown);

  // Pré-rendu des graphiques (rasterisation asynchrone) avant construction.
  const chartImgs = new Map<number, string>();
  await Promise.all(
    blocs.map(async (b, i) => {
      if (b.type === 'chart') {
        try {
          const png = await chartSpecToPng(b.spec, 560, 300);
          if (png) chartImgs.set(i, png.dataUrl);
        } catch {
          /* graphique ignoré si le rendu échoue */
        }
      }
    }),
  );

  const corps = blocs
    .map((b, i) => {
      if (b.type === 'h1') return h(Text, { key: i, style: styles.h1 }, b.texte);
      if (b.type === 'h2') return h(Text, { key: i, style: styles.h2 }, b.texte);
      if (b.type === 'h3') return h(Text, { key: i, style: styles.h3 }, b.texte);
      if (b.type === 'quote')
        return h(Text, { key: i, style: styles.quote }, ...inlineEls(b.texte));
      if (b.type === 'li')
        return h(
          View,
          { key: i, style: styles.liRow },
          h(Text, { style: styles.bullet }, '•'),
          h(Text, { style: styles.li }, ...inlineEls(b.texte)),
        );
      if (b.type === 'table') {
        const nc = b.headers.length || 1;
        const head = h(
          View,
          { style: styles.trHead },
          ...b.headers.map((c, ci) => h(Text, { key: ci, style: styles.th }, c)),
        );
        const body = b.rows.map((r, ri) => {
          const total = r[0] === 'Total' || r[0] === 'Total répondants valides';
          return h(
            View,
            { key: ri, style: !total && ri % 2 ? styles.trAlt : styles.tr },
            ...Array.from({ length: nc }).map((_, ci) =>
              h(
                Text,
                { key: ci, style: total ? [styles.td, styles.tdTotal] : styles.td },
                String(r[ci] ?? ''),
              ),
            ),
          );
        });
        return h(View, { key: i, style: styles.table }, head, ...body);
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
      return h(Text, { key: i, style: styles.p }, ...inlineEls(b.texte));
    })
    .filter(Boolean);

  const doc = h(
    Document,
    {},
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(Text, { style: styles.title }, titre),
      h(View, { style: styles.titleRule }),
      h(Text, { style: styles.meta }, `SCS DataStudio · ${new Date().toLocaleDateString('fr-FR')}`),
      ...corps,
    ),
  );

  const blob = await pdf(doc).toBlob();
  telecharger(blob, 'rapport.pdf');
}
/* eslint-enable @typescript-eslint/no-explicit-any */
