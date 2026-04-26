/**
 * Schéma Zod pour la modification d'un utilisateur (Étape 8 enrichie).
 *
 * Important : ce fichier n'est PAS marqué `'use server'` (cf. hotfix
 * 6.5h-quater) — il est utilisé à la fois par la Server Action
 * `modifierUtilisateur` et par le formulaire client.
 *
 * Champs modifiables V1 :
 *   - nom_complet (texte)
 *   - role (3 valeurs : admin_scs / editeur_projet / contributeur_partenaire)
 *   - organisation_id (Select)
 *   - actif (toggle + raison optionnelle stockée dans journaux_audit)
 *
 * Hors scope V1 (V1.5) :
 *   - Modification email (lourd : impacte auth.users + cohérence comptes)
 *   - Édition fine des projets gérés par une organisation (page dédiée
 *     `/admin/organisations/[id]` à venir)
 */

import { z } from 'zod';

export const ROLES_MODIFIABLES = [
  'admin_scs',
  'editeur_projet',
  'contributeur_partenaire',
  'lecteur',
] as const;
export type RoleModifiable = (typeof ROLES_MODIFIABLES)[number];

export const ROLE_MODIFIABLE_LIBELLES: Record<RoleModifiable, string> = {
  admin_scs: 'Administrateur SCS',
  editeur_projet: 'Coordonnateur de projet',
  contributeur_partenaire: 'Contributeur / Partenaire',
  lecteur: 'Lecteur (lecture seule)',
};

const nomCompletRegex = /^[\p{L}\p{M}\s'’\-]+$/u;

export const modifierUtilisateurSchema = z.object({
  utilisateurId: z.string().uuid(),
  nom_complet: z
    .string()
    .trim()
    .min(2, 'Le nom complet doit contenir au moins 2 caractères')
    .max(200, 'Le nom complet est trop long')
    .regex(nomCompletRegex, 'Le nom complet contient des caractères non autorisés'),
  role: z.enum([...ROLES_MODIFIABLES] as [string, ...string[]], {
    message: 'Rôle invalide',
  }),
  organisation_id: z
    .union([z.string().uuid(), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null ? undefined : v))
    .optional(),
  actif: z.boolean(),
  raison_changement: z
    .string()
    .max(500, 'La raison ne peut pas dépasser 500 caractères')
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
});

export type ModifierUtilisateurInput = z.input<typeof modifierUtilisateurSchema>;
export type ModifierUtilisateurOutput = z.output<typeof modifierUtilisateurSchema>;
