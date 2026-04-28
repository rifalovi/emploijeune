/**
 * Schémas Zod pour la gestion des utilisateurs (Étape 6.5b).
 *
 * Création de comptes EXCLUSIVEMENT par admin_scs (pas
 * d'auto-inscription en V1) — cf. décisions stratégiques V1/V1.5.
 */

import { z } from 'zod';
import { PROJETS_CODES } from './nomenclatures';

/**
 * Rôles métier autorisés à la création — V2.0.1.
 *
 * Le schéma accepte tous les rôles, y compris super_admin et admin_scs.
 * La hiérarchie de qui-peut-créer-quoi est appliquée côté Server Action
 * (`creerCompteUtilisateur`) via la fonction `rolesCreablesPar(roleCreateur)`.
 *
 *   super_admin → peut créer tous les rôles (super_admin, admin_scs,
 *                  editeur_projet, contributeur_partenaire, lecteur)
 *   admin_scs   → peut créer : editeur_projet, contributeur_partenaire,
 *                  lecteur (PAS super_admin, PAS admin_scs)
 *   autres      → ne peuvent rien créer
 */
export const ROLES_CREABLES = [
  'super_admin',
  'admin_scs',
  'editeur_projet',
  'contributeur_partenaire',
  'lecteur',
] as const;
export type RoleCreable = (typeof ROLES_CREABLES)[number];

export const ROLE_CREABLE_LIBELLES: Record<RoleCreable, string> = {
  super_admin: 'Super administrateur',
  admin_scs: 'Administrateur SCS',
  editeur_projet: 'Coordonnateur de projet',
  contributeur_partenaire: 'Contributeur partenaire / Structure',
  lecteur: 'Lecteur (accès lecture seule)',
};

/**
 * Filtre les rôles attribuables selon le rôle du créateur.
 * Principe : un rôle ne peut JAMAIS créer un compte de même niveau ou supérieur.
 */
export function rolesCreablesPar(roleCreateur: string): RoleCreable[] {
  if (roleCreateur === 'super_admin') {
    return [...ROLES_CREABLES];
  }
  if (roleCreateur === 'admin_scs') {
    return ['editeur_projet', 'contributeur_partenaire', 'lecteur'];
  }
  return [];
}

const nomPrenomRegex = /^[\p{L}\p{M}\s'’\-]+$/u;

/**
 * Schéma de création de compte par admin_scs.
 *
 * Règles cross-field :
 *   - editeur_projet → au moins 1 projet géré obligatoire
 *   - contributeur_partenaire → organisation_id obligatoire
 *   - lecteur → ni projet ni organisation requis
 */
export const creerCompteUtilisateurSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Adresse courriel invalide'),
    prenom: z
      .string()
      .trim()
      .min(1, 'Le prénom est obligatoire')
      .max(100)
      .regex(nomPrenomRegex, 'Le prénom contient des caractères non autorisés'),
    nom: z
      .string()
      .trim()
      .min(1, 'Le nom est obligatoire')
      .max(100)
      .regex(nomPrenomRegex, 'Le nom contient des caractères non autorisés')
      .transform((v) => v.toLocaleUpperCase('fr-FR')),
    role: z.enum([...ROLES_CREABLES] as [string, ...string[]], {
      message: 'Rôle invalide',
    }),
    organisation_id: z
      .union([z.string().uuid(), z.literal(''), z.null(), z.undefined()])
      .transform((v) => (v === '' || v === null ? undefined : v))
      .optional(),
    projets_geres: z
      .union([
        z.array(z.enum([...PROJETS_CODES] as [string, ...string[]])),
        z.null(),
        z.undefined(),
      ])
      .transform((v) => (v === null || v === undefined ? [] : v))
      .pipe(z.array(z.string())),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'editeur_projet') {
      if (!data.projets_geres || data.projets_geres.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['projets_geres'],
          message: 'Sélectionnez au moins un projet pour un coordonnateur de projet',
        });
      }
    }
    if (data.role === 'contributeur_partenaire') {
      if (!data.organisation_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['organisation_id'],
          message: 'L’organisation de rattachement est obligatoire pour un contributeur partenaire',
        });
      }
    }
  });

export type CreerCompteUtilisateurInput = z.input<typeof creerCompteUtilisateurSchema>;
export type CreerCompteUtilisateurOutput = z.output<typeof creerCompteUtilisateurSchema>;
