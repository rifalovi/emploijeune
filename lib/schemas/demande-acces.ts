/**
 * Schémas Zod pour les demandes d'accès auto-service (V1-Enrichie-A).
 *
 * Important : ce fichier n'est PAS marqué `'use server'` — il est utilisé
 * à la fois par la Server Action publique `creerDemandeAcces` et par
 * le formulaire client (resolver react-hook-form).
 */

import { z } from 'zod';

const nomPrenomRegex = /^[\p{L}\p{M}\s'’\-]+$/u;

export const ROLES_DEMANDABLES = ['editeur_projet', 'contributeur_partenaire'] as const;
export type RoleDemandable = (typeof ROLES_DEMANDABLES)[number];

export const ROLE_DEMANDABLE_LIBELLES: Record<RoleDemandable, string> = {
  editeur_projet: 'Coordonnateur de projet',
  contributeur_partenaire: 'Partenaire / Structure',
};

export const creerDemandeAccesSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse email invalide').max(200),
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
  role_souhaite: z.enum([...ROLES_DEMANDABLES] as [string, ...string[]], {
    message: 'Sélectionnez le rôle souhaité',
  }),
  contexte_souhaite: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
  justification: z
    .string()
    .trim()
    .min(20, 'La justification doit contenir au moins 20 caractères')
    .max(1000, 'La justification ne peut pas dépasser 1000 caractères'),
  consentement_rgpd: z.boolean().refine((v) => v === true, {
    message: 'Le consentement RGPD est obligatoire pour soumettre une demande',
  }),
});

export type CreerDemandeAccesInput = z.input<typeof creerDemandeAccesSchema>;
export type CreerDemandeAccesOutput = z.output<typeof creerDemandeAccesSchema>;

export const rejeterDemandeSchema = z.object({
  demandeId: z.string().uuid(),
  raison: z
    .string()
    .trim()
    .min(10, 'La raison du rejet doit contenir au moins 10 caractères')
    .max(500),
});

export type RejeterDemandeInput = z.input<typeof rejeterDemandeSchema>;
