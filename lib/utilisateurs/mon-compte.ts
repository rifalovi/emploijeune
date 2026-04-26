'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { changerMonMotPasseSchema, type ChangerMonMotPasseInput } from '@/lib/schemas/mon-compte';

/**
 * Server Action pour changer son propre mot de passe (Action 3 — Mon Compte).
 *
 * Sécurité (renforcée par rapport à /motpasse/changer qui ne demande pas
 * l'ancien mdp puisqu'on s'y trouve via lien email signé) :
 *   1. Vérifie l'ancien mot de passe via signInWithPassword (échec → erreur).
 *   2. Si OK → updateUser({ password }) + efface mdp_temporaire metadata.
 *   3. Conserve la session active (l'utilisateur reste connecté).
 *
 * Note hotfix 6.5h-quater : le schéma Zod et son type sont importés depuis
 * `lib/schemas/mon-compte.ts` (fichier sans `'use server'`) pour pouvoir
 * être utilisés à la fois ici (validation serveur) ET côté client par le
 * resolver react-hook-form. Si le schéma vivait dans ce fichier, l'import
 * côté client le transformerait en Server Reference proxy → erreur runtime
 * « Invalid input: not a Zod schema » dans zodResolver.
 */

export type { ChangerMonMotPasseInput };

export type ChangerMonMotPasseResult =
  | { status: 'succes' }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_mdp_actuel'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function changerMonMotPasse(raw: unknown): Promise<ChangerMonMotPasseResult> {
  const parse = changerMonMotPasseSchema.safeParse(raw);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      issues: parse.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const data = parse.data;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) {
    return { status: 'erreur_inconnue', message: 'Session expirée. Reconnectez-vous.' };
  }

  // Étape 1 : vérifier l'ancien mot de passe via signInWithPassword
  // Note : ceci RAFRAÎCHIT la session avec les mêmes tokens — pas de
  // déconnexion observable côté utilisateur.
  const { error: verifError } = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: data.motPasseActuel,
  });
  if (verifError) {
    return {
      status: 'erreur_mdp_actuel',
      message: 'Mot de passe actuel incorrect.',
    };
  }

  // Étape 2 : updateUser avec le nouveau mdp + efface drapeau mdp_temporaire
  const { error: updateError } = await supabase.auth.updateUser({
    password: data.nouveauMotPasse,
    data: { mdp_temporaire: false },
  });
  if (updateError) {
    return {
      status: 'erreur_inconnue',
      message: `Mise à jour échouée : ${updateError.message}`,
    };
  }

  return { status: 'succes' };
}
