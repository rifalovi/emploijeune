/**
 * Couleurs officielles de l'Organisation Internationale de la Francophonie.
 *
 * Source normative : `docs/branding/sources/OIF_mini_charte.pdf` (éd. 2007,
 * W & Cie) — page 8 « L'univers de couleurs ».
 *
 * Ces couleurs sont VERROUILLÉES : toute modification ou création de variante
 * est un interdit formel de la charte (page 11).
 *
 * Pour toute question de branding : com@francophonie.org
 */

type OifColor = {
  hex: string;
  pantone: string;
  rgb: string;
  cmyk?: string;
  ral?: string;
  usage?: string;
};

/**
 * Les six couleurs du logotype de l'OIF — palette institutionnelle principale.
 */
export const OIF_COLORS_LOGO: Record<
  'gris' | 'jaune' | 'vert' | 'violet' | 'rouge' | 'bleuCyan',
  OifColor
> = {
  gris: {
    hex: '#2E292D',
    pantone: 'Cool Gray 11 C',
    rgb: '46, 41, 45',
    cmyk: '10, 10, 10, 80',
    ral: '7024',
  },
  jaune: {
    hex: '#FDCD00',
    pantone: '116 C',
    rgb: '253, 205, 0',
    cmyk: '0, 15, 100, 0',
    ral: '085 80 80',
  },
  vert: {
    hex: '#7EB301',
    pantone: '376 C',
    rgb: '126, 179, 1',
    cmyk: '53, 0, 100, 0',
    ral: '120 70 75',
  },
  violet: {
    hex: '#5D0073',
    pantone: '2603 C',
    rgb: '93, 0, 115',
    cmyk: '70, 100, 0, 0',
    ral: '320 30 37',
  },
  rouge: {
    hex: '#E40001',
    pantone: '485 C',
    rgb: '228, 0, 1',
    cmyk: '0, 94, 87, 0',
    ral: '040 50 70',
  },
  bleuCyan: {
    hex: '#0198E9',
    pantone: 'Process Cyan C',
    rgb: '1, 152, 233',
    cmyk: '100, 0, 0, 0',
    ral: '~5015',
  },
};

/**
 * Palette complémentaire destinée aux documents des Instances de la Francophonie.
 * Non utilisée par défaut dans la plateforme — réservée aux productions
 * éditoriales spécifiques (Sommets, CMF, CPF).
 */
export const OIF_COLORS_COMPLEMENTAIRES: Record<
  'violetInstances' | 'bleuInstances' | 'jauneInstances' | 'grisClair',
  OifColor
> = {
  violetInstances: {
    hex: '#7D0996',
    pantone: '2602 C',
    rgb: '125, 9, 150',
    cmyk: '63, 100, 0, 3',
    usage: "Sommets des chefs d'État et de gouvernement",
  },
  bleuInstances: {
    hex: '#3878DB',
    pantone: '2727 C',
    rgb: '56, 120, 219',
    cmyk: '80, 40, 0, 0',
    usage: 'CMF (Conférence ministérielle de la Francophonie)',
  },
  jauneInstances: {
    hex: '#FDCD00',
    pantone: '116 C',
    rgb: '253, 205, 0',
    cmyk: '0, 15, 100, 0',
    usage: 'CPF (Conseil permanent de la Francophonie)',
  },
  grisClair: {
    hex: '#DFDCD8',
    pantone: 'Warm gray 1 C',
    rgb: '223, 220, 216',
    cmyk: '0, 4, 4, 20',
    usage: 'Autres éditions',
  },
};

/**
 * Export aplati pour usage programmatique (ex: génération de chartes chart.js).
 */
export const OIF_PALETTE = {
  ...OIF_COLORS_LOGO,
  ...OIF_COLORS_COMPLEMENTAIRES,
} as const;

export type OifColorKey = keyof typeof OIF_PALETTE;
