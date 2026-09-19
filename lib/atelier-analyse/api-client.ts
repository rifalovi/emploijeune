'use client';

/**
 * Client de l'API DataStudio (fonction Python Vercel, même origine).
 * Chaque appel joint le JWT Supabase de l'utilisateur (Authorization: Bearer),
 * vérifié côté service. Aucune donnée n'est stockée ici : calcul à la demande.
 */

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { AnalyzeResponse, CrosstabResponse, DatasetInput, FrequencyResponse } from './types';

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
export type ComputeSource = { dataset: DatasetInput } | { datasetRef: string };

function sourceBody(source: ComputeSource): Record<string, unknown> {
  return 'datasetRef' in source ? { dataset_ref: source.datasetRef } : { dataset: source.dataset };
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

/** Réponse d'ingestion d'un fichier : métadonnées + référence Storage. */
export type IngestFileResponse = AnalyzeResponse & { dataset_ref: string; name: string };

export function ingestFile(path: string): Promise<IngestFileResponse> {
  return post<IngestFileResponse>('/ingest-file', { path });
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
