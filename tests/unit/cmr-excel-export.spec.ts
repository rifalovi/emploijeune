import { describe, expect, it } from 'vitest';

import { colLetter, commentaireIndicateur, formuleTaux } from '@/lib/analyseur-cmr/excel-export';
import type { IndicateurCMR } from '@/lib/analyseur-cmr/types';

describe('colLetter', () => {
  it('convertit un index 1-basé en lettre(s) de colonne Excel', () => {
    expect(colLetter(1)).toBe('A');
    expect(colLetter(6)).toBe('F');
    expect(colLetter(26)).toBe('Z');
    expect(colLetter(27)).toBe('AA');
    expect(colLetter(28)).toBe('AB');
  });
});

describe('formuleTaux', () => {
  it('produit une formule qui évite la division par zéro / cible vide', () => {
    expect(formuleTaux('G5', 'H5')).toBe('IF(OR(G5="",G5=0),"",H5/G5)');
  });
});

describe('commentaireIndicateur', () => {
  const base: IndicateurCMR = {
    ref: 'I1.1.1',
    libelle: 'Indic',
    unite: 'Nbre',
    reference: 0,
    objectif: '',
    effet: '',
    produit: '',
    annees: [],
    cible_total: 10,
    total_realise: 9,
    pct_total: 90,
    pct_total_calc: 90,
    anomalies: [],
    corrections: [],
    statut: 'Conforme',
  };

  it('mentionne les recalculs et les anomalies principales', () => {
    const ind: IndicateurCMR = {
      ...base,
      statut: 'Critique',
      corrections: [
        {
          champ: 'Total · %',
          valeur_originale: '—',
          valeur_corrigee: 90,
          type: 'Recalcul arithmétique',
          justification: 'x',
          confiance: 'Élevée',
          applique: true,
        },
      ],
      anomalies: [
        {
          type: 'Réalisation impossible',
          severite: 'Critique',
          ref: 'I1.1.1',
          message: 'taux 1585 %',
          risque: '🔴 Critique',
        },
        {
          type: 'Calcul %',
          severite: 'Moyen',
          ref: 'I1.1.1',
          message: '% faux',
          risque: '🟡 À surveiller',
        },
        {
          type: 'Qualité',
          severite: 'Faible',
          ref: 'I1.1.1',
          message: 'baseline',
          risque: '🟢 Conforme',
        },
      ],
    };
    const txt = commentaireIndicateur(ind);
    expect(txt).toContain('1 taux recalculé(s)');
    expect(txt).toContain('taux 1585 %');
    expect(txt).toContain('+1 autre(s)');
  });

  it('reste vide pour un indicateur conforme sans correction', () => {
    expect(commentaireIndicateur(base)).toBe('');
  });
});
