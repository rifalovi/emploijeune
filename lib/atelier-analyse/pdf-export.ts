'use client';

/**
 * Export PDF du rapport IA de l'Atelier d'analyse (SCS DataStudio).
 * Rendu mis en forme (titres, paragraphes, listes) via @react-pdf/renderer,
 * chargé dynamiquement au clic. On utilise createElement (pas de JSX) pour
 * garder un simple module .ts.
 */

import { parseMarkdown } from './markdown-blocks';

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
  const { pdf, Document, Page, Text, View, StyleSheet } = rpdf as any;
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
    h1: { fontSize: 15, color: '#29282d', marginTop: 12, marginBottom: 4 },
    h2: { fontSize: 13, color: '#66318f', marginTop: 10, marginBottom: 3 },
    h3: { fontSize: 12, color: '#29282d', marginTop: 8, marginBottom: 2 },
    p: { marginBottom: 4 },
    liRow: { flexDirection: 'row', marginBottom: 2, paddingLeft: 6 },
    bullet: { width: 12, color: '#009fe3' },
    li: { flex: 1 },
  });

  const corps = parseMarkdown(markdown).map((b, i) => {
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
    return h(Text, { key: i, style: styles.p }, b.texte);
  });

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
