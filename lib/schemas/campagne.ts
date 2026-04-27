/**
 * Schémas Zod et types pour les campagnes de collecte ciblées (V1.2.5).
 *
 * Vit hors `'use server'` (cf. hotfix 6.5h-quater + hotfix V1.0) — utilisé
 * par les Server Actions ET par les composants client du wizard.
 *
 * Méthodologie OIF : une campagne = collecte ciblée sur une STRATE définie
 * par filtres (ex. « bénéficiaires PROJ_A14 + Mali + 2024 + Formés »). On
 * ne lance jamais une enquête à tous les bénéficiaires d'un projet sans
 * filtre — c'est ce qui distingue une campagne propre d'un envoi en masse.
 */

import { z } from 'zod';
import { PROJETS_CODES, PAYS_CODES, SEXE_VALUES } from '@/lib/schemas/nomenclatures';
import { VAGUES_ENQUETE_VALUES } from '@/lib/schemas/enquetes/nomenclatures';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Filtres strate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtres de strate pour Questionnaire A (bénéficiaires).
 * Tous optionnels — un tableau vide ou absent = aucun filtre sur ce critère.
 */
export const filtresStrateASchema = z.object({
  projets: z.array(z.enum([...PROJETS_CODES] as [string, ...string[]])).optional(),
  pays: z.array(z.enum([...PAYS_CODES] as [string, ...string[]])).optional(),
  annees: z.array(z.number().int().min(2000).max(2100)).optional(),
  sexe: z.enum([...SEXE_VALUES] as [string, ...string[]]).optional(),
  statuts: z.array(z.string()).optional(),
  consentement_acquis_seul: z.boolean().optional().default(true),
});

/**
 * Filtres de strate pour Questionnaire B (structures).
 */
export const filtresStrateBSchema = z.object({
  projets: z.array(z.enum([...PROJETS_CODES] as [string, ...string[]])).optional(),
  pays: z.array(z.enum([...PAYS_CODES] as [string, ...string[]])).optional(),
  annees_appui: z.array(z.number().int().min(2000).max(2100)).optional(),
  types_structure: z.array(z.string()).optional(),
  secteurs: z.array(z.string()).optional(),
  consentement_acquis_seul: z.boolean().optional().default(true),
});

export type FiltresStrateA = z.infer<typeof filtresStrateASchema>;
export type FiltresStrateB = z.infer<typeof filtresStrateBSchema>;
export type FiltresStrate = FiltresStrateA | FiltresStrateB;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Création de campagne (brouillon)
// ─────────────────────────────────────────────────────────────────────────────

export const MODES_SELECTION = ['toutes', 'filtres', 'manuelle'] as const;
export type ModeSelection = (typeof MODES_SELECTION)[number];

export const MODE_SELECTION_LIBELLES: Record<ModeSelection, string> = {
  toutes: 'Toutes les cibles éligibles',
  filtres: 'Sélection par filtres (strate)',
  manuelle: 'Sélection manuelle (cocher les cibles)',
};

export const creerCampagneSchema = z
  .object({
    nom: z
      .string()
      .trim()
      .min(3, 'Le nom doit contenir au moins 3 caractères')
      .max(200, 'Le nom est trop long (max 200 caractères)'),
    description: z
      .string()
      .max(2000, 'La description est trop longue (max 2000 caractères)')
      .optional()
      .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
    questionnaire: z.enum(['A', 'B']),
    type_vague: z.enum([...VAGUES_ENQUETE_VALUES] as [string, ...string[]]).default('ponctuelle'),
    mode_selection: z.enum([...MODES_SELECTION] as [string, ...string[]]),
    filtres: z.record(z.string(), z.unknown()).default({}),
    cibles_manuelles: z.array(z.string().uuid()).optional(),
    plafond: z.number().int().min(1).max(200).default(50),
    email_test_override: z
      .union([z.string().email(), z.literal(''), z.undefined()])
      .transform((v) => (v === '' || v === undefined ? undefined : v))
      .optional(),
    date_envoi_prevue: z
      .union([z.string().datetime(), z.literal(''), z.undefined()])
      .transform((v) => (v === '' || v === undefined ? undefined : v))
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode_selection === 'manuelle') {
      if (!data.cibles_manuelles || data.cibles_manuelles.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['cibles_manuelles'],
          message: 'Sélectionnez au moins une cible en mode manuel.',
        });
      }
    }
  });

export type CreerCampagneInput = z.input<typeof creerCampagneSchema>;
export type CreerCampagneOutput = z.output<typeof creerCampagneSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Résultats Server Actions
// ─────────────────────────────────────────────────────────────────────────────

export type CompterStrateResult =
  | {
      status: 'succes';
      total: number;
      avec_email: number;
      sans_email: number;
      sans_consentement: number;
    }
  | { status: 'erreur'; message: string };

export type CreerCampagneResult =
  | { status: 'succes'; campagneId: string }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_inconnue'; message: string };

export type LancerCampagneResult =
  | {
      status: 'succes';
      total_cibles: number;
      envoyes: number;
      sans_email: Array<{ id: string; libelle: string }>;
      echecs: Array<{ id: string; libelle: string; message: string }>;
    }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_introuvable'; message: string }
  | { status: 'erreur_etat'; message: string }
  | { status: 'plafond_depasse'; message: string; total_cibles: number; plafond: number }
  | { status: 'erreur_inconnue'; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// 4. Helper résumé strate auto-généré (pour affichage)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un libellé descriptif de la strate à partir des filtres.
 * Ex: « Bénéficiaires PROJ_A14 + Mali + 2024 + Formés »
 */
export function resumerStrate(questionnaire: 'A' | 'B', filtres: Record<string, unknown>): string {
  const morceaux: string[] = [];
  morceaux.push(questionnaire === 'A' ? 'Bénéficiaires' : 'Structures');

  const projets = (filtres.projets as string[] | undefined) ?? [];
  if (projets.length > 0) morceaux.push(projets.join(', '));

  const pays = (filtres.pays as string[] | undefined) ?? [];
  if (pays.length > 0) morceaux.push(pays.join(', '));

  const annees =
    (filtres[questionnaire === 'A' ? 'annees' : 'annees_appui'] as number[] | undefined) ?? [];
  if (annees.length > 0) morceaux.push(annees.join(', '));

  if (questionnaire === 'A') {
    const sexe = filtres.sexe as string | undefined;
    if (sexe) morceaux.push(sexe === 'F' ? 'Femmes' : sexe === 'M' ? 'Hommes' : 'Autre');

    const statuts = (filtres.statuts as string[] | undefined) ?? [];
    if (statuts.length > 0) morceaux.push(statuts.join(', '));
  } else {
    const types = (filtres.types_structure as string[] | undefined) ?? [];
    if (types.length > 0) morceaux.push(types.join(', '));

    const secteurs = (filtres.secteurs as string[] | undefined) ?? [];
    if (secteurs.length > 0) morceaux.push(secteurs.join(', '));
  }

  return morceaux.join(' + ');
}
