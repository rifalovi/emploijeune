'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';

/**
 * Server Actions pour la gestion de l'historique des conversations IA — V2.2.0.
 *
 * Pattern : toutes les actions vérifient l'authentification, puis s'appuient
 * sur les RLS de `conversations_ia` / `messages_ia` (filtre user_id = auth.uid())
 * pour la sécurité défense-en-profondeur.
 */

type ResultatGenerique = { status: 'succes' } | { status: 'erreur'; message: string };

type GardeAuth =
  | { utilisateur: NonNullable<Awaited<ReturnType<typeof getCurrentUtilisateur>>> }
  | { erreur: string };

async function exigerAuth(): Promise<GardeAuth> {
  try {
    const utilisateur = await getCurrentUtilisateur({ allowViewAs: true });
    if (!utilisateur) return { erreur: 'non_authentifie' };
    return { utilisateur };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : 'erreur_auth' };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Création / fetch d'une conversation
// ─────────────────────────────────────────────────────────────────────────

export async function creerConversation(): Promise<
  { status: 'succes'; id: string } | { status: 'erreur'; message: string }
> {
  const garde = await exigerAuth();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversations_ia')
    .insert({ user_id: garde.utilisateur.user_id })
    .select('id')
    .single();

  if (error || !data) {
    return { status: 'erreur', message: error?.message ?? 'creation_echouee' };
  }

  revalidatePath('/assistant-ia');
  return { status: 'succes', id: data.id };
}

// ─────────────────────────────────────────────────────────────────────────
// Persistance d'un échange (user message + assistant response)
// ─────────────────────────────────────────────────────────────────────────

const persisterEchangeSchema = z.object({
  conversation_id: z.string().uuid(),
  user_content: z.string().min(1).max(20000),
  assistant_content: z.string().min(1).max(50000),
  tokens_utilises: z.number().optional(),
});

export async function persisterEchange(
  payload: z.infer<typeof persisterEchangeSchema>,
): Promise<ResultatGenerique> {
  const garde = await exigerAuth();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = persisterEchangeSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('messages_ia').insert([
    {
      conversation_id: parsed.data.conversation_id,
      role: 'user',
      contenu: parsed.data.user_content,
    },
    {
      conversation_id: parsed.data.conversation_id,
      role: 'assistant',
      contenu: parsed.data.assistant_content,
      metadata:
        parsed.data.tokens_utilises !== undefined
          ? { tokens_utilises: parsed.data.tokens_utilises }
          : null,
    },
  ]);

  if (error) return { status: 'erreur', message: error.message };

  // Met à jour updated_at de la conversation pour le tri
  await supabase
    .from('conversations_ia')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', parsed.data.conversation_id);

  return { status: 'succes' };
}

// ─────────────────────────────────────────────────────────────────────────
// Génération de titre (premier message → titre court via Claude)
// ─────────────────────────────────────────────────────────────────────────

export async function genererTitreConversation(
  conversationId: string,
  premierMessage: string,
): Promise<ResultatGenerique> {
  const garde = await exigerAuth();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback : titre tronqué du premier message
    const titre = premierMessage.slice(0, 60).trim() + (premierMessage.length > 60 ? '…' : '');
    const supabase = await createSupabaseServerClient();
    await supabase.from('conversations_ia').update({ titre }).eq('id', conversationId);
    return { status: 'succes' };
  }

  try {
    const client = new Anthropic({ apiKey });
    const reponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 50,
      system:
        "Tu génères un titre TRÈS court (3-7 mots, sans guillemets, sans ponctuation finale) pour une conversation institutionnelle OIF, en français. Réponds UNIQUEMENT par le titre, rien d'autre.",
      messages: [{ role: 'user', content: premierMessage.slice(0, 2000) }],
    });

    const texte = reponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
      .replace(/^["']+|["']+$/g, '')
      .slice(0, 80);

    const titre = texte || premierMessage.slice(0, 60);
    const supabase = await createSupabaseServerClient();
    await supabase.from('conversations_ia').update({ titre }).eq('id', conversationId);
    return { status: 'succes' };
  } catch {
    // Fallback silencieux
    const titre = premierMessage.slice(0, 60).trim() + (premierMessage.length > 60 ? '…' : '');
    const supabase = await createSupabaseServerClient();
    await supabase.from('conversations_ia').update({ titre }).eq('id', conversationId);
    return { status: 'succes' };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Suppression et archivage
// ─────────────────────────────────────────────────────────────────────────

export async function supprimerConversation(id: string): Promise<ResultatGenerique> {
  const garde = await exigerAuth();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('conversations_ia').delete().eq('id', id);

  if (error) return { status: 'erreur', message: error.message };
  revalidatePath('/assistant-ia');
  return { status: 'succes' };
}

export async function archiverConversation(id: string): Promise<ResultatGenerique> {
  const garde = await exigerAuth();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('conversations_ia').update({ archive: true }).eq('id', id);

  if (error) return { status: 'erreur', message: error.message };
  revalidatePath('/assistant-ia');
  return { status: 'succes' };
}
