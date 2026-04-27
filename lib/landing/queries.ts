import 'server-only';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Lecture publique des KPI agrégés pour la vitrine `/`.
 * Aucune donnée nominative — strictement des compteurs.
 *
 * La fonction PostgreSQL `get_kpis_publics_v1()` est en SECURITY DEFINER
 * et exposée au rôle `anon` (cf. migration 024).
 */

export const kpisPublicsSchema = z.object({
  beneficiaires_total: z.number(),
  beneficiaires_femmes: z.number(),
  beneficiaires_hommes: z.number(),
  beneficiaires_femmes_pct: z.number(),
  structures_total: z.number(),
  pays_total: z.number(),
  projets_actifs: z.number(),
  annee_couverture_min: z.number().nullable(),
  annee_couverture_max: z.number().nullable(),
  top_pays: z.array(
    z.object({
      code: z.string(),
      libelle: z.string().nullable(),
      beneficiaires: z.number(),
    }),
  ),
});

export type KpisPublics = z.infer<typeof kpisPublicsSchema>;

export async function getKpisPublics(): Promise<KpisPublics | null> {
  // Utilise le client serveur standard (anon key) — la fonction RPC est
  // exposée au rôle `anon` via GRANT EXECUTE (migration 024).
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('get_kpis_publics_v1');
  const parse = kpisPublicsSchema.safeParse(data);
  return parse.success ? parse.data : null;
}
