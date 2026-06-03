'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { hasPermission } from '@/lib/super-admin/permissions';

/**
 * Server actions — Configuration des indicateurs affichés sur la vitrine
 * publique. Réservé super_admin (cohérent avec la RLS de la table
 * `config_vitrine_indicateurs` et avec la restriction récente sur les
 * modifications d'indicateurs — cf. migration 20260520000002).
 */

type Resultat = { status: 'succes' } | { status: 'erreur'; message: string };

const selectionSchema = z.object({
  code: z.string().trim().min(1).max(10),
  visible: z.boolean(),
  ordre: z.number().int().min(0).max(99),
});

const payloadSchema = z.array(selectionSchema).max(50);

export async function saveConfigVitrine(
  selections: Array<{ code: string; visible: boolean; ordre: number }>,
): Promise<Resultat> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur) return { status: 'erreur', message: 'non_authentifie' };
  if (utilisateur.role !== 'super_admin') {
    if (utilisateur.role !== 'admin_scs') return { status: 'erreur', message: 'reserve_super_admin' };
    const ok = await hasPermission(utilisateur.id, 'affichage_public');
    if (!ok) return { status: 'erreur', message: 'reserve_super_admin' };
  }

  const parsed = payloadSchema.safeParse(selections);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  const supabase = await createSupabaseServerClient();
  const horodatage = new Date().toISOString();

  for (const s of parsed.data) {
    const { error } = await supabase
      .from('config_vitrine_indicateurs')
      .update({
        visible: s.visible,
        ordre: s.visible ? s.ordre : 0,
        updated_at: horodatage,
        updated_by: utilisateur.user_id,
      })
      .eq('indicateur_code', s.code);

    if (error) return { status: 'erreur', message: error.message };
  }

  revalidatePath('/');
  revalidatePath('/super-admin/affichage-public');
  return { status: 'succes' };
}
