/**
 * Résolveur dynamique de tranches d'âge — Phase 4 étape 2.
 *
 * Combine le lookup dynamique depuis la table `tranches_age_precises`
 * (cache 5 min) avec le fallback hardcodé de `normaliserTrancheAge`.
 *
 * Ce module accède à la BDD (via Supabase server client) — il n'est
 * PAS pur comme smart-mapper.ts. Les tests doivent mocker le client.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normaliserPourComparaison, normaliserTrancheAge } from './smart-mapper';

// ── Types ────────────────────────────────────────────────────────────────────

export type ResultatTrancheAge = {
  categorie: 'Jeune' | 'Adulte';
  tranche_precise_id: string | null;
};

type TrancheCache = {
  libelle_normalise: string;
  id: string;
  categorie_oif: 'Jeune' | 'Adulte';
};

// ── Cache module-level ───────────────────────────────────────────────────────

let cache: TrancheCache[] | null = null;
let cacheTimestamp = 0;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Charge les tranches actives depuis la BDD avec cache TTL. */
async function chargerTranchesActives(): Promise<TrancheCache[]> {
  if (cache && Date.now() - cacheTimestamp < TTL_MS) {
    return cache;
  }
  try {
    const supabase = await createSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)('get_tranches_age_actives_v1');
    if (!data || !Array.isArray(data)) return cache ?? [];
    cache = (data as { id: string; libelle: string; categorie_oif: 'Jeune' | 'Adulte' }[]).map(
      (t) => ({
        libelle_normalise: normaliserPourComparaison(t.libelle),
        id: t.id,
        categorie_oif: t.categorie_oif,
      }),
    );
    cacheTimestamp = Date.now();
    return cache;
  } catch {
    return cache ?? [];
  }
}

/** Invalide le cache (utile après un CRUD admin sur les tranches). */
export function invaliderCacheTranches(): void {
  cache = null;
  cacheTimestamp = 0;
}

// ── Résolveur principal ──────────────────────────────────────────────────────

/**
 * Résout une valeur brute de tranche d'âge en :
 *   - `categorie` : 'Jeune' ou 'Adulte' (pour tranche_age_declaree)
 *   - `tranche_precise_id` : UUID si match dynamique, null sinon
 *
 * Ordre de résolution :
 *   1. Match exact sur les libellés des tranches actives en BDD
 *   2. Fallback sur les alias hardcodés de normaliserTrancheAge
 */
export async function resoudreTrancheAge(
  v: unknown,
): Promise<ResultatTrancheAge | null> {
  if (v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  if (!s) return null;

  const norme = normaliserPourComparaison(s);

  // 1. Match dynamique sur les tranches actives
  const tranches = await chargerTranchesActives();
  const match = tranches.find((t) => t.libelle_normalise === norme);
  if (match) {
    return { categorie: match.categorie_oif, tranche_precise_id: match.id };
  }

  // 2. Fallback sur les alias hardcodés (aucune tranche_precise_id)
  const alias = normaliserTrancheAge(v);
  if (alias) {
    return { categorie: alias, tranche_precise_id: null };
  }

  return null;
}
