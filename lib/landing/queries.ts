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
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('get_kpis_publics_v1');
  const parse = kpisPublicsSchema.safeParse(data);
  return parse.success ? parse.data : null;
}

/**
 * Répartition Jeune / Adulte depuis tranche_age_declaree.
 * Agrégat anonymisé — aucune donnée nominative.
 */
export type RepartitionTrancheAge = {
  jeunes: number;
  adultes: number;
  non_renseigne: number;
  total: number;
  jeunes_pct: number;
  adultes_pct: number;
};

export async function getRepartitionTrancheAge(): Promise<RepartitionTrancheAge | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('beneficiaires')
      .select('tranche_age_declaree')
      .is('deleted_at', null);

    if (error || !data) return null;

    const jeunes = data.filter((r) => r.tranche_age_declaree === 'Jeune').length;
    const adultes = data.filter((r) => r.tranche_age_declaree === 'Adulte').length;
    const non_renseigne = data.filter((r) => !r.tranche_age_declaree).length;
    const total = data.length;

    return {
      jeunes,
      adultes,
      non_renseigne,
      total,
      jeunes_pct: total > 0 ? Math.round((jeunes / total) * 100) : 0,
      adultes_pct: total > 0 ? Math.round((adultes / total) * 100) : 0,
    };
  } catch {
    return null;
  }
}
