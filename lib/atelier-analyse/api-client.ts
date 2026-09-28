'use client';

/**
 * Client de l'API DataStudio (fonction Python Vercel, même origine).
 * Chaque appel joint le JWT Supabase de l'utilisateur (Authorization: Bearer),
 * vérifié côté service. Aucune donnée n'est stockée ici : calcul à la demande.
 */

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type {
  AnalyzeResponse,
  CleanResponse,
  CrosstabResponse,
  DatasetInput,
  FilterCond,
  FrequencyResponse,
  ModalitiesResponse,
  MultiResponse,
  PreviewResponse,
  QualityResponse,
  StatTestResponse,
  TranslateResponse,
  TranslationFreetextResponse,
  TranslationTermsResponse,
  ConsolidationPlanResponse,
  ConsolidateResponse,
} from './types';

const BASE = '/api/datastudio';

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Session expirée. Reconnectez-vous pour lancer une analyse.');
  }
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Service d'analyse injoignable. Vérifiez que l'API DataStudio est déployée.");
  }
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (j?.detail) {
        detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      }
    } catch {
      /* corps non-JSON : on garde le code HTTP */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/**
 * Source d'un calcul : soit un jeu de données en ligne (`dataset`, cas des
 * enquêtes), soit un fichier déjà déposé dans Storage (`datasetRef`, cas des
 * imports .sav — les données volumineuses ne transitent pas par le client).
 */
export type ComputeSource = ({ dataset: DatasetInput } | { datasetRef: string }) & {
  filters?: FilterCond[];
};

function sourceBody(source: ComputeSource): Record<string, unknown> {
  const base: Record<string, unknown> =
    'datasetRef' in source ? { dataset_ref: source.datasetRef } : { dataset: source.dataset };
  if (source.filters && source.filters.length > 0) base.filters = source.filters;
  return base;
}

export function analyzeDataset(dataset: DatasetInput): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>('/analyze', { dataset });
}

export function computeFrequency(
  source: ComputeSource,
  cols: string[],
  exclure: boolean,
): Promise<FrequencyResponse> {
  return post<FrequencyResponse>('/frequency', { ...sourceBody(source), cols, exclure });
}

export function computeCrosstab(
  source: ComputeSource,
  row: string,
  col: string,
  layer: string | null,
  pctMode: 'Ligne' | 'Colonne',
): Promise<CrosstabResponse> {
  return post<CrosstabResponse>('/crosstab', {
    ...sourceBody(source),
    row,
    col,
    layer,
    pct_mode: pctMode,
  });
}

export function computeStatTest(
  source: ComputeSource,
  row: string,
  col: string,
): Promise<StatTestResponse> {
  return post<StatTestResponse>('/stat-test', { ...sourceBody(source), row, col });
}

/** Batteries multi-réponses : une batterie précise (`group`) ou toutes. */
export function computeMulti(source: ComputeSource, group?: string): Promise<MultiResponse> {
  return post<MultiResponse>('/multi', {
    ...sourceBody(source),
    group: group ?? null,
  });
}

export function computeClean(
  source: ComputeSource,
  opts?: {
    // Corrections (aucun retrait de ligne)
    normaliserManquants?: boolean;
    trimEspaces?: boolean;
    arrondir?: boolean;
    // Épuration (retrait de lignes)
    dropEmpty?: boolean;
    keyColumns?: string[];
    dropDuplicates?: boolean;
    dropMissing?: boolean;
    full?: boolean;
  },
): Promise<CleanResponse> {
  return post<CleanResponse>('/clean', {
    ...sourceBody(source),
    normaliser_manquants: opts?.normaliserManquants ?? true,
    trim_espaces: opts?.trimEspaces ?? true,
    arrondir: opts?.arrondir ?? true,
    drop_empty: opts?.dropEmpty ?? true,
    key_columns: opts?.keyColumns ?? [],
    drop_duplicates: opts?.dropDuplicates ?? true,
    drop_missing: opts?.dropMissing ?? false,
    full: opts?.full ?? false,
  });
}

export function computePreview(source: ComputeSource, limit = 100): Promise<PreviewResponse> {
  return post<PreviewResponse>('/preview', { ...sourceBody(source), limit });
}

export function computeList(
  source: ComputeSource,
  cols: string[],
  limit = 200,
  exclureVides = true,
): Promise<PreviewResponse> {
  return post<PreviewResponse>('/list', {
    ...sourceBody(source),
    cols,
    limit,
    exclure_vides: exclureVides,
  });
}

export function computeQuality(source: ComputeSource): Promise<QualityResponse> {
  return post<QualityResponse>('/quality', sourceBody(source));
}

/**
 * Termes à traduire d'une base importée (en-têtes + modalités catégorielles).
 * Sert d'entrée à la détection de langue et à la traduction IA (côté serveur).
 */
export function computeTranslationTerms(source: ComputeSource): Promise<TranslationTermsResponse> {
  return post<TranslationTermsResponse>('/translation-terms', sourceBody(source));
}

/**
 * Valeurs distinctes des colonnes de réponses ouvertes à traduire par lots
 * (l'IA les traduit ensuite côté serveur, ligne à ligne).
 */
export function computeTranslationFreetext(
  source: ComputeSource,
  cols: string[],
): Promise<TranslationFreetextResponse> {
  return post<TranslationFreetextResponse>('/translation-freetext', {
    ...sourceBody(source),
    cols,
  });
}

/**
 * Applique une table de traduction (renommage d'en-têtes + remplacement de
 * valeurs) et renvoie la base traduite complète (full=true) à adopter comme
 * base de travail. Les valeurs hors table restent inchangées (aucune déformation).
 * `freeTextColumns` : colonnes de réponses ouvertes traduites EN PLACE, dont
 * l'original est conservé dans une colonne compagnon « <col> (VO) ».
 */
export function computeTranslate(
  source: ComputeSource,
  columnMap: Record<string, string>,
  valueMaps: Record<string, Record<string, string>>,
  opts?: {
    full?: boolean;
    name?: string;
    freeTextColumns?: string[];
    /** { colonne -> libellé de variable (question) traduit }. */
    variableLabelMap?: Record<string, string>;
    /** { texte d'étiquette de valeur d'origine -> traduit } (modalités codées). */
    valueLabelTextMap?: Record<string, string>;
  },
): Promise<TranslateResponse> {
  return post<TranslateResponse>('/translate', {
    ...sourceBody(source),
    column_map: columnMap,
    value_maps: valueMaps,
    free_text_columns: opts?.freeTextColumns ?? [],
    variable_label_map: opts?.variableLabelMap ?? {},
    value_label_text_map: opts?.valueLabelTextMap ?? {},
    full: opts?.full ?? true,
    name: opts?.name ?? null,
  });
}

/**
 * Détecte les groupes de colonnes-variantes de langue à fusionner (`x_kh`,
 * `x_viet`…). Renvoie un plan à VALIDER (groupes + orphelins) avant application.
 */
export function computeConsolidationPlan(
  source: ComputeSource,
): Promise<ConsolidationPlanResponse> {
  return post<ConsolidationPlanResponse>('/consolidation-plan', sourceBody(source));
}

/**
 * Applique la consolidation multilingue : fusionne chaque groupe (1re valeur non
 * vide) en une seule variable et renvoie la base consolidée complète (full=true),
 * adoptable comme base de travail. `groups` = plan validé par l'utilisateur.
 */
export function computeConsolidate(
  source: ComputeSource,
  groups: { canonical: string; members: string[] }[],
  opts?: { full?: boolean; name?: string },
): Promise<ConsolidateResponse> {
  return post<ConsolidateResponse>('/consolidate', {
    ...sourceBody(source),
    groups,
    full: opts?.full ?? true,
    name: opts?.name ?? null,
  });
}

/** Modalités d'une variable (en libellés), pour alimenter un champ de filtre. */
export function computeModalities(
  source: ComputeSource,
  col: string,
  limit = 500,
): Promise<ModalitiesResponse> {
  return post<ModalitiesResponse>('/modalities', { ...sourceBody(source), col, limit });
}

/**
 * Réponse d'ingestion d'un fichier : métadonnées + référence Storage.
 * `sheets` liste les feuilles d'un classeur multi-feuilles (vide sinon) ; `name`,
 * `sheet` et `header_row` décrivent la feuille et la ligne d'en-tête retenues.
 */
export type IngestFileResponse = AnalyzeResponse & {
  dataset_ref: string;
  name: string;
  sheets: string[];
  sheet: string | null;
  header_row: number | null;
};

/**
 * Ingère un fichier déposé dans Storage. `sheet` (feuille d'un classeur) et
 * `headerRow` (ligne d'en-tête 0-indexée ; auto-détectée si absente) permettent
 * de re-lire la BONNE feuille ; ils voyagent ensuite avec le `dataset_ref`.
 */
export function ingestFile(
  path: string,
  opts?: { sheet?: string | null; headerRow?: number | null },
): Promise<IngestFileResponse> {
  const body: Record<string, unknown> = { path };
  if (opts?.sheet) body.sheet = opts.sheet;
  if (opts?.headerRow !== undefined && opts?.headerRow !== null) {
    body.header_row = opts.headerRow;
  }
  return post<IngestFileResponse>('/ingest-file', body);
}

/**
 * Envoie un fichier (.sav, Kobo/CSPro .xlsx, .csv) dans le bucket privé
 * « datastudio » puis renvoie son chemin. Le chemin est préfixé par
 * l'identifiant de l'utilisateur (exigé par la RLS et par l'API).
 */
export async function uploadSpssFile(file: File): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) {
    throw new Error('Session expirée. Reconnectez-vous pour importer un fichier.');
  }
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const path = `${userId}/uploads/${crypto.randomUUID()}_${safe}`;
  // On force application/octet-stream : la liste MIME du bucket l'autorise pour
  // tous les formats, et le serveur lit le fichier par son extension (le chemin
  // la conserve), pas par son type MIME.
  const { error } = await supabase.storage
    .from('datastudio')
    .upload(path, file, { upsert: false, contentType: 'application/octet-stream' });
  if (error) {
    throw new Error(`Envoi du fichier échoué : ${error.message}`);
  }
  return path;
}
