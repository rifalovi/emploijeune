import { describe, it, expect } from 'vitest';
import {
  a2Schema,
  a3Schema,
  a4Schema,
  a5Schema,
  f1Schema,
  c5Schema,
  b2Schema,
  b3Schema,
  b4Schema,
  soumissionQuestionnaireASchema,
  soumissionQuestionnaireBSchema,
  enqueteFiltersSchema,
} from '@/lib/schemas/enquetes/schemas';

const baseSoumissionA = {
  questionnaire: 'A' as const,
  cible_id: '11111111-1111-4111-8111-111111111111',
  consentement_repondant: true as const,
  a2: { a_participe: false },
  a3: { certifie: false },
  a4: { niveau_avant: 'AUCUNE', niveau_apres: 'BON' },
  a5: { situation_avant: 'SANS_EMPLOI', a_accede: false },
  f1: { francais_facilite_emploi: true },
  c5: { satisfaction: 'SATISFAIT', source_questionnaire: 'A' },
};

const baseSoumissionB = {
  questionnaire: 'B' as const,
  cible_id: '22222222-2222-4222-8222-222222222222',
  consentement_repondant: true as const,
  b2: { a_activite_economique: false },
  b3: {},
  b4: { a_genere_indirects: false },
  c5: { satisfaction: 'SATISFAIT', source_questionnaire: 'B' },
};

describe('a2Schema (achèvement)', () => {
  it('accepte « pas de participation » sans champs additionnels', () => {
    expect(a2Schema.safeParse({ a_participe: false }).success).toBe(true);
  });

  it('rejette participation=true sans type/durée/achèvement', () => {
    const r = a2Schema.safeParse({ a_participe: true });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('type_formation');
      expect(paths).toContain('duree_formation');
      expect(paths).toContain('achevement');
    }
  });

  it('rejette type=AUTRE sans précision', () => {
    const r = a2Schema.safeParse({
      a_participe: true,
      type_formation: 'AUTRE',
      duree_formation: 'MOINS_1_MOIS',
      achevement: 'ACHEVEE_100',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'type_formation_autre')).toBe(true);
    }
  });
});

describe('a4Schema (gain compétences)', () => {
  it('accepte progression normale', () => {
    expect(a4Schema.safeParse({ niveau_avant: 'FAIBLE', niveau_apres: 'BON' }).success).toBe(true);
  });

  it('rejette régression de niveau', () => {
    const r = a4Schema.safeParse({ niveau_avant: 'BON', niveau_apres: 'FAIBLE' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path.join('.')).toBe('niveau_apres');
    }
  });

  it('accepte stagnation (même niveau)', () => {
    expect(a4Schema.safeParse({ niveau_avant: 'MOYEN', niveau_apres: 'MOYEN' }).success).toBe(true);
  });
});

describe('a5Schema (insertion)', () => {
  it('accepte « pas accédé » sans détails activité', () => {
    expect(a5Schema.safeParse({ situation_avant: 'SANS_EMPLOI', a_accede: false }).success).toBe(
      true,
    );
  });

  it('rejette accédé=true sans année/nature/durée', () => {
    const r = a5Schema.safeParse({ situation_avant: 'SANS_EMPLOI', a_accede: true });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toEqual(
        expect.arrayContaining(['annee_acces', 'nature_activite', 'duree_activite']),
      );
    }
  });

  it('rejette evolution=AUGMENTE sans proportion', () => {
    const r = a5Schema.safeParse({
      situation_avant: 'EMPLOYE',
      a_accede: false,
      evolution_revenu: 'AUGMENTE',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path.join('.')).toBe('proportion_augmentation');
    }
  });
});

describe('c5Schema (satisfaction)', () => {
  it('accepte satisfaction sans raison si pas PAS_DU_TOUT', () => {
    expect(
      c5Schema.safeParse({ satisfaction: 'SATISFAIT', source_questionnaire: 'A' }).success,
    ).toBe(true);
  });

  it('rejette PAS_DU_TOUT sans raison', () => {
    const r = c5Schema.safeParse({
      satisfaction: 'PAS_DU_TOUT',
      source_questionnaire: 'A',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path.join('.')).toBe('raison_insatisfaction');
    }
  });
});

describe('b2Schema (survie)', () => {
  it('accepte « pas d’activité » sans champs additionnels', () => {
    expect(b2Schema.safeParse({ a_activite_economique: false }).success).toBe(true);
  });

  it('rejette activité=true sans année/oif/active', () => {
    const r = b2Schema.safeParse({ a_activite_economique: true });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('annee_creation_activite');
      expect(paths).toContain('oif_a_permis');
      expect(paths).toContain('toujours_active');
    }
  });

  it('rejette année arrêt < année création', () => {
    const r = b2Schema.safeParse({
      a_activite_economique: true,
      annee_creation_activite: 2024,
      oif_a_permis: true,
      toujours_active: false,
      annee_arret: 2020,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'annee_arret')).toBe(true);
    }
  });
});

describe('b3Schema (emplois)', () => {
  it('accepte des chiffres cohérents', () => {
    expect(
      b3Schema.safeParse({
        remuneres_avant: 5,
        maintenus_apres: 5,
        nouveaux_apres: 3,
        type_emploi: 'EMPLOI_DURABLE',
        jeunes_remuneres: 4,
        femmes_remunerees: 3,
      }).success,
    ).toBe(true);
  });

  it('rejette jeunes > total rémunérés (maintenus + nouveaux)', () => {
    const r = b3Schema.safeParse({
      maintenus_apres: 2,
      nouveaux_apres: 1,
      jeunes_remuneres: 10, // > 3
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'jeunes_remuneres')).toBe(true);
    }
  });
});

describe('b4Schema (indirects)', () => {
  it('accepte « pas généré » sans nombre', () => {
    expect(b4Schema.safeParse({ a_genere_indirects: false }).success).toBe(true);
  });

  it('rejette généré=true sans nombre', () => {
    const r = b4Schema.safeParse({ a_genere_indirects: true });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path.join('.')).toBe('nombre_indirects');
    }
  });
});

describe('Soumission Questionnaire A', () => {
  it('accepte une soumission complète et valide', () => {
    expect(soumissionQuestionnaireASchema.safeParse(baseSoumissionA).success).toBe(true);
  });

  it('rejette consentement = false', () => {
    const r = soumissionQuestionnaireASchema.safeParse({
      ...baseSoumissionA,
      consentement_repondant: false,
    });
    expect(r.success).toBe(false);
  });

  it('rejette cible_id non UUID', () => {
    expect(
      soumissionQuestionnaireASchema.safeParse({ ...baseSoumissionA, cible_id: 'pas-un-uuid' })
        .success,
    ).toBe(false);
  });

  it('défaut canal_collecte = formulaire_web', () => {
    const r = soumissionQuestionnaireASchema.parse(baseSoumissionA);
    expect(r.canal_collecte).toBe('formulaire_web');
  });

  it('défaut vague_enquete = ponctuelle', () => {
    const r = soumissionQuestionnaireASchema.parse(baseSoumissionA);
    expect(r.vague_enquete).toBe('ponctuelle');
  });

  it('a3, f1 et c5 obligatoires', () => {
    const sansC5 = { ...baseSoumissionA, c5: undefined };
    expect(soumissionQuestionnaireASchema.safeParse(sansC5).success).toBe(false);
  });
});

describe('Soumission Questionnaire B', () => {
  it('accepte une soumission complète et valide', () => {
    expect(soumissionQuestionnaireBSchema.safeParse(baseSoumissionB).success).toBe(true);
  });

  it('rejette si C5 source = A (incohérence)', () => {
    expect(
      soumissionQuestionnaireBSchema.safeParse({
        ...baseSoumissionB,
        c5: { satisfaction: 'SATISFAIT', source_questionnaire: 'C' },
      }).success,
    ).toBe(false);
  });
});

describe('enqueteFiltersSchema', () => {
  it('accepte un filtre vide (page = 1 par défaut)', () => {
    const r = enqueteFiltersSchema.parse({});
    expect(r.page).toBe(1);
  });

  it('coerce questionnaire="tous" en undefined', () => {
    const r = enqueteFiltersSchema.parse({ questionnaire: 'tous' });
    expect(r.questionnaire).toBeUndefined();
  });

  it('valide questionnaire = A ou B', () => {
    expect(enqueteFiltersSchema.safeParse({ questionnaire: 'A' }).success).toBe(true);
    expect(enqueteFiltersSchema.safeParse({ questionnaire: 'B' }).success).toBe(true);
    expect(enqueteFiltersSchema.safeParse({ questionnaire: 'X' }).success).toBe(false);
  });

  it('valide projet_code', () => {
    expect(enqueteFiltersSchema.safeParse({ projet_code: 'PROJ_A14' }).success).toBe(true);
    expect(enqueteFiltersSchema.safeParse({ projet_code: 'INVALID' }).success).toBe(false);
  });

  it('valide cible_id UUID', () => {
    expect(
      enqueteFiltersSchema.safeParse({
        cible_id: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
    expect(enqueteFiltersSchema.safeParse({ cible_id: 'pas-uuid' }).success).toBe(false);
  });
});

describe('Schémas indicateurs simples', () => {
  it('a3 accepte true et false', () => {
    expect(a3Schema.safeParse({ certifie: true }).success).toBe(true);
    expect(a3Schema.safeParse({ certifie: false }).success).toBe(true);
  });

  it('f1 accepte true et false', () => {
    expect(f1Schema.safeParse({ francais_facilite_emploi: true }).success).toBe(true);
    expect(f1Schema.safeParse({ francais_facilite_emploi: false }).success).toBe(true);
  });
});
