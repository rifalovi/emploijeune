import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Cache côté serveur des libellés de nomenclatures pour l'affichage.
 *
 * Les codes (PROJ_A14, NUM_INFO, etc.) sont stables et validés par Zod.
 * Les libellés (« D-CLIC : Formez-vous au numérique », « Numérique et
 * informatique ») servent à l'affichage UI. On les charge en une seule
 * fois par rendu serveur via `React.cache` (dédoublonne les appels dans
 * un même cycle de rendu).
 */

import { cache } from 'react';

export type Nomenclatures = {
  projets: Map<string, { libelle: string; programme_strategique: string | null }>;
  pays: Map<string, string>;
  domaines: Map<string, string>;
  statuts: Map<string, string>;
  modalites: Map<string, string>;
};

export const getNomenclatures = cache(async (): Promise<Nomenclatures> => {
  const supabase = await createSupabaseServerClient();

  const [projets, pays, domaines, statuts, modalites] = await Promise.all([
    supabase.from('projets').select('code, libelle, programme_strategique').is('actif', true),
    supabase.from('pays').select('code_iso, libelle_fr').is('actif', true),
    supabase.from('domaines_formation').select('code, libelle').is('actif', true),
    supabase.from('statuts_beneficiaire').select('code, libelle').is('actif', true),
    supabase.from('modalites_formation').select('code, libelle').is('actif', true),
  ]);

  return {
    projets: new Map(
      (projets.data ?? []).map((p) => [
        p.code,
        { libelle: p.libelle, programme_strategique: p.programme_strategique },
      ]),
    ),
    pays: new Map((pays.data ?? []).map((p) => [p.code_iso, p.libelle_fr])),
    domaines: new Map((domaines.data ?? []).map((d) => [d.code, d.libelle])),
    statuts: new Map((statuts.data ?? []).map((s) => [s.code, s.libelle])),
    modalites: new Map((modalites.data ?? []).map((m) => [m.code, m.libelle])),
  };
});
