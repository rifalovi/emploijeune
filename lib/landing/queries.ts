import 'server-only';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { INDICATEURS } from '@/lib/referentiels/indicateurs';

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
    if (age >= 15 && age <= 34) return 'Jeune';
    if (age >= 35) return 'Adulte';
  }
  return null;
}

/**
 * Indicateurs sélectionnés pour la vitrine publique.
 *
 * Brief 1.5 : la liste est gérée dynamiquement par le super_admin via
 * `/super-admin/affichage-public`. La table `config_vitrine_indicateurs` stocke
 * les codes visibles et leur ordre. La RPC `get_indicateurs_vitrine_v1()`
 * (SECURITY DEFINER, exposée à anon) renvoie pour chacun la valeur agrégée à
 * afficher. Les métadonnées d'affichage (intitulé, unité) viennent du
 * référentiel TypeScript hardcodé.
 */
export type IndicateurVitrine = {
  code: string;
  intitule: string;
  labelMetrique: string;
  valeur: number | null;
  unite: string;
  ordre: number;
};

const indicateurVitrineRpcSchema = z.array(
  z.object({
    code: z.string(),
    ordre: z.number(),
    valeur: z.number().nullable(),
  }),
);

export async function getIndicateursVitrine(): Promise<IndicateurVitrine[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_indicateurs_vitrine_v1');
  if (error) return [];

  const parsed = indicateurVitrineRpcSchema.safeParse(data);
  if (!parsed.success) return [];

  return parsed.data.map((row) => {
    const meta = INDICATEURS.find((i) => i.code === row.code);
    return {
      code: row.code,
      intitule: meta?.intitule ?? row.code,
      labelMetrique: meta?.labelMetrique ?? meta?.intitule ?? row.code,
      valeur: row.valeur,
      unite: meta?.unitePrincipale ?? '',
      ordre: row.ordre,
    };
  });
}

export async function getRepartitionTrancheAge(): Promise<RepartitionTrancheAge | null> {
  try {
    const supabase = await createSupabaseServerClient();

    /* Agrégation SQL côté serveur : pas de LIMIT, pas de transfert de
       toutes les lignes. Supabase PostgREST impose un max de 1000 lignes
       par défaut sur les SELECT — ici on utilise un RPC-like approach via
       des comptages HEAD pour éviter ce plafond. */
    const [totalRes, jeunesRes, adultesRes] = await Promise.all([
      supabase
        .from('beneficiaires')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null),
      supabase
        .from('beneficiaires')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('tranche_age_declaree', 'Jeune'),
      supabase
        .from('beneficiaires')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('tranche_age_declaree', 'Adulte'),
    ]);

    const total = totalRes.count ?? 0;
    const jeunes = jeunesRes.count ?? 0;
    const adultes = adultesRes.count ?? 0;
    const non_renseigne = total - jeunes - adultes;

    if (total === 0) return null;

    return {
      jeunes,
      adultes,
      non_renseigne,
      total,
      jeunes_pct: Math.round((jeunes / total) * 100),
      adultes_pct: Math.round((adultes / total) * 100),
    };
  } catch {
    return null;
  }
}
