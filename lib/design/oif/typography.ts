/**
 * Typographie de la plateforme — conforme à l'univers typographique OIF.
 *
 * Source : `docs/branding/sources/OIF_mini_charte.pdf` page 9.
 *
 * La charte prescrit deux polices :
 *   1. **Maverick** — réservée au logotype (écriture de « la francophonie »).
 *      Non utilisable pour le corps de texte : la charte précise qu'elle est
 *      réservée aux titres de documents officiels imprimés. Nous ne l'importons
 *      pas sur la plateforme (licence commerciale, pas de version web).
 *   2. **Helvetica Neue** — police officielle de tous les textes OIF.
 *      Disponible uniquement sous licence commerciale, pas de version web libre.
 *
 * Choix plateforme web
 * --------------------
 * Pour respecter l'esprit de la charte tout en restant RGPD-friendly et sans
 * dépendance commerciale, nous utilisons **Inter** (Google Fonts) comme
 * substitut web de Helvetica Neue. Inter est la police sans-sérif grotesque
 * la plus proche visuellement de Helvetica Neue, optimisée pour les écrans,
 * et distribuée sous licence OFL (Open Font License).
 *
 * Fallback stack : Helvetica Neue si installée système → Helvetica → Arial
 * → sans-serif générique. Sur macOS et iOS, Helvetica Neue est préinstallée,
 * donc les utilisateurs Apple verront la police officielle OIF.
 */

export const OIF_FONTS = {
  /**
   * Pile de fontes pour les titres et le corps de texte.
   * Variable CSS `--font-inter` définie dans `app/layout.tsx` via `next/font/google`.
   */
  sans: ['var(--font-inter)', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'].join(', '),

  /**
   * Pile monospace pour les codes techniques (IDs, codes projet, etc.).
   */
  mono: [
    'var(--font-geist-mono)',
    'ui-monospace',
    'SFMono-Regular',
    '"SF Mono"',
    'Menlo',
    'Monaco',
    'Consolas',
    'monospace',
  ].join(', '),
} as const;

/**
 * Graisses utilisées par défaut (alignées sur les poids de Helvetica Neue
 * cités dans la charte : 45 Light, 55 Roman, 75 Bold, 95 Black).
 */
export const OIF_FONT_WEIGHTS = {
  light: 300, // ≈ 45 Light
  regular: 400, // ≈ 55 Roman
  medium: 500,
  semibold: 600, // ≈ 65 Medium
  bold: 700, // ≈ 75 Bold
  black: 900, // ≈ 95 Black
} as const;
