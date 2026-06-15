import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CubeRow } from './pivot-config';

/**
 * Récupère les cubes d'agrégation A1 (bénéficiaires) et B1 (structures) via les
 * RPC `cube_*_v1` (scopées par rôle côté BDD). Le pivot se fait ensuite côté
 * client à partir de ces lignes pré-agrégées.
 */
export async function getCubesTcd(): Promise<{
  a1: CubeRow[];
  b1: CubeRow[];
  erreur: string | null;
}> {
  const supabase = await createSupabaseServerClient();

  const [a1Resp, b1Resp] = await Promise.all([
    // RPC récentes, absentes des types générés → cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('cube_beneficiaires_v1'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('cube_structures_v1'),
  ]);

  const erreur = a1Resp.error?.message ?? b1Resp.error?.message ?? null;

  return {
    a1: (Array.isArray(a1Resp.data) ? a1Resp.data : []) as CubeRow[],
    b1: (Array.isArray(b1Resp.data) ? b1Resp.data : []) as CubeRow[],
    erreur,
  };
}
