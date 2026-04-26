/**
 * Schémas Zod pour la page Mon Compte.
 *
 * Important : ce fichier ne doit PAS être marqué `'use server'` — il est
 * importé côté client (ChangerMdpForm) pour le resolver react-hook-form.
 *
 * Si on l'avait laissé dans `lib/utilisateurs/mon-compte.ts` (qui contient
 * la Server Action `'use server'`), Next.js aurait transformé l'export en
 * Server Reference proxy à la frontière client → `zodResolver()` aurait
 * planté avec « Invalid input: not a Zod schema » (cf. hotfix 6.5h-quater).
 */

import { z } from 'zod';
import { motDePasseSchema } from './auth';

export const changerMonMotPasseSchema = z
  .object({
    motPasseActuel: z.string().min(1, 'Le mot de passe actuel est obligatoire'),
    nouveauMotPasse: motDePasseSchema,
    confirmation: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.nouveauMotPasse !== data.confirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmation'],
        message: 'La confirmation ne correspond pas au nouveau mot de passe',
      });
    }
    if (data.motPasseActuel === data.nouveauMotPasse) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nouveauMotPasse'],
        message: 'Le nouveau mot de passe doit être différent de l’actuel',
      });
    }
  });

export type ChangerMonMotPasseInput = z.input<typeof changerMonMotPasseSchema>;
