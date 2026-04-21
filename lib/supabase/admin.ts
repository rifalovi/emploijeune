import { createClient } from '@supabase/supabase-js';
import { readServerEnv } from './env';
import type { Database } from './database.types';

/**
 * Client Supabase administrateur — utilise la clé service_role.
 *
 * ⚠️ À N'UTILISER QUE CÔTÉ SERVEUR (route handlers, server actions, scripts).
 * Ce client CONTOURNE RLS. Ne jamais l'exposer au navigateur.
 *
 * Cas d'usage légitimes :
 *   • Imports Excel massifs (insertion multi-projets en une transaction)
 *   • Seed démo
 *   • Formulaires publics d'enquête (le répondant n'est pas authentifié)
 *   • Tâches planifiées (relances automatiques)
 */
export function createSupabaseAdminClient() {
  const env = readServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
