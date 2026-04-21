'use client';

import { createBrowserClient } from '@supabase/ssr';
import { readPublicEnv } from './env';
import type { Database } from './database.types';

/**
 * Client Supabase pour les composants React côté navigateur.
 * Utilise la clé anon publique. Toutes les requêtes passent par RLS.
 */
export function createSupabaseBrowserClient() {
  const env = readPublicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
