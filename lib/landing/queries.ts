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
 * Répartition Jeune / Adulte.
 *
 * Double source, par ordre de priorité :
 *   1. `tranche_age_declaree` ('Jeune' | 'Adulte') — valeur déclarée à l'import OIF.
 *   2. `date_naissance` — calcul automatique si la tranche n'est pas renseignée :
 *      18-34 ans → Jeune, 35 ans et + → Adulte.
 *
 * Agrégat anonymisé — aucune donnée nominative retournée.
 */
export type RepartitionTrancheAge = {
  jeunes: number;
  adultes: number;
  non_renseigne: number;
  total: number;
  jeunes_pct: number;
  adultes_pct: number;
};

function classifierTrancheAge(
  tranche_age_declaree: string | null | undefined,
  date_naissance: string | null | undefined,
): 'Jeune' | 'Adulte' | null {
  // Priorité 1 : tranche déclarée lors de l'import
  if (tranche_age_declaree === 'Jeune' || tranche_age_declaree === 'Adulte') {
    return tranche_age_declaree;
  }
  // Priorité 2 : calcul depuis la date de naissance
  if (date_naissance) {
    const naissance = new Date(date_naissance);
    if (isNaN(naissance.getTime())) return null;
    const aujourd_hui = new Date();
    const age =
      aujourd_hui.getFullYear() -
      naissance.getFullYear() -
      (aujourd_hui < new Date(aujourd_hui.getFullYear(), naissance.getMonth(), naissance.getDate())
        ? 1
        : 0);
    if (age >= 18 && age <= 34) return 'Jeune';
    if (age >= 35) return 'Adulte';
  }
  return null;
}

export async function getRepartitionTrancheAge(): Promise<RepartitionTrancheAge | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('beneficiaires')
      .select('tranche_age_declaree, date_naissance')
      .is('deleted_at', null);

    if (error || !data) return null;

    let jeunes = 0;
    let adultes = 0;
    let non_renseigne = 0;
    const total = data.length;

    for (const r of data) {
      const tranche = classifierTrancheAge(r.tranche_age_declaree, r.date_naissance);
      if (tranche === 'Jeune') jeunes++;
      else if (tranche === 'Adulte') adultes++;
      else non_renseigne++;
    }

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
