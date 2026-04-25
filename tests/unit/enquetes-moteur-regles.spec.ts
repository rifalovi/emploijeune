import { describe, it, expect } from 'vitest';
import {
  lireChampPayload,
  questionEstVisible,
  questionsVisibles,
} from '@/lib/schemas/enquetes/moteur-regles';
import type { Question } from '@/lib/schemas/enquetes/questionnaires';
import { QUESTIONNAIRE_A, QUESTIONNAIRE_B } from '@/lib/schemas/enquetes/questionnaires';

describe('lireChampPayload', () => {
  it('lit un chemin imbriqué simple', () => {
    expect(lireChampPayload({ a2: { a_participe: true } }, 'a2.a_participe')).toBe(true);
  });

  it('retourne undefined si la clé manque', () => {
    expect(lireChampPayload({}, 'a2.a_participe')).toBeUndefined();
    expect(lireChampPayload({ a2: {} }, 'a2.a_participe')).toBeUndefined();
  });

  it('retourne undefined si le payload est null/undefined', () => {
    expect(lireChampPayload(null, 'a2.a_participe')).toBeUndefined();
    expect(lireChampPayload(undefined, 'a2.a_participe')).toBeUndefined();
  });

  it('retourne undefined si une étape intermédiaire n’est pas un objet', () => {
    expect(lireChampPayload({ a2: 'pas un objet' }, 'a2.a_participe')).toBeUndefined();
  });
});

describe('questionEstVisible', () => {
  const questionSansCondition: Question = {
    id: 'A201',
    type: 'oui_non',
    libelle: 'Test',
    champ_payload: 'a2.a_participe',
  };
  const questionConditionnelle: Question = {
    id: 'A202',
    type: 'nombre_entier',
    libelle: 'Test',
    champ_payload: 'a2.nb_formations',
    affiche_si: { champ_payload: 'a2.a_participe', valeur_egale: true },
  };

  it('toujours visible si pas de condition', () => {
    expect(questionEstVisible(questionSansCondition, {})).toBe(true);
    expect(questionEstVisible(questionSansCondition, undefined)).toBe(true);
  });

  it('masquée si condition non remplie', () => {
    expect(questionEstVisible(questionConditionnelle, {})).toBe(false);
    expect(questionEstVisible(questionConditionnelle, { a2: { a_participe: false } })).toBe(false);
  });

  it('visible si condition remplie', () => {
    expect(questionEstVisible(questionConditionnelle, { a2: { a_participe: true } })).toBe(true);
  });
});

describe('questionsVisibles (logique « ALLER À »)', () => {
  it('Questionnaire A : si non-participation, masque les Q202..A210', () => {
    const sectionParticipation = QUESTIONNAIRE_A.sections[0]!;
    const visibles = questionsVisibles(sectionParticipation.questions, {
      a2: { a_participe: false },
    });
    // Seule Q201 reste visible (les autres ont affiche_si a_participe=true)
    expect(visibles.map((q) => q.id)).toEqual(['A201']);
  });

  it('Questionnaire A : si participation + AUTRE, affiche Q204', () => {
    const sectionParticipation = QUESTIONNAIRE_A.sections[0]!;
    const visibles = questionsVisibles(sectionParticipation.questions, {
      a2: { a_participe: true, type_formation: 'AUTRE' },
    });
    expect(visibles.map((q) => q.id)).toContain('A204');
  });

  it('Questionnaire A : si participation + non-AUTRE, masque Q204', () => {
    const sectionParticipation = QUESTIONNAIRE_A.sections[0]!;
    const visibles = questionsVisibles(sectionParticipation.questions, {
      a2: { a_participe: true, type_formation: 'NUM' },
    });
    expect(visibles.map((q) => q.id)).not.toContain('A204');
  });

  it('Questionnaire A : si achevement = PARTIELLE_70, affiche Q207', () => {
    const sectionParticipation = QUESTIONNAIRE_A.sections[0]!;
    const visibles = questionsVisibles(sectionParticipation.questions, {
      a2: { a_participe: true, achevement: 'PARTIELLE_70' },
    });
    expect(visibles.map((q) => q.id)).toContain('A207');
  });

  it('Questionnaire A : si satisfaction = PAS_DU_TOUT, affiche Q210', () => {
    const sectionParticipation = QUESTIONNAIRE_A.sections[0]!;
    const visibles = questionsVisibles(sectionParticipation.questions, {
      a2: { a_participe: true },
      c5: { satisfaction: 'PAS_DU_TOUT' },
    });
    expect(visibles.map((q) => q.id)).toContain('A210');
  });

  it('Questionnaire A : si pas accédé activité, masque Q404/A405/A406', () => {
    const sectionInsertion = QUESTIONNAIRE_A.sections[2]!;
    const visibles = questionsVisibles(sectionInsertion.questions, {
      a5: { situation_avant: 'EMPLOYE', a_accede: false },
    });
    const ids = visibles.map((q) => q.id);
    expect(ids).not.toContain('A404');
    expect(ids).not.toContain('A405');
    expect(ids).not.toContain('A406');
  });

  it('Questionnaire B : si pas d’activité économique, masque Q202..B213', () => {
    const sectionSurvie = QUESTIONNAIRE_B.sections[0]!;
    const visibles = questionsVisibles(sectionSurvie.questions, {
      b2: { a_activite_economique: false },
    });
    expect(visibles.map((q) => q.id)).toEqual(['B201']);
  });

  it('Questionnaire B : si toujours_active=false, affiche Q206/B207, masque Q205', () => {
    const sectionSurvie = QUESTIONNAIRE_B.sections[0]!;
    const visibles = questionsVisibles(sectionSurvie.questions, {
      b2: { a_activite_economique: true, toujours_active: false },
    });
    const ids = visibles.map((q) => q.id);
    expect(ids).toContain('B206');
    expect(ids).toContain('B207');
    expect(ids).not.toContain('B205');
  });
});

describe('Structure des questionnaires', () => {
  it('Questionnaire A : 4 indicateurs de section + 6 indicateurs cibles', () => {
    expect(QUESTIONNAIRE_A.sections).toHaveLength(3);
    expect(QUESTIONNAIRE_A.indicateurs).toEqual(['A2', 'A3', 'A4', 'A5', 'F1', 'C5']);
  });

  it('Questionnaire B : 2 sections + 4 indicateurs cibles', () => {
    expect(QUESTIONNAIRE_B.sections).toHaveLength(2);
    expect(QUESTIONNAIRE_B.indicateurs).toEqual(['B2', 'B3', 'B4', 'C5']);
  });

  it('chaque question a un id, type, libelle et champ_payload', () => {
    for (const q of [...QUESTIONNAIRE_A.sections, ...QUESTIONNAIRE_B.sections].flatMap(
      (s) => s.questions,
    )) {
      expect(q.id).toMatch(/^[AB][0-9]{3}$/);
      expect(q.libelle.length).toBeGreaterThan(5);
      expect(q.champ_payload).toMatch(/^[a-z][a-z0-9_]+(\.[a-z_]+)?$/);
    }
  });

  it('Questionnaire A : 25 questions actives (sections II-IV ; section I = consentement + identité = couverte par binding A1)', () => {
    const total = QUESTIONNAIRE_A.sections.reduce((acc, s) => acc + s.questions.length, 0);
    expect(total).toBe(25);
  });

  it('Questionnaire B : 19 questions actives (section I déjà couverte par B1)', () => {
    const total = QUESTIONNAIRE_B.sections.reduce((acc, s) => acc + s.questions.length, 0);
    expect(total).toBe(19);
  });
});
