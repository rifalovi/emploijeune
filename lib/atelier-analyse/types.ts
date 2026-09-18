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
