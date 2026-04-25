import { describe, it, expect } from 'vitest';
import {
  Q_A203_TYPE_FORMATION_VALUES,
  Q_A203_TYPE_FORMATION_LIBELLES,
  Q_A205_DUREE_FORMATION_VALUES,
  Q_A206_ACHEVEMENT_VALUES,
  ECHELLE_SATISFACTION_VALUES,
  ECHELLE_SATISFACTION_LIBELLES,
  ECHELLE_COMPETENCE_VALUES,
  Q_A401_SITUATION_AVANT_VALUES,
  Q_A405_NATURE_ACTIVITE_VALUES,
  Q_A406_DUREE_ACTIVITE_VALUES,
  Q_A408_EVOLUTION_REVENU_VALUES,
  Q_A409_PROPORTION_AUGMENTATION_VALUES,
  Q_B211_TYPE_EMPLOI_VALUES,
  INDICATEURS_PAR_QUESTIONNAIRE,
  VAGUES_ENQUETE_VALUES,
  CANAUX_COLLECTE_VALUES,
  QUESTIONNAIRE_LIBELLES,
} from '@/lib/schemas/enquetes/nomenclatures';

/**
 * Tests d'invariants sur les nomenclatures questionnaires (6a).
 *
 * Garde-fous :
 *   - Cardinalités exactes pour chaque énumération (verrouille la spec
 *     contre des ajouts/retraits silencieux)
 *   - Libellés non vides
 *   - Cohérence Record ↔ tuple : tous les codes du tuple ont un libellé
 *   - Indicateurs cibles couvrent les 7 indicateurs « réels » V1
 */

describe('Nomenclatures Questionnaire A', () => {
  it('Q A203 (type formation) — 6 valeurs (5 codes source + correctif doublon code 4)', () => {
    expect(Q_A203_TYPE_FORMATION_VALUES).toHaveLength(6);
    expect(new Set(Q_A203_TYPE_FORMATION_VALUES).size).toBe(6); // toutes uniques
  });

  it('Q A205 (durée formation) — 4 paliers', () => {
    expect(Q_A205_DUREE_FORMATION_VALUES).toEqual([
      'MOINS_1_MOIS',
      'DE_1_A_3_MOIS',
      'DE_3_A_6_MOIS',
      'PLUS_6_MOIS',
    ]);
  });

  it('Q A206 (achèvement A2) — 3 valeurs (100/70/<70)', () => {
    expect(Q_A206_ACHEVEMENT_VALUES).toHaveLength(3);
  });

  it('Q A401 (situation avant) — 6 valeurs', () => {
    expect(Q_A401_SITUATION_AVANT_VALUES).toHaveLength(6);
  });

  it('Q A405 (nature activité) — 6 valeurs', () => {
    expect(Q_A405_NATURE_ACTIVITE_VALUES).toHaveLength(6);
  });

  it('Q A406 (durée activité) — 3 paliers', () => {
    expect(Q_A406_DUREE_ACTIVITE_VALUES).toHaveLength(3);
  });

  it('Q A408 (évolution revenu) — 3 valeurs (codes source 1/3/4 normalisés)', () => {
    expect(Q_A408_EVOLUTION_REVENU_VALUES).toEqual(['AUGMENTE', 'STABLE', 'DIMINUE']);
  });

  it('Q A409 (proportion augmentation) — 3 valeurs', () => {
    expect(Q_A409_PROPORTION_AUGMENTATION_VALUES).toHaveLength(3);
  });
});

describe('Nomenclatures Questionnaire B', () => {
  it('Q B211 (type emploi) — 4 valeurs', () => {
    expect(Q_B211_TYPE_EMPLOI_VALUES).toHaveLength(4);
  });
});

describe('Échelles partagées', () => {
  it('Échelle satisfaction — 4 paliers (Q A209 / Q B304 → C5)', () => {
    expect(ECHELLE_SATISFACTION_VALUES).toEqual([
      'PAS_DU_TOUT',
      'MOYENNEMENT',
      'SATISFAIT',
      'TRES_SATISFAIT',
    ]);
  });

  it('Échelle compétence — 5 paliers (Q A301 / A302 → A4)', () => {
    expect(ECHELLE_COMPETENCE_VALUES).toEqual(['AUCUNE', 'FAIBLE', 'MOYEN', 'BON', 'TRES_BON']);
  });
});

describe('Cohérence libellés ↔ codes', () => {
  it('chaque code Q A203 a un libellé non vide', () => {
    for (const code of Q_A203_TYPE_FORMATION_VALUES) {
      expect(Q_A203_TYPE_FORMATION_LIBELLES[code]).toBeTruthy();
      expect(Q_A203_TYPE_FORMATION_LIBELLES[code].length).toBeGreaterThan(3);
    }
  });

  it('chaque code échelle satisfaction a un libellé', () => {
    for (const code of ECHELLE_SATISFACTION_VALUES) {
      expect(ECHELLE_SATISFACTION_LIBELLES[code]).toBeTruthy();
    }
  });
});

describe('Méta-indicateurs', () => {
  it('Questionnaire A couvre 6 indicateurs (A2/A3/A4/A5/F1/C5)', () => {
    expect(INDICATEURS_PAR_QUESTIONNAIRE.A).toEqual(['A2', 'A3', 'A4', 'A5', 'F1', 'C5']);
  });

  it('Questionnaire B couvre 4 indicateurs (B2/B3/B4/C5)', () => {
    expect(INDICATEURS_PAR_QUESTIONNAIRE.B).toEqual(['B2', 'B3', 'B4', 'C5']);
  });

  it('libellés humains présents pour A et B', () => {
    expect(QUESTIONNAIRE_LIBELLES.A).toContain('Bénéficiaires');
    expect(QUESTIONNAIRE_LIBELLES.B).toContain('Structures');
  });
});

describe('Vagues et canaux (alignés sur enums Postgres)', () => {
  it('6 vagues d’enquête (alignées sur public.vague_enquete)', () => {
    expect(VAGUES_ENQUETE_VALUES).toHaveLength(6);
    expect(VAGUES_ENQUETE_VALUES).toContain('6_mois');
    expect(VAGUES_ENQUETE_VALUES).toContain('avant_formation');
  });

  it('7 canaux de collecte (alignés sur public.canal_collecte)', () => {
    expect(CANAUX_COLLECTE_VALUES).toHaveLength(7);
    expect(CANAUX_COLLECTE_VALUES).toContain('formulaire_web');
    expect(CANAUX_COLLECTE_VALUES).toContain('whatsapp');
  });
});
