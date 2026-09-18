'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { chargerDatasetEnquete } from './queries';
import type { DatasetInput } from './types';

const ROLES_AUTORISES = ['super_admin', 'admin_scs'];

/**
 * Action serveur : charge le jeu de données d'un indicateur (réponses
 * d'enquête) pour l'Atelier d'analyse. Réservée SCS / super_admin.
 */
export async function chargerDatasetEnqueteAction(
  indicateurCode: string,
  projetCode?: string,
): Promise<DatasetInput> {
  const utilisateur = await requireUtilisateurValide();
  if (!ROLES_AUTORISES.includes(utilisateur.role)) {
    throw new Error('Accès non autorisé.');
  }
  return chargerDatasetEnquete(indicateurCode, projetCode);
}

export type EnregistrerTraitementInput = {
  type: 'frequency' | 'crosstab' | 'multi' | 'stat_test' | 'cleaning' | 'report' | 'export';
  titre: string;
  source: string;
  source_ref?: string;
  params: Record<string, unknown>;
  payload?: Record<string, unknown>;
  apercu?: string;
};

/**
 * Action serveur : enregistre un traitement dans l'historique (datastudio_jobs
 * + datastudio_results). Best-effort : si la migration n'est pas encore
 * appliquée en base, on renvoie { ok: false } sans casser l'analyse en cours.
 * Le propriétaire est l'utilisateur courant (RLS : user_id = auth.uid()).
 */
export async function enregistrerTraitementAction(
  input: EnregistrerTraitementInput,
): Promise<{ ok: boolean; id?: string; erreur?: string }> {
  const utilisateur = await requireUtilisateurValide();
  if (!ROLES_AUTORISES.includes(utilisateur.role)) {
    return { ok: false, erreur: 'Accès non autorisé.' };
  }
  const supabase = await createSupabaseServerClient();
  // Tables datastudio_* pas encore dans les types générés (migration à
  // appliquer) — cast le temps de régénérer les types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data, error } = await sb
    .from('datastudio_jobs')
    .insert({
      user_id: utilisateur.user_id,
      source: input.source,
      source_ref: input.source_ref ?? null,
      type: input.type,
      titre: input.titre,
      params: input.params,
      statut: 'termine',
    })
    .select('id')
    .single();
  if (error) return { ok: false, erreur: error.message };

  const jobId = (data as { id: string }).id;
  if (input.payload) {
    const { error: errResultat } = await sb
      .from('datastudio_results')
      .insert({ job_id: jobId, payload: input.payload, apercu: input.apercu ?? null });
    if (errResultat) {
      return { ok: true, id: jobId, erreur: `Résultat non enregistré : ${errResultat.message}` };
    }
  }
  return { ok: true, id: jobId };
}
