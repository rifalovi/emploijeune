'use server';

import type {
  SoumissionQuestionnaireAOutput,
  SoumissionQuestionnaireBOutput,
} from '@/lib/schemas/enquetes/schemas';

export type ResultatSoumissionEnquete =
  | { status: 'succes'; session_id: string; indicateurs: string[] }
  | { status: 'erreur'; message: string };

/**
 * Soumet une enquête complète (Étape 6e — implémentation à venir).
 *
 * Stub temporaire en 6d : retourne une erreur explicite. La vraie
 * implémentation (multi-INSERT atomique sur reponses_enquetes avec
 * session_enquete_id partagé + revalidation) arrive en 6e.
 */
export async function soumettreEnquete(
  _payload: SoumissionQuestionnaireAOutput | SoumissionQuestionnaireBOutput,
): Promise<ResultatSoumissionEnquete> {
  void _payload;
  return {
    status: 'erreur',
    message:
      'La soumission n’est pas encore implémentée (à venir en sous-étape 6e). Brouillon conservé localement.',
  };
}
