import { beforeAll, describe, expect, it } from 'vitest';

import { exporterCmrExcel } from '@/lib/analyseur-cmr/excel-export';
import { construireRapportHtml, construireDashboardHtml } from '@/lib/analyseur-cmr/html-export';
import { exporterRapportWord } from '@/lib/analyseur-cmr/word-export';
import type { CMRAnalyseResponse, IndicateurCMR, ProjetCMR } from '@/lib/analyseur-cmr/types';

function indicateur(over: Partial<IndicateurCMR> = {}): IndicateurCMR {
  return {
    ref: 'I1.1.1',
    libelle: 'Nombre de sessions',
    unite: 'Nbre',
    reference: 10,
    objectif: 'OG1: Objectif',
    effet: 'E1.1: Effet',
    produit: 'P1.1.1: Produit',
    annees: [
      { label: 'Année 1', cible: 20, realise: 18, pct: 90, pct_calc: 90 },
      { label: 'Année 2', cible: 25, realise: 3000, pct: null, pct_calc: 12000 },
    ],
    cible_total: 45,
    total_realise: 3018,
    pct_total: null,
    pct_total_calc: 6706.7,
    anomalies: [
      {
        type: 'Réalisation impossible',
        severite: 'Critique',
        ref: 'I1.1.1',
        message: 'Année 2 : taux 12000 %',
        risque: '🔴 Critique',
      },
    ],
    corrections: [
      {
        champ: 'Réalisé',
        valeur_originale: 'voir donnée',
        valeur_corrigee: '— (à valider)',
        type: 'Vérification requise',
        justification: 'Cible sous-estimée ou erreur de saisie.',
        confiance: 'Faible',
        applique: false,
      },
    ],
    statut: 'Critique',
    ...over,
  };
}

function projet(): ProjetCMR {
  return {
    code: 'Pj3',
    nom: 'IFADEM',
    sheet: 'Pj3_IFADEM',
    n_annees: 2,
    n_indicateurs: 1,
    scores: {
      fiabilite: 70,
      qualite_donnees: 80,
      coherence_arith: 60,
      coherence_gar: 90,
      realisme_cibles: 40,
    },
    mention_qualite: 'Bonne avec réserves',
    n_anomalies: 1,
    anomalies: indicateur().anomalies,
    statuts: { Conforme: 0, Corrigé: 0, 'À vérifier': 0, Critique: 1 },
    taux_atteinte_moyen: 126.7,
    indicateurs: [indicateur()],
  };
}

const RES: CMRAnalyseResponse = {
  n_projets: 1,
  n_indicateurs: 1,
  n_anomalies: 1,
  onglets_ignores: [],
  projets: [projet()],
  global: {
    kpi: {
      n_projets: 1,
      n_indicateurs: 1,
      n_anomalies: 1,
      taux_atteinte_global: 126.7,
      score_fiabilite: 70,
      score_coherence: 90,
      score_qualite: 80,
    },
    repartition_statuts: { Conforme: 0, Corrigé: 0, 'À vérifier': 0, Critique: 1 },
    repartition_risques: { '🔴 Critique': 1, '🟡 À surveiller': 0, '🟢 Conforme': 0 },
    classement: [
      {
        code: 'Pj3',
        nom: 'IFADEM',
        fiabilite: 70,
        taux_atteinte_moyen: 126.7,
        n_anomalies: 1,
        n_critiques: 1,
        feu: '🔴',
      },
    ],
    messages_cles: {
      forces: ['Chaîne GAR structurée.'],
      faiblesses: ['1 valeur invraisemblable.'],
      recommandations: ['Vérifier les cibles dépassées.'],
    },
  },
  version: '1.0.0',
};

describe('livrables CMR (ne jettent pas, produisent une sortie non vide)', () => {
  beforeAll(() => {
    // Stubs navigateur absents de jsdom.
    (globalThis as unknown as { URL: typeof URL }).URL.createObjectURL = () => 'blob:x';
    (globalThis as unknown as { URL: typeof URL }).URL.revokeObjectURL = () => undefined;
  });

  it('rapport HTML contient les sections attendues', () => {
    const html = construireRapportHtml(RES);
    expect(html).toContain("Rapport d'audit analytique du CMR");
    expect(html).toContain('Décisions nécessitant une validation humaine');
    expect(html).toContain('Réalisation impossible');
  });

  it('tableau de bord HTML se génère', () => {
    expect(construireDashboardHtml(RES)).toContain('Tableau de bord CMR');
  });

  it('export Excel (formules) se génère sans erreur', async () => {
    await expect(exporterCmrExcel(RES)).resolves.toBeUndefined();
  });

  it('export Word (tables docx) se génère sans erreur', async () => {
    await expect(exporterRapportWord(RES)).resolves.toBeUndefined();
  });
});
