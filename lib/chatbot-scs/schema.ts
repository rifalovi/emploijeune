/**
 * Schémas Zod du chatbot SCS — extraits de la route API pour être testables.
 *
 * Note importante : la limite `TAILLE_MAX_MESSAGE` (500 chars) s'applique
 * UNIQUEMENT aux messages utilisateur. Les messages assistant sont des
 * réponses Claude qui peuvent dépasser cette taille — leur limite est
 * volontairement haute (`TAILLE_MAX_ASSISTANT`).
 *
 * Avant ce fichier, un schéma unique imposait 500 chars aux deux rôles,
 * ce qui faisait échouer toute requête de suivi dès que Claude renvoyait
 * une réponse longue (la conversation en mémoire incluait alors un
 * message assistant > 500 chars renvoyé au prochain tour → 400 « Format
 * de requête invalide »).
 */

import { z } from 'zod';
import { TAILLE_MAX_MESSAGE } from './config';

/** Limite des messages assistant (réponses Claude historisées). */
export const TAILLE_MAX_ASSISTANT = 8000;

const userMessageSchema = z.object({
  role: z.literal('user'),
  content: z.string().min(1).max(TAILLE_MAX_MESSAGE),
});

const assistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.string().min(1).max(TAILLE_MAX_ASSISTANT),
});

export const messageSchema = z.discriminatedUnion('role', [
  userMessageSchema,
  assistantMessageSchema,
]);

export const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
});

export type ChatbotMessage = z.infer<typeof messageSchema>;
export type ChatbotRequest = z.infer<typeof requestSchema>;
