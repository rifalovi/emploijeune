'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';

/**
 * Server Actions pour la base de connaissance super_admin — V2.2.0.
 *
 * Toutes les actions exigent strictement le rôle super_admin (cf. RLS sur la
 * table base_connaissance qui ne permet l'écriture que via is_super_admin()).
 */

type Resultat<T = void> = T extends void
  ? { status: 'succes' } | { status: 'erreur'; message: string }
  : { status: 'succes'; data: T } | { status: 'erreur'; message: string };

type GardeSA =
  | { utilisateur: NonNullable<Awaited<ReturnType<typeof getCurrentUtilisateur>>> }
  | { erreur: string };

async function exigerSuperAdmin(): Promise<GardeSA> {
  try {
    const u = await getCurrentUtilisateur();
    if (!u) return { erreur: 'non_authentifie' };
    if (u.role !== 'super_admin') return { erreur: 'reserve_super_admin' };
    return { utilisateur: u };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : 'erreur_auth' };
  }
}

const ajouterSchema = z.object({
  titre: z.string().trim().min(3).max(200),
  type: z.enum(['note_analyse', 'document_pdf', 'document_word', 'image', 'texte_libre']),
  contenu_text: z.string().max(50000).optional(),
  fichier_url: z.string().url().optional(),
  fichier_extracted_text: z.string().max(200000).optional(),
  source_conversation_id: z.string().uuid().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});

export async function ajouterNoteConnaissance(
  payload: z.infer<typeof ajouterSchema>,
): Promise<Resultat<{ id: string }>> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = ajouterSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('base_connaissance')
    .insert({
      titre: parsed.data.titre,
      type: parsed.data.type,
      contenu_text: parsed.data.contenu_text ?? null,
      fichier_url: parsed.data.fichier_url ?? null,
      fichier_extracted_text: parsed.data.fichier_extracted_text ?? null,
      source_conversation_id: parsed.data.source_conversation_id ?? null,
      ajoute_par: garde.utilisateur.user_id,
      tags: parsed.data.tags,
    })
    .select('id')
    .single();

  if (error || !data) return { status: 'erreur', message: error?.message ?? 'insertion_echouee' };

  revalidatePath('/super-admin/base-connaissance');
  return { status: 'succes', data: { id: data.id } };
}

export async function archiverNoteConnaissance(id: string): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('base_connaissance').update({ archive: true }).eq('id', id);

  if (error) return { status: 'erreur', message: error.message };
  revalidatePath('/super-admin/base-connaissance');
  return { status: 'succes' };
}

export async function desarchiverNoteConnaissance(id: string): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('base_connaissance')
    .update({ archive: false })
    .eq('id', id);

  if (error) return { status: 'erreur', message: error.message };
  revalidatePath('/super-admin/base-connaissance');
  return { status: 'succes' };
}

export async function supprimerNoteConnaissance(id: string): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('base_connaissance').delete().eq('id', id);
  if (error) return { status: 'erreur', message: error.message };
  revalidatePath('/super-admin/base-connaissance');
  return { status: 'succes' };
}
