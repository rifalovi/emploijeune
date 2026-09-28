'use client';

/**
 * Client de l'analyseur de CMR : envoi du classeur dans Storage puis appel du
 * moteur Python (route `/api/datastudio/cmr/analyze`). Le JWT Supabase de
 * l'utilisateur voyage en en-tête (vérifié côté service). Aucun stockage ici.
 */

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { CMRAnalyseResponse } from './types';

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
 * Envoie un classeur CMR (.xlsx) dans le bucket privé « datastudio » et renvoie
 * son chemin (préfixé par l'identifiant de l'utilisateur, exigé par la RLS).
 */
export async function uploadCmrFile(file: File): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) {
    throw new Error('Session expirée. Reconnectez-vous pour importer un fichier.');
  }
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const path = `${userId}/uploads/${crypto.randomUUID()}_${safe}`;
  const { error } = await supabase.storage
    .from('datastudio')
    .upload(path, file, { upsert: false, contentType: 'application/octet-stream' });
  if (error) {
    throw new Error(`Envoi du fichier échoué : ${error.message}`);
  }
  return path;
}

/** Analyse un classeur CMR déposé dans Storage (audit + révision + global). */
export function analyserCmr(path: string): Promise<CMRAnalyseResponse> {
  return post<CMRAnalyseResponse>('/cmr/analyze', { path });
}
