/**
 * Moteur de règles déclaratif pour les questionnaires d'enquête (Étape 6b).
 *
 * Évalue les conditions `affiche_si` des questions à partir des valeurs
 * actuelles d'un payload de soumission. Utilisé par le composant de saisie
 * (6d) pour masquer/afficher dynamiquement les questions, et par le composant
 * de fiche détail (6e) pour ne montrer que les champs pertinents.
 *
 * Principe : pas de `if/else` câblé — la logique de saut « ALLER À » du
 * questionnaire papier est traduite en règles déclaratives simples
 * (cf. `Question.affiche_si` dans questionnaires.ts), évaluées ici.
 */

import type { Question } from './questionnaires';

/**
 * Lit une valeur d'un payload imbriqué via un chemin pointé
 * (ex. 'a2.a_participe' → payload.a2.a_participe).
 *
 * Retourne `undefined` si la clé n'existe pas (pas d'erreur — le payload
 * est partiel pendant la saisie).
 */
export function lireChampPayload(payload: unknown, chemin: string): unknown {
  if (payload === null || payload === undefined || typeof payload !== 'object') return undefined;
  const segments = chemin.split('.');
  let cursor: unknown = payload;
  for (const seg of segments) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
}

/**
 * Vérifie si une question doit être affichée selon le payload courant.
 *
 * Règles :
 *   - Pas de condition `affiche_si` → toujours affichée.
 *   - Condition présente → la valeur du champ référencé doit égaler la
 *     valeur cible (comparaison stricte ===).
 */
export function questionEstVisible(question: Question, payload: unknown): boolean {
  if (!question.affiche_si) return true;
  const valeurActuelle = lireChampPayload(payload, question.affiche_si.champ_payload);
  return valeurActuelle === question.affiche_si.valeur_egale;
}

/**
 * Filtre les questions visibles dans une liste, pour rendu UI.
 */
export function questionsVisibles(
  questions: ReadonlyArray<Question>,
  payload: unknown,
): ReadonlyArray<Question> {
  return questions.filter((q) => questionEstVisible(q, payload));
}
