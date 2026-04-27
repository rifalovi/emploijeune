/**
 * Helpers de design pour les charts Recharts (V1.6.0 polish premium).
 *
 * Centralise les styles communs pour garantir la cohérence visuelle des
 * 3 charts du dashboard (top projets, top pays, programmes).
 */

/**
 * Style premium pour les tooltips Recharts :
 * - Fond bleu foncé OIF semi-transparent (lisibilité sur tout fond)
 * - Texte blanc, bordure douce
 * - Ombres subtiles
 *
 * Typé `as const` pour permettre le spread dans <Tooltip> sans conflit
 * de génériques Recharts (les versions 3.x ont un typage strict
 * différent entre v3.0 et v3.8).
 */
export const tooltipPropsPremium = {
  contentStyle: {
    backgroundColor: 'rgba(14, 79, 136, 0.95)', // #0E4F88 + 95% alpha
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(14, 79, 136, 0.25)',
    fontSize: 12,
    color: '#ffffff',
    padding: '10px 14px',
  },
  labelStyle: {
    color: '#ffffff',
    fontWeight: 600,
    marginBottom: 4,
  },
  itemStyle: {
    color: '#ffffff',
  },
  wrapperStyle: {
    outline: 'none',
    zIndex: 50,
  },
} as const;

/**
 * Palette « podium » pour le ranking visuel (1er = couleur dominante).
 * Utilisée par les charts top projets et top pays.
 */
export const PALETTE_PODIUM = [
  '#0E4F88', // 1 : bleu institutionnel OIF
  '#0198E9', // 2 : cyan PS1
  '#7EB301', // 3 : vert PS3
  '#5D0073', // 4 : violet PS2
  '#F5A623', // 5 : doré accent
];

/**
 * Renvoie une couleur selon le rang (0-indexé) dans le top.
 * Au-delà du top 5, opacité dégressive sur le bleu OIF.
 */
export function couleurRang(rang: number): string {
  if (rang < PALETTE_PODIUM.length) return PALETTE_PODIUM[rang]!;
  // Top 6+ : nuances de bleu OIF dégressives
  const opacite = Math.max(0.3, 1 - (rang - PALETTE_PODIUM.length) * 0.1);
  return `rgba(14, 79, 136, ${opacite.toFixed(2)})`;
}
