/**
 * Schéma Zod du formulaire de contact public (V1.5.0).
 *
 * Vit hors `'use server'` (cf. hotfix 6.5h-quater) : utilisé par la Server
 * Action `envoyerMessageContact` ET par le formulaire client.
 */

import { z } from 'zod';

export const SUJETS_CONTACT = [
  'question_generale',
  'demande_acces',
  'bug_technique',
  'partenariat',
  'autre',
] as const;
export type SujetContact = (typeof SUJETS_CONTACT)[number];

export const SUJET_CONTACT_LIBELLES: Record<SujetContact, string> = {
  question_generale: 'Question générale',
  demande_acces: "Demande d'accès",
  bug_technique: 'Bug technique',
  partenariat: 'Partenariat',
  autre: 'Autre',
};

export const messageContactSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(120, 'Le nom est trop long (max 120 caractères)'),
  email: z.string().trim().toLowerCase().email('Adresse email invalide'),
  sujet: z.enum([...SUJETS_CONTACT] as [string, ...string[]]),
  message: z
    .string()
    .trim()
    .min(20, 'Le message doit contenir au moins 20 caractères')
    .max(5000, 'Le message est trop long (max 5000 caractères)'),
});

export type MessageContactInput = z.input<typeof messageContactSchema>;

export type EnvoyerMessageContactResult =
  | { status: 'succes' }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_envoi'; message: string };
