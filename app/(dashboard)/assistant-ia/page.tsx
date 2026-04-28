import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChatAssistantIaAvecHistorique } from '@/components/ia/chat-assistant-ia-avec-historique';
import { listerConversationsRecentes, chargerConversation } from '@/lib/ia/conversations-queries';

export const metadata: Metadata = {
  title: 'Assistant IA — OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

export default async function AssistantIaPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const sp = await searchParams;
  const conversationsRecentes = await listerConversationsRecentes(50);

  // Si l'utilisateur a sélectionné une conversation existante, on la charge.
  const conversationActive = sp.c ? await chargerConversation(sp.c) : null;
  const messagesInitiaux = conversationActive
    ? conversationActive.messages.map((m) => ({
        role: m.role,
        content: m.contenu,
        horodatage: m.created_at,
      }))
    : [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex size-10 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
          >
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Assistant IA Analytique</h1>
            <p className="text-muted-foreground text-sm">
              Posez vos questions sur les données de la plateforme. Réponses générées par Claude
              (Anthropic), avec anonymisation systématique des invites côté serveur.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-[11px]"
          style={{ borderColor: '#5D007366', color: '#5D0073' }}
        >
          Module enrichi — V2.2.0
        </Badge>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {conversationActive?.titre ?? 'Nouvelle conversation'}
              </CardTitle>
              <CardDescription>
                Données live + base de connaissance institutionnelle injectées dans le contexte.
                Anonymisation côté serveur. Conversations conservées et reprenables.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ChatAssistantIaAvecHistorique
            conversationIdInitial={sp.c ?? null}
            messagesInitiaux={messagesInitiaux}
            conversationsRecentes={conversationsRecentes}
          />
        </CardContent>
      </Card>

      {!conversationActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pistes de questions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
              <li>
                Donne-moi les chiffres exacts des indicateurs OIF (A1, B1) sur le périmètre actuel.
              </li>
              <li>Quel est le top 5 des pays par bénéficiaires et que m'indique-t-il ?</li>
              <li>
                Pourquoi A4 et F1 sont-ils marqués « À venir » et quel questionnaire les alimente ?
              </li>
              <li>
                Rédige une note de synthèse Q1 2026 pour un focus pays Sénégal en 5 paragraphes.
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
