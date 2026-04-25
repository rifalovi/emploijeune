/**
 * Schémas Zod pour l'authentification (Étape 6.5a).
 *
 * Décision V1 (cf. docs/decisions-strategiques/v1-vs-v1-5.md) :
 *   - Login + mot de passe par défaut pour tous les rôles
 *   - Magic link conservé comme alternative (admin_scs principalement)
 *   - Politique mdp basique : 8 char min, 1 majuscule, 1 chiffre
 *   - V1.5 : politique avancée (rotation, complexité, 2FA)
 */

import { z } from 'zod';

/**
 * Politique de mot de passe V1 — partagée entre l'inscription, le reset
 * et le changement obligatoire au premier login.
 *
 * Choix : pas de caractère spécial obligatoire (ergonomie partenaires
 * terrain dont l'expertise IT est variable). À durcir en V1.5 si retour
 * sécurité OIF le justifie.
 */
export const motDePasseSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères') // limite bcrypt
  .refine((v) => /[A-Z]/.test(v), {
    message: 'Le mot de passe doit contenir au moins une majuscule',
  })
  .refine((v) => /[0-9]/.test(v), {
    message: 'Le mot de passe doit contenir au moins un chiffre',
  });

/** Schéma de connexion login + mot de passe. */
export const connexionMotPasseSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse courriel invalide'),
  motDePasse: z.string().min(1, 'Le mot de passe est obligatoire'), // pas de policy ici (mdp existant)
});

/** Schéma de connexion par lien magique (mode SCS / fallback). */
export const connexionMagicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse courriel invalide'),
});

/** Schéma de demande de reset (formulaire « mot de passe oublié »). */
export const demanderResetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse courriel invalide'),
});

/**
 * Schéma de changement de mot de passe (premier login après création
 * de compte par admin_scs OU après clic sur lien de reset).
 */
export const changerMotPasseSchema = z
  .object({
    nouveauMotPasse: motDePasseSchema,
    confirmation: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.nouveauMotPasse !== data.confirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmation'],
        message: 'La confirmation ne correspond pas au mot de passe',
      });
    }
  });

export type ConnexionMotPasseInput = z.input<typeof connexionMotPasseSchema>;
export type ConnexionMagicLinkInput = z.input<typeof connexionMagicLinkSchema>;
export type DemanderResetInput = z.input<typeof demanderResetSchema>;
export type ChangerMotPasseInput = z.input<typeof changerMotPasseSchema>;
