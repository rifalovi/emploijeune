/**
 * Types partagés de l'Atelier d'analyse (module UI de SCS DataStudio).
 * Reflètent le contrat JSON de l'API DataStudio (services/datastudio/api).
 */

export type DatasetInput = {
  rows: Record<string, unknown>[];
  columns?: string[];
  variable_labels?: Record<string, string>;
  value_labels?: Record<string, Record<string, string>>;
  variable_measure?: Record<string, string>;
  name?: string;
};

export type AnalyzeVariable = {
  name: string;
  display: string;
  measure: string;
  cardinality: number;
};

export type AnalyzeResponse = {
  n_rows: number;
  variables: AnalyzeVariable[];
  multi_groups: Record<string, { column: string; option: string }[]>;
};

export type FrequencyRow = {
  Modalité: string;
  Effectif: number;
  '%': number | null;
  '% valide': number | null;
  '% cumulé': number | null;
};

export type FrequencyResponse = {
  tables: Record<string, FrequencyRow[]>;
  summary: Record<string, unknown>[];
};

export type CrossLayer = {
  layer_value: string;
  base: number;
  index: string[];
  columns: string[];
  counts: (number | null)[][];
  pct: (number | null)[][];
};

export type CrosstabResponse = {
  layers: CrossLayer[];
  row: string;
  col: string;
  layer: string | null;
  pct_mode: string;
};

/** Résultat d'un test statistique sur un croisement (Khi² + Welch). */
export type ChiSquareResult =
  | { applicable: false; message: string }
  | {
      applicable: true;
      chi2: number;
      dof: number;
      p: number;
      significatif: boolean;
      message: string;
    };

export type WelchResult =
  | { applicable: false; message: string }
  | {
      applicable: true;
      t: number;
      p: number;
      significatif: boolean;
      variable: string;
      groups: { nom: string; moyenne: number; n: number }[];
      message: string;
    };

export type StatTestResponse = {
  chi_square: ChiSquareResult;
  welch_ttest: WelchResult;
};

/** Tri à plat d'une batterie de questions à réponses multiples. */
export type MultiRow = {
  Option: string;
  Effectif: number;
  'Pourcentage répondants': number;
};

export type MultiResponse = {
  groups: Record<string, { column: string; option: string }[]>;
  tables: Record<string, { base: number; rows: MultiRow[] }>;
};

/** Aperçu de la base épurée (nettoyage). */
export type CleanResponse = {
  n_rows_source: number;
  n_rows_cleaned: number;
  n_removed: number;
  preview: Record<string, unknown>[];
  specs: { name: string; measure: string; decimals: number }[];
};

/** Condition de filtre (sous-population). op ∈ =, ≠, contient, >, ≥, <, ≤. */
export type FilterCond = { col: string; op: string; val: string };

export const OPERATEURS_FILTRE = ['=', '≠', 'contient', '>', '≥', '<', '≤'] as const;

/** Aperçu de base (brute/filtrée) ou liste de variables juxtaposées. */
export type PreviewResponse = {
  n_rows: number;
  columns: string[];
  codes: string[];
  rows: Record<string, unknown>[];
};

/** Diagnostic qualité : complétude par variable, doublons, anomalies. */
export type QualityResponse = {
  n_rows: number;
  n_variables: number;
  n_duplicates: number;
  taux_completude: number;
  taux_unicite: number;
  variables: {
    name: string;
    display: string;
    n_rempli: number;
    n_manquant: number;
    taux_rempli: number;
  }[];
  anomalies: { type: string; cible: string; detail: string; priorite: string }[];
};

/** Entrée de l'historique des traitements (table datastudio_jobs). */
export type HistoriqueJob = {
  id: string;
  type: string;
  titre: string;
  source: string;
  statut: string;
  created_at: string;
};

/** Indicateur proposé comme source de données (enquête). */
export type IndicateurSource = {
  code: string;
  libelle: string;
};

/**
 * Formats de rapport proposés, avec la consigne de rédaction associée.
 * Défini ici (module neutre) pour être importable côté client ET serveur —
 * un module 'use server' ne peut exporter que des fonctions.
 */
export const FORMATS_RAPPORT = {
  synthese: {
    label: 'Synthèse express',
    instruction:
      "Produis une synthèse courte (10-15 lignes) : 3 à 5 constats chiffrés majeurs, puis une phrase de lecture d'ensemble. Va à l'essentiel.",
  },
  note_analyse: {
    label: "Note d'analyse",
    instruction:
      "Produis une note d'analyse structurée : Contexte, Méthode (base et effectifs), Principaux résultats (avec chiffres), Lecture croisée si un croisement est fourni, Limites, Recommandations opérationnelles.",
  },
  restitution: {
    label: 'Restitution S&E',
    instruction:
      "Produis une restitution de suivi-évaluation : rappel de l'indicateur, résultats par modalité, interprétation orientée pilotage de projet, points d'attention et pistes d'action pour l'équipe S&E de l'OIF.",
  },
  note_thematique: {
    label: 'Analyse thématique',
    instruction:
      "Produis une note d'analyse THÉMATIQUE : identifie 2 à 4 thèmes transversaux qui émergent des résultats (ex. accès, satisfaction, sécurisation, équité de genre…). Pour chaque thème : un titre, les constats chiffrés qui le soutiennent, une interprétation nuancée, et son enjeu. Termine par une lecture d'ensemble reliant les thèmes.",
  },
  rapport_projet: {
    label: 'Rapport par projet',
    instruction:
      "Produis un rapport orienté PROJET : rappel de l'objet et de la population, résultats clés par dimension du projet, analyse de la performance au regard des cibles (si connues), facteurs explicatifs, points de vigilance, et recommandations opérationnelles concrètes pour l'équipe projet. Structure claire avec sections.",
  },
  rapport_programme: {
    label: 'Rapport par programme stratégique',
    instruction:
      'Produis une analyse au niveau du PROGRAMME STRATÉGIQUE : mets les résultats en perspective au regard des objectifs programmatiques et des effets attendus, dégage les enseignements transversaux, apprécie la contribution aux résultats de haut niveau, et formule des recommandations de PILOTAGE STRATÉGIQUE. Ton institutionnel et prospectif.',
  },
  rapport_scientifique: {
    label: 'Rapport scientifique complet',
    instruction:
      'Produis un RAPPORT SCIENTIFIQUE complet et rigoureux, avec ces sections : ' +
      '**Résumé exécutif** (5-8 lignes) ; **Contexte et objectifs** ; **Méthodologie** (base de données, effectifs, variables et traitements mobilisés) ; ' +
      '**Résultats** (lecture détaillée des tris à plat, croisements, réponses multiples et tests statistiques fournis, avec les chiffres) ; ' +
      '**Discussion** (interprétation, mise en relation des résultats) ; **Limites méthodologiques** ; **Recommandations** ; **Conclusion**. ' +
      'Ton scientifique, précis et nuancé ; distingue corrélation et causalité ; signale les effectifs faibles.',
  },
} as const;

export type FormatRapport = keyof typeof FORMATS_RAPPORT;
