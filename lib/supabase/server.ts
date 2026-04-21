import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readPublicEnv } from './env';
import type { Database } from './database.types';

/**
 * Client Supabase pour les composants serveur et route handlers.
 * Lit le cookie d'authentification fourni par le middleware Next.js.
 * Utilise la clé anon publique ; RLS s'applique avec l'identité de l'utilisateur.
 */
export async function createSupabaseServerClient() {
  const env = readPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // appelé depuis un Server Component — le middleware rafraîchira la session
          }
        },
      },
    },
  );
}
