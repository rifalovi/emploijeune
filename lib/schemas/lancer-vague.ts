/**
 * Schéma Zod et types pour le lancement d'une vague d'enquête (Étape 6.5e).
 *
 * Vit hors `'use server'` (cf. hotfix 6.5h-quater + hotfix urgent post-V1.0)
 * pour ne pas violer la contrainte Next 14 :
 *
 *   « A "use server" file can only export async functions »
 *
 * Les Server Actions (`apercuVagueEnquete`, `lancerVagueEnquete`) restent
 * dans `lib/enquetes/lancer-vague.ts` qui ré-importe ce schéma.
 */

import { z } from 'zod';
import { PROJETS_CODES, PAYS_CODES } from '@/lib/schemas/nomenclatures';
import { VAGUES_ENQUETE_VALUES } from '@/lib/schemas/enquetes/nomenclatures';

export const lancerVagueSchema = z.object({
  questionnaire: z.enum(['A', 'B']),
  vague_enquete: z.enum([...VAGUES_ENQUETE_VALUES] as [string, ...string[]]).default('ponctuelle'),
  /** Filtre projet optionnel — si absent, prend toutes les cibles du périmètre. */
  projet_code: z.enum([...PROJETS_CODES] as [string, ...string[]]).optional(),
  /** Filtre pays optionnel. */
  pays_code: z.enum([...PAYS_CODES] as [string, ...string[]]).optional(),
  /**
   * Mode test : envoie tous les emails à `email_test_override` au lieu des
   * vraies adresses. Utile pour la validation avant le grand lancement.
   */
  email_test_override: z
    .union([z.string().email(), z.literal(''), z.undefined()])
    .transform((v) => (v === '' || v === undefined ? undefined : v))
    .optional(),
  /** Plafond de cibles par exécution (sécurité Resend). */
  plafond: z.number().int().min(1).max(200).default(50),
});

export type LancerVagueInput = z.input<typeof lancerVagueSchema>;

export type LancerVagueResult =
  | {
      status: 'succes';
      total_cibles: number;
      envoyes: number;
      sans_email: Array<{ id: string; libelle: string }>;
      echecs: Array<{ id: string; libelle: string; message: string }>;
      tokens_generes: Array<{ id: string; libelle: string; url: string }>;
    }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'plafond_depasse'; message: string; total_cibles: number; plafond: number }
  | { status: 'erreur_inconnue'; message: string };

export type ApercuVagueResult =
  | {
      status: 'succes';
      total_cibles: number;
      avec_email: number;
      sans_email: number;
      consentement_recueilli: number;
    }
  | { status: 'erreur'; message: string };
