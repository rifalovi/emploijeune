'use server';

import { randomUUID } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { peutAccederDataStudio } from '@/lib/super-admin/permissions';
import type { Json } from '@/lib/supabase/database.types';
import {
  chargerDatasetEnquete,
  chargerDatasetMultiProjets,
  chargerDatasetBeneficiaires,
  chargerDatasetStructures,
} from './queries';
import type { DatasetInput } from './types';

/**
 * Résultat des chargeurs de base VOLUMINEUSE (bénéficiaires / structures) :
 * la base est déposée dans Storage sous forme d'enveloppe JSON et référencée par
 * `datasetRef`, au lieu de transiter en ligne à chaque calcul (une base de
 * dizaines de milliers de lignes dépasserait la limite de taille des requêtes).
 */
export type DatasetRefResult = { datasetRef: string; name: string; nRows: number };

/**
 * Dépose un DatasetInput comme enveloppe JSON dans le bucket privé « datastudio »
 * (chemin préfixé par l'identifiant de l'utilisateur, exigé par la RLS et l'API)
 * et renvoie son chemin de stockage (dataset_ref).
 */
async function televerserDatasetRef(
  userId: string,
  dataset: DatasetInput,
  slug: string,
): Promise<DatasetRefResult> {
  const supabase = await createSupabaseServerClient();
  const enveloppe = JSON.stringify({
    rows: dataset.rows,
    columns: dataset.columns ?? null,
    variable_labels: dataset.variable_labels ?? {},
    value_labels: dataset.value_labels ?? {},
    variable_measure: dataset.variable_measure ?? {},
    name: dataset.name ?? slug,
  });
  const path = `${userId}/uploads/${randomUUID()}_${slug}.json`;
  // On force application/octet-stream : la liste MIME du bucket « datastudio »
  // n'autorise pas application/json. Le serveur Python lit le fichier par son
  // EXTENSION (.json → enveloppe DatasetInput), pas par son type MIME.
  const { error } = await supabase.storage
    .from('datastudio')
    .upload(path, Buffer.from(enveloppe, 'utf-8'), {
      upsert: false,
      contentType: 'application/octet-stream',
    });
  if (error) {
    throw new Error(`Préparation de la base échouée : ${error.message}`);
  }
  return { datasetRef: path, name: dataset.name ?? slug, nRows: dataset.rows.length };
}

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

/**
 * Action serveur : charge la base BÉNÉFICIAIRES (indicateur A1) comme jeu de
 * données DataStudio, éventuellement filtrée par projet. Réservée SCS / super_admin.
 */
export async function chargerDatasetBeneficiairesAction(
  projetCode?: string,
): Promise<DatasetRefResult> {
  const utilisateur = await requireUtilisateurValide();
  if (!(await peutAccederDataStudio(utilisateur.id, utilisateur.role))) {
    throw new Error('Accès non autorisé.');
  }
  // Base potentiellement volumineuse (des dizaines de milliers de bénéficiaires) :
  // on la récupère EN ENTIER (pagination) puis on la dépose dans Storage.
  const dataset = await chargerDatasetBeneficiaires(projetCode);
  return televerserDatasetRef(utilisateur.user_id, dataset, 'beneficiaires');
}

/**
 * Action serveur : charge la base STRUCTURES (indicateur B1) comme jeu de
 * données DataStudio, éventuellement filtrée par projet. Réservée SCS / super_admin.
 */
export async function chargerDatasetStructuresAction(
  projetCode?: string,
): Promise<DatasetRefResult> {
  const utilisateur = await requireUtilisateurValide();
  if (!(await peutAccederDataStudio(utilisateur.id, utilisateur.role))) {
    throw new Error('Accès non autorisé.');
  }
  const dataset = await chargerDatasetStructures(projetCode);
  return televerserDatasetRef(utilisateur.user_id, dataset, 'structures');
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

/**
 * Vide l'archive des traitements de l'utilisateur courant (soft-delete).
 * RÉSERVÉ au super_admin (les autres n'ont pas cette action).
 */
export async function viderHistoriqueAction(): Promise<{
  ok: boolean;
  count?: number;
  erreur?: string;
}> {
  const utilisateur = await requireUtilisateurValide();
  if (utilisateur.role !== 'super_admin') {
    return { ok: false, erreur: 'Action réservée au super administrateur.' };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('datastudio_jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', utilisateur.user_id)
    .is('deleted_at', null)
    .select('id');
  if (error) return { ok: false, erreur: error.message };
  return { ok: true, count: data?.length ?? 0 };
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
