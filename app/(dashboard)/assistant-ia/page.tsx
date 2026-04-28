import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChatAssistantIa } from '@/components/ia/chat-assistant-ia';

export const metadata: Metadata = {
  title: 'Assistant IA — OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

export default async function AssistantIaPage() {
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
          Module beta — V2.0.0
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
          <CardDescription>
            Chaque message est anonymisé avant envoi à Claude. Les noms, prénoms, emails et
            téléphones sont automatiquement remplacés par des tokens. Les agrégats (chiffres,
            pourcentages, codes pays / projets) sont préservés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChatAssistantIa />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pistes de questions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
            <li>
              Quelles sont les forces et limites des indicateurs OIF A1, B1, F1 sur le périmètre ?
            </li>
            <li>
              Comment interpréter une cohorte 2025 où 91 % des bénéficiaires sont des femmes ? Quels
              biais de collecte vérifier ?
            </li>
            <li>
              Pourquoi les indicateurs A4 et F1 sont-ils marqués « À venir » et quel questionnaire
              les alimente ?
            </li>
            <li>
              Comment formuler une note de synthèse Q1 2026 pour un focus pays Sénégal en 5
              paragraphes ?
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
