'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';

/**
 * Toggle l'activation de la visualisation graphique pour un indicateur donné.
 * Réservé super_admin (vérifié par la RPC `toggle_indicateur_visu` côté BDD
 * + par cette Server Action en double garde).
 */

const togglePayloadSchema = z.object({
  code: z.string().min(1).max(4),
  visu_forcee: z.boolean(),
  valeur: z.boolean(),
});

export type ToggleVisuResult =
  | { status: 'succes'; code: string; visu_activee: boolean }
  | { status: 'erreur'; message: string };

export async function toggleIndicateurVisu(
  payload: z.infer<typeof togglePayloadSchema>,
): Promise<ToggleVisuResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    return { status: 'erreur', message: 'Réservé au super_admin.' };
  }

  const parsed = togglePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', message: 'Payload invalide.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('toggle_indicateur_visu', {
    p_code: parsed.data.code,
    p_visu_forcee: parsed.data.visu_forcee,
    p_valeur: parsed.data.valeur,
  });

  if (error) return { status: 'erreur', message: error.message };
  const result = data as { erreur?: string; succes?: boolean; visu_activee?: boolean };
  if (result?.erreur) return { status: 'erreur', message: result.erreur };

  revalidatePath('/indicateurs');
  revalidatePath(`/indicateurs/${parsed.data.code.toLowerCase()}`);

  return {
    status: 'succes',
    code: parsed.data.code,
    visu_activee: result.visu_activee ?? parsed.data.valeur,
  };
}
