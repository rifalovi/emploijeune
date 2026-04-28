/**
 * Types des blocs de correction IA — V2.2.1.
 *
 * Vit hors de `'use server'` pour être consommé à la fois par les Server
 * Actions et les Client Components (Pattern hotfix 6.5h-quater).
 */

import { z } from 'zod';

/**
 * Une correction unitaire proposée pour une entité (bénéficiaire ou structure).
 * `valeur_actuelle` est facultative : pour les NULL, on indique le contexte
 * du cas dans `contexte` à la place.
 */
export const correctionSchema = z.object({
  entite_id: z.string().uuid(),
  entite_nom: z.string(),
  champ: z.enum(['date_naissance', 'consentement_date', 'date_fin_formation', 'montant_appui']),
  valeur_actuelle: z.string().nullable(),
  nouvelle_valeur: z.string(),
  contexte: z.string().optional(),
});
export type Correction = z.infer<typeof correctionSchema>;

/**
 * Un bloc regroupe N corrections partageant la même logique (même méthode
 * d'extrapolation, même niveau de confiance).
 */
export const blocCorrectionSchema = z.object({
  id: z.string(),
  titre: z.string(),
  description: z.string(),
  logique: z.string(),
  confiance: z.number().min(0).max(100),
  cas_concernes: z.number().int().nonnegative(),
  echantillon: z.array(correctionSchema).max(10),
  /** Toutes les corrections du bloc (max 5000 cf. limite v2.2.1). */
  corrections: z.array(correctionSchema).max(5000),
});
export type BlocCorrection = z.infer<typeof blocCorrectionSchema>;

/** Réponse complète d'une analyse IA structurée par blocs. */
export const analyseParBlocsSchema = z.object({
  blocs: z.array(blocCorrectionSchema).max(10),
  /** Bloc résiduel : cas non corrigeables automatiquement. */
  cas_residuels: z.number().int().nonnegative(),
  recommandation_residus: z.string().optional(),
});
export type AnalyseParBlocs = z.infer<typeof analyseParBlocsSchema>;

/**
 * Mapping type d'alerte → champ à corriger. Sert à la fois au prompt IA
 * (contraindre la sortie) et à la validation côté Server Action d'application.
 */
export const TYPE_ALERTE_VERS_CHAMP = {
  date_naissance_manquante: { champ: 'date_naissance', table: 'beneficiaires' },
  consentement_sans_date: { champ: 'consentement_date', table: 'beneficiaires' },
  statut_acheve_sans_date_fin: { champ: 'date_fin_formation', table: 'beneficiaires' },
  subvention_sans_montant: { champ: 'montant_appui', table: 'structures' },
} as const;

export type TypeAlerteCorrigeable = keyof typeof TYPE_ALERTE_VERS_CHAMP;
