/**
 * Types de l'analyseur de CMR (Cadre de Mesure du Rendement).
 * Miroir exact de la sortie du moteur Python `engine/cmr.py`.
 */

export type StatutIndicateur = 'Conforme' | 'Corrigé' | 'À vérifier' | 'Critique';
export type SeveriteAnomalie = 'Critique' | 'Élevé' | 'Moyen' | 'Faible';

export interface AnomalieCMR {
  type: string;
  severite: SeveriteAnomalie;
  ref: string;
  message: string;
  risque: string; // « 🔴 Critique » | « 🟡 À surveiller » | « 🟢 Conforme »
}

export interface CorrectionCMR {
  champ: string;
  valeur_originale: string | number;
  valeur_corrigee: string | number;
  type: string;
  justification: string;
  confiance: 'Élevée' | 'Moyenne' | 'Faible';
  applique: boolean;
}

export interface AnneeIndicateur {
  label: string;
  cible: number | null;
  realise: number | null;
  pct: number | null;
  pct_calc: number | null;
}

export interface IndicateurCMR {
  ref: string;
  libelle: string;
  unite: string;
  reference: number | null;
  objectif: string;
  effet: string;
  produit: string;
  annees: AnneeIndicateur[];
  cible_total: number | null;
  total_realise: number | null;
  pct_total: number | null;
  pct_total_calc: number | null;
  anomalies: AnomalieCMR[];
  corrections: CorrectionCMR[];
  statut: StatutIndicateur;
}

export interface ScoresProjet {
  fiabilite: number;
  qualite_donnees: number;
  coherence_arith: number;
  coherence_gar: number;
  realisme_cibles: number;
}

export interface RepartitionStatuts {
  Conforme: number;
  Corrigé: number;
  'À vérifier': number;
  Critique: number;
}

export interface ProjetCMR {
  code: string;
  nom: string;
  sheet: string;
  n_annees: number;
  n_indicateurs: number;
  scores: ScoresProjet;
  mention_qualite: string;
  n_anomalies: number;
  anomalies: AnomalieCMR[];
  statuts: RepartitionStatuts;
  taux_atteinte_moyen: number | null;
  indicateurs: IndicateurCMR[];
}

export interface LigneClassement {
  code: string;
  nom: string;
  fiabilite: number;
  taux_atteinte_moyen: number | null;
  n_anomalies: number;
  n_critiques: number;
  feu: '🔴' | '🟡' | '🟢';
}

export interface MessagesCles {
  forces: string[];
  faiblesses: string[];
  recommandations: string[];
}

export interface GlobalCMR {
  kpi: {
    n_projets: number;
    n_indicateurs: number;
    n_anomalies: number;
    taux_atteinte_global: number | null;
    score_fiabilite: number;
    score_coherence: number;
    score_qualite: number;
  };
  repartition_statuts: RepartitionStatuts;
  repartition_risques: Record<string, number>;
  classement: LigneClassement[];
  messages_cles: MessagesCles;
}

export interface CMRAnalyseResponse {
  n_projets: number;
  n_indicateurs: number;
  n_anomalies: number;
  onglets_ignores: string[];
  projets: ProjetCMR[];
  global: GlobalCMR;
  version: string;
}
