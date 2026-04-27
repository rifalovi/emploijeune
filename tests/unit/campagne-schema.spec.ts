import { describe, it, expect } from 'vitest';
import {
  creerCampagneSchema,
  filtresStrateASchema,
  filtresStrateBSchema,
  resumerStrate,
  MODES_SELECTION,
  MODE_SELECTION_LIBELLES,
} from '@/lib/schemas/campagne';

const baseValide = {
  nom: 'Évaluation post-formation Mali 2024',
  questionnaire: 'A' as const,
  type_vague: 'ponctuelle',
  mode_selection: 'filtres' as const,
  filtres: { projets: ['PROJ_A14'], pays: ['MLI'], annees: [2024] },
  plafond: 50,
};

describe('creerCampagneSchema', () => {
  it('accepte un payload valide', () => {
    expect(creerCampagneSchema.safeParse(baseValide).success).toBe(true);
  });

  it('rejette nom < 3 chars', () => {
    expect(creerCampagneSchema.safeParse({ ...baseValide, nom: 'X' }).success).toBe(false);
  });

  it('rejette nom > 200 chars', () => {
    expect(creerCampagneSchema.safeParse({ ...baseValide, nom: 'a'.repeat(201) }).success).toBe(
      false,
    );
  });

  it('description optionnelle', () => {
    expect(creerCampagneSchema.safeParse(baseValide).success).toBe(true);
    expect(
      creerCampagneSchema.safeParse({ ...baseValide, description: 'Contexte précis' }).success,
    ).toBe(true);
  });

  it('rejette questionnaire hors enum', () => {
    expect(creerCampagneSchema.safeParse({ ...baseValide, questionnaire: 'C' }).success).toBe(
      false,
    );
  });

  it('rejette mode_selection hors enum', () => {
    expect(creerCampagneSchema.safeParse({ ...baseValide, mode_selection: 'auto' }).success).toBe(
      false,
    );
  });

  it('mode manuel exige cibles_manuelles non vides', () => {
    const r = creerCampagneSchema.safeParse({
      ...baseValide,
      mode_selection: 'manuelle',
      filtres: {},
      cibles_manuelles: [],
    });
    expect(r.success).toBe(false);
  });

  it('mode manuel valide avec au moins 1 cible', () => {
    const r = creerCampagneSchema.safeParse({
      ...baseValide,
      mode_selection: 'manuelle',
      filtres: {},
      cibles_manuelles: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(r.success).toBe(true);
  });

  it('rejette plafond > 200', () => {
    expect(creerCampagneSchema.safeParse({ ...baseValide, plafond: 250 }).success).toBe(false);
  });

  it('rejette plafond < 1', () => {
    expect(creerCampagneSchema.safeParse({ ...baseValide, plafond: 0 }).success).toBe(false);
  });

  it('email_test_override accepte vide ou email valide', () => {
    expect(creerCampagneSchema.safeParse({ ...baseValide, email_test_override: '' }).success).toBe(
      true,
    );
    expect(
      creerCampagneSchema.safeParse({ ...baseValide, email_test_override: 'a@b.fr' }).success,
    ).toBe(true);
    expect(
      creerCampagneSchema.safeParse({ ...baseValide, email_test_override: 'pas-un-email' }).success,
    ).toBe(false);
  });
});

describe('filtresStrateASchema', () => {
  it('accepte tous filtres vides', () => {
    expect(filtresStrateASchema.safeParse({}).success).toBe(true);
  });

  it('accepte multi-valeurs', () => {
    expect(
      filtresStrateASchema.safeParse({
        projets: ['PROJ_A14', 'PROJ_A19'],
        pays: ['MLI', 'BFA'],
        annees: [2023, 2024, 2025],
        sexe: 'F',
      }).success,
    ).toBe(true);
  });

  it('rejette code projet inconnu', () => {
    expect(filtresStrateASchema.safeParse({ projets: ['INEXISTANT'] }).success).toBe(false);
  });
});

describe('filtresStrateBSchema', () => {
  it('accepte filtres B (annees_appui)', () => {
    expect(
      filtresStrateBSchema.safeParse({
        projets: ['PROJ_A14'],
        annees_appui: [2024],
        types_structure: ['ASSOCIATION'],
      }).success,
    ).toBe(true);
  });
});

describe('resumerStrate', () => {
  it('génère un résumé pour Q A', () => {
    const r = resumerStrate('A', {
      projets: ['PROJ_A14'],
      pays: ['MLI'],
      annees: [2024],
      sexe: 'F',
    });
    expect(r).toContain('Bénéficiaires');
    expect(r).toContain('PROJ_A14');
    expect(r).toContain('MLI');
    expect(r).toContain('2024');
    expect(r).toContain('Femmes');
  });

  it('génère un résumé pour Q B', () => {
    const r = resumerStrate('B', {
      projets: ['PROJ_A19'],
      pays: ['BFA', 'BEN'],
      annees_appui: [2025],
    });
    expect(r).toContain('Structures');
    expect(r).toContain('PROJ_A19');
    expect(r).toContain('BFA, BEN');
    expect(r).toContain('2025');
  });

  it('résumé minimal sans filtre', () => {
    expect(resumerStrate('A', {})).toBe('Bénéficiaires');
    expect(resumerStrate('B', {})).toBe('Structures');
  });
});

describe('MODES_SELECTION', () => {
  it('expose 3 modes avec libellés', () => {
    expect(MODES_SELECTION).toEqual(['toutes', 'filtres', 'manuelle']);
    for (const m of MODES_SELECTION) {
      expect(MODE_SELECTION_LIBELLES[m]).toBeTruthy();
    }
  });
});
