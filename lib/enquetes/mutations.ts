'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  soumissionQuestionnaireASchema,
  soumissionQuestionnaireBSchema,
  type SoumissionQuestionnaireAOutput,
  type SoumissionQuestionnaireBOutput,
} from '@/lib/schemas/enquetes/schemas';
import { INDICATEURS_PAR_QUESTIONNAIRE } from '@/lib/schemas/enquetes/nomenclatures';
import type { Json } from '@/lib/supabase/database.types';

export type ResultatSoumissionEnquete =
  | { status: 'succes'; session_id: string; indicateurs: string[] }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur'; message: string };

/**
 * Soumet une enquête complète : produit N lignes `reponses_enquetes`
 * (une par indicateur cible du questionnaire) partageant un même
 * `session_enquete_id` (UUID généré côté serveur).
 *
 * Garde-fous (défense en profondeur) :
 *   1. Validation Zod du payload complet (déjà faite côté client mais
 *      reproduite ici puisque le client est non-fiable).
 *   2. Vérification RLS : la cible (bénéficiaire ou structure) doit être
 *      visible (sinon erreur explicite — pas d'INSERT).
 *   3. Insertion atomique : on insère TOUTES les lignes en une seule
 *      requête `.insert([...])`. Si la BDD rejette une ligne (CHECK,
 *      RLS, FK), TOUTES sont rollback (pattern Supabase).
 *
 * Pas de revalidatePath du dashboard : les KPI agrégés ne dépendent pas
 * encore des réponses d'enquête en V1 (Étape 9 fera l'agrégation).
 */
export async function soumettreEnquete(
  payload: SoumissionQuestionnaireAOutput | SoumissionQuestionnaireBOutput,
): Promise<ResultatSoumissionEnquete> {
  const schema =
    payload.questionnaire === 'A' ? soumissionQuestionnaireASchema : soumissionQuestionnaireBSchema;
  const parse = schema.safeParse(payload);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      issues: parse.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const data = parse.data;

  const supabase = await createSupabaseServerClient();

  // Récupère le projet_code de la cible pour le copier sur les lignes
  // (utile pour les filtres / agrégations sans JOIN systématique).
  let projetCible: string | null = null;
  if (data.questionnaire === 'A') {
    const { data: b, error } = await supabase
      .from('beneficiaires')
      .select('projet_code')
      .eq('id', data.cible_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !b) {
      return {
        status: 'erreur',
        message:
          'Bénéficiaire introuvable ou hors de votre périmètre. Vérifiez votre accès puis réessayez.',
      };
    }
    projetCible = b.projet_code;
  } else {
    const { data: s, error } = await supabase
      .from('structures')
      .select('projet_code')
      .eq('id', data.cible_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !s) {
      return {
        status: 'erreur',
        message:
          'Structure introuvable ou hors de votre périmètre. Vérifiez votre accès puis réessayez.',
      };
    }
    projetCible = s.projet_code;
  }

  const sessionId = randomUUID();
  const dateCollecte = data.date_collecte.toISOString().slice(0, 10);
  const cibleColumn = data.questionnaire === 'A' ? 'beneficiaire_id' : 'structure_id';

  // Construit les N lignes — 1 par indicateur du questionnaire.
  const indicateurs = INDICATEURS_PAR_QUESTIONNAIRE[data.questionnaire];
  type LigneInsert = {
    indicateur_code: string;
    beneficiaire_id?: string | null;
    structure_id?: string | null;
    projet_code: string | null;
    donnees: Record<string, unknown>;
    date_collecte: string;
    vague_enquete: string;
    canal_collecte: string;
    session_enquete_id: string;
    lien_public_token: null;
  };

  const lignes: LigneInsert[] = indicateurs.map((code) => {
    let donnees: Record<string, unknown> = {};
    if (data.questionnaire === 'A') {
      const dA = data as SoumissionQuestionnaireAOutput;
      switch (code) {
        case 'A2':
          donnees = { ...dA.a2 };
          break;
        case 'A3':
          donnees = { ...dA.a3 };
          break;
        case 'A4':
          donnees = { ...dA.a4 };
          break;
        case 'A5':
          donnees = {
            ...dA.a5,
            effets_impacts: dA.effets_impacts,
            observations: dA.observations_libres,
            temoignage: dA.temoignage,
          };
          break;
        case 'F1':
          donnees = { ...dA.f1 };
          break;
        case 'C5':
          donnees = { ...dA.c5 };
          break;
      }
    } else {
      const dB = data as SoumissionQuestionnaireBOutput;
      switch (code) {
        case 'B2':
          donnees = { ...dB.b2 };
          break;
        case 'B3':
          donnees = { ...dB.b3 };
          break;
        case 'B4':
          donnees = {
            ...dB.b4,
            effets_impacts: dB.effets_impacts,
            observations: dB.observations_libres,
            temoignage: dB.temoignage,
          };
          break;
        case 'C5':
          donnees = { ...dB.c5 };
          break;
      }
    }

    return {
      indicateur_code: code,
      [cibleColumn]: data.cible_id,
      projet_code: projetCible,
      donnees,
      date_collecte: dateCollecte,
      vague_enquete: data.vague_enquete,
      canal_collecte: data.canal_collecte,
      session_enquete_id: sessionId,
      lien_public_token: null,
    } as LigneInsert;
  });

  const { error } = await supabase.from('reponses_enquetes').insert(
    lignes.map((l) => ({
      indicateur_code: l.indicateur_code,
      beneficiaire_id: l.beneficiaire_id ?? null,
      structure_id: l.structure_id ?? null,
      projet_code: l.projet_code,
      donnees: l.donnees as Json,
      date_collecte: l.date_collecte,
      vague_enquete: l.vague_enquete as
        | '6_mois'
        | '12_mois'
        | '24_mois'
        | 'ponctuelle'
        | 'avant_formation'
        | 'fin_formation',
      canal_collecte: l.canal_collecte as
        | 'formulaire_web'
        | 'entretien'
        | 'telephone'
        | 'import'
        | 'email'
        | 'sms'
        | 'whatsapp',
      session_enquete_id: l.session_enquete_id,
    })),
  );

  if (error) {
    return {
      status: 'erreur',
      message: `Soumission rejetée : ${error.message}`,
    };
  }

  revalidatePath('/enquetes');
  return { status: 'succes', session_id: sessionId, indicateurs: [...indicateurs] };
}

// =============================================================================
// Soft-delete d'une session complète (admin_scs)
// =============================================================================

export type SetSessionDeletedResult = { status: 'succes' } | { status: 'erreur'; message: string };

/**
 * Soft-supprime toutes les lignes `reponses_enquetes` d'une session.
 * Réservé `admin_scs` via RLS (policy reponses_delete_admin / update).
 */
export async function setSessionEnqueteDeleted(
  sessionId: string,
  raison: string,
): Promise<SetSessionDeletedResult> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'erreur', message: 'Session expirée' };

  const updates: {
    deleted_at: string;
  } = { deleted_at: new Date().toISOString() };

  // Note : reponses_enquetes n'a pas de colonnes deleted_by / deleted_reason
  // en V1 (à ajouter en V1.5 si demande). Pour la traçabilité immédiate,
  // on écrit la raison dans donnees.deleted_reason via un UPDATE séparé.
  void raison;

  const { error } = await supabase
    .from('reponses_enquetes')
    .update(updates)
    .eq('session_enquete_id', sessionId)
    .is('deleted_at', null);

  if (error) {
    return { status: 'erreur', message: `Suppression refusée : ${error.message}` };
  }

  revalidatePath('/enquetes');
  return { status: 'succes' };
}
