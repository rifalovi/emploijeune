'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { peutAccederDataStudio } from '@/lib/super-admin/permissions';
import type { Json } from '@/lib/supabase/database.types';
import { chargerDatasetEnquete, chargerDatasetMultiProjets } from './queries';
import type { DatasetInput } from './types';

/**
 * Action serveur : charge le jeu de données d'un indicateur (réponses
 * d'enquête) pour l'Atelier d'analyse. Réservée SCS / super_admin.
 */
export async function chargerDatasetEnqueteAction(
  indicateurCode: string,
  projetCode?: string,
): Promise<DatasetInput> {
  const utilisateur = await requireUtilisateurValide();
  if (!(await peutAccederDataStudio(utilisateur.id, utilisateur.role))) {
    throw new Error('Accès non autorisé.');
  }
  return chargerDatasetEnquete(indicateurCode, projetCode);
}

/**
 * Action serveur : charge une base MULTI-PROJETS (réponses d'un indicateur
 * empilées sur plusieurs projets, avec colonnes Projet / Programme).
 */
export async function chargerDatasetMultiProjetsAction(
  indicateurCode: string,
  projetCodes: string[],
): Promise<DatasetInput> {
  const utilisateur = await requireUtilisateurValide();
  if (!(await peutAccederDataStudio(utilisateur.id, utilisateur.role))) {
    throw new Error('Accès non autorisé.');
  }
  return chargerDatasetMultiProjets(indicateurCode, projetCodes);
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
  if (!(await peutAccederDataStudio(utilisateur.id, utilisateur.role))) {
    return { ok: false, erreur: 'Accès non autorisé.' };
  }
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('datastudio_jobs')
    .insert({
      user_id: utilisateur.user_id,
      source: input.source,
      source_ref: input.source_ref ?? null,
      type: input.type,
      titre: input.titre,
      params: input.params as Json,
      statut: 'termine',
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, erreur: error?.message ?? 'Insertion échouée.' };

  const jobId = data.id;
  if (input.payload) {
    const { error: errResultat } = await supabase
      .from('datastudio_results')
      .insert({ job_id: jobId, payload: input.payload as Json, apercu: input.apercu ?? null });
    if (errResultat) {
      return { ok: true, id: jobId, erreur: `Résultat non enregistré : ${errResultat.message}` };
    }
  }
  return { ok: true, id: jobId };
}

export type TraitementDetail = {
  id: string;
  type: string;
  titre: string;
  source: string;
  source_ref: string | null;
  params: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

/**
 * Recharge un traitement enregistré (métadonnées + résultat stocké) pour le
 * consulter, l'exporter ou l'éditer SANS ré-importer ni relancer l'IA.
 * La RLS garantit que l'utilisateur n'accède qu'à ses propres traitements.
 */
export async function chargerTraitementAction(
  jobId: string,
): Promise<{ ok: true; detail: TraitementDetail } | { ok: false; erreur: string }> {
  const utilisateur = await requireUtilisateurValide();
  if (!(await peutAccederDataStudio(utilisateur.id, utilisateur.role))) {
    return { ok: false, erreur: 'Accès non autorisé.' };
  }
  const supabase = await createSupabaseServerClient();
  const { data: job, error } = await supabase
    .from('datastudio_jobs')
    .select('id, type, titre, source, source_ref, params, created_at')
    .eq('id', jobId)
    .is('deleted_at', null)
    .single();
  if (error || !job) return { ok: false, erreur: error?.message ?? 'Traitement introuvable.' };

  const { data: res } = await supabase
    .from('datastudio_results')
    .select('payload')
    .eq('job_id', jobId)
    .maybeSingle();

  return {
    ok: true,
    detail: {
      id: job.id,
      type: job.type,
      titre: job.titre,
      source: job.source,
      source_ref: job.source_ref,
      params: (job.params ?? null) as Record<string, unknown> | null,
      payload: (res?.payload ?? null) as Record<string, unknown> | null,
      created_at: job.created_at,
    },
  };
}
