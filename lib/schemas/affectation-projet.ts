/**
 * Schémas Zod pour les actions d'affectation projet ↔ utilisateur
 * (refactor architecture V1, migration 014).
 *
 * Vit hors `'use server'` (cf. hotfix 6.5h-quater) : utilisé par Server
 * Actions ET formulaires client.
 */

import { z } from 'zod';

export const ROLES_DANS_PROJET = ['gestionnaire_principal', 'co_gestionnaire'] as const;
export type RoleDansProjet = (typeof ROLES_DANS_PROJET)[number];

export const ROLE_DANS_PROJET_LIBELLES: Record<RoleDansProjet, string> = {
  gestionnaire_principal: 'Gestionnaire principal',
  co_gestionnaire: 'Co-gestionnaire',
};

const codeProjet = z
  .string()
  .min(3, 'Code projet trop court')
  .max(40, 'Code projet trop long')
  .regex(/^[A-Z0-9_]+$/, 'Code projet invalide');

const raisonText = z
  .string()
  .max(500, 'La raison ne peut pas dépasser 500 caractères')
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

export const ajouterProjetSchema = z.object({
  userId: z.string().uuid(),
  projet_code: codeProjet,
  role_dans_projet: z
    .enum([...ROLES_DANS_PROJET] as [string, ...string[]])
    .default('gestionnaire_principal'),
  raison: raisonText,
});

export const retirerProjetSchema = z.object({
  userId: z.string().uuid(),
  projet_code: codeProjet,
  raison: raisonText,
});

export const transfererProjetSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  projet_code: codeProjet,
  role_dans_projet: z
    .enum([...ROLES_DANS_PROJET] as [string, ...string[]])
    .default('gestionnaire_principal'),
  raison: z
    .string()
    .trim()
    .min(3, 'La raison du transfert est obligatoire')
    .max(500, 'La raison ne peut pas dépasser 500 caractères'),
});

export const changerProjetStructureSchema = z.object({
  structureId: z.string().uuid(),
  nouveauProjetCode: codeProjet,
  motif: z
    .string()
    .trim()
    .min(3, 'Le motif du changement est obligatoire')
    .max(500, 'Le motif ne peut pas dépasser 500 caractères'),
});

export type AjouterProjetInput = z.input<typeof ajouterProjetSchema>;
export type RetirerProjetInput = z.input<typeof retirerProjetSchema>;
export type TransfererProjetInput = z.input<typeof transfererProjetSchema>;
export type ChangerProjetStructureInput = z.input<typeof changerProjetStructureSchema>;
