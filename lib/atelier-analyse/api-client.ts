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

export function analyzeDataset(dataset: DatasetInput): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>('/analyze', { dataset });
}

export function computeFrequency(
  dataset: DatasetInput,
  cols: string[],
  exclure: boolean,
): Promise<FrequencyResponse> {
  return post<FrequencyResponse>('/frequency', { dataset, cols, exclure });
}

export function computeCrosstab(
  dataset: DatasetInput,
  row: string,
  col: string,
  layer: string | null,
  pctMode: 'Ligne' | 'Colonne',
): Promise<CrosstabResponse> {
  return post<CrosstabResponse>('/crosstab', {
    dataset,
    row,
    col,
    layer,
    pct_mode: pctMode,
  });
}
