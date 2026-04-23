/**
 * Couleurs officielles des 3 Programmes Stratégiques de l'OIF.
 *
 * Source normative : `docs/branding/sources/Code couleur programmation OIF.pdf`
 *
 * Ces couleurs sont celles des pastilles de la programmation 2024-2027
 * (PS1 / PS2 / PS3). Utilisables pour colorer les projets dans les
 * dashboards analytiques, les graphiques et les filtres par Programme.
 *
 * ATTENTION : chaque Programme a une couleur primaire (foncée) et une
 * couleur accent (plus claire, tirée de la même tonalité, utilisée comme
 * amorce sur les pastilles de la charte).
 */

type ProgrammeCouleur = {
  code: 'PS1' | 'PS2' | 'PS3';
  libelle: string;
  principale: string; // hex
  accent: string; // hex
  pantone: string;
  cmyk: string;
  rgb: string;
};

export const PROGRAMMES_STRATEGIQUES: Record<'PS1' | 'PS2' | 'PS3', ProgrammeCouleur> = {
  PS1: {
    code: 'PS1',
    libelle: "La langue française au service des cultures et de l'éducation",
    principale: '#0198E9', // bleu cyan (Pantone Process Cyan C)
    accent: '#4FBCEF',
    pantone: 'Process Cyan C',
    cmyk: '100, 0, 0, 0',
    rgb: '1, 152, 233',
  },
  PS2: {
    code: 'PS2',
    libelle: 'La langue française au service de la démocratie et de la gouvernance',
    principale: '#5D0073', // violet (Pantone 2603 C)
    accent: '#8E4BA0',
    pantone: '2603 C',
    cmyk: '70, 100, 0, 0',
    rgb: '93, 0, 115',
  },
  PS3: {
    code: 'PS3',
    libelle: 'La langue française, vecteur de développement durable',
    principale: '#7EB301', // vert (Pantone 376 C)
    accent: '#A9CB5C',
    pantone: '376 C',
    cmyk: '53, 0, 100, 0',
    rgb: '126, 179, 1',
  },
};

/**
 * Helper : renvoie la couleur principale d'un code programme.
 * Usage : `couleurPSPrincipale('PS1')` → `"#0198E9"`
 */
export function couleurPSPrincipale(code: 'PS1' | 'PS2' | 'PS3'): string {
  return PROGRAMMES_STRATEGIQUES[code].principale;
}

/**
 * Retourne le PS associé à un code projet (PROJ_A*).
 * Aligné avec le seed SQL `supabase/seed.sql` : projets.programme_strategique.
 */
export function programmeStrategiqueDuProjet(projetCode: string): 'PS1' | 'PS2' | 'PS3' | null {
  // Tous les projets A14 à A20 sont sur PS3 (Développement durable, inclut emploi jeunes).
  // A09 à A13 = PS2 ; A01a à A08 = PS1.
  const match = projetCode.match(/^PROJ_A(\d{2})[a-z]?$/);
  if (!match || !match[1]) return null;
  const num = parseInt(match[1], 10);
  if (num >= 1 && num <= 8) return 'PS1';
  if (num >= 9 && num <= 13) return 'PS2';
  if (num >= 14 && num <= 20) return 'PS3';
  return null;
}
