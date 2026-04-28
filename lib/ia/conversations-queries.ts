import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ConversationListItem = {
  id: string;
  titre: string | null;
  updated_at: string;
};

export type MessageItem = {
  id: string;
  role: 'user' | 'assistant';
  contenu: string;
  created_at: string;
};

export async function listerConversationsRecentes(limite = 50): Promise<ConversationListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversations_ia')
    .select('id, titre, updated_at')
    .eq('archive', false)
    .order('updated_at', { ascending: false })
    .limit(limite);

  if (error || !data) return [];
  return data;
}

export async function chargerConversation(
  id: string,
): Promise<{ titre: string | null; messages: MessageItem[] } | null> {
  const supabase = await createSupabaseServerClient();
  const [convRes, msgRes] = await Promise.all([
    supabase.from('conversations_ia').select('titre').eq('id', id).maybeSingle(),
    supabase
      .from('messages_ia')
      .select('id, role, contenu, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (convRes.error || !convRes.data) return null;

  return {
    titre: convRes.data.titre,
    messages: (msgRes.data ?? []).map((m) => ({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      contenu: m.contenu,
      created_at: m.created_at,
    })),
  };
}
