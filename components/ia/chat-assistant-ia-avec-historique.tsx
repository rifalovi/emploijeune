'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Send,
  Sparkles,
  User,
  Trash2,
  Copy,
  Check,
  Plus,
  MessageSquare,
  History,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { analyser } from '@/lib/ia/server-actions';
import {
  creerConversation,
  persisterEchange,
  genererTitreConversation,
  supprimerConversation,
} from '@/lib/ia/conversations-actions';
import type { FichierTraite } from '@/lib/ia/upload-actions';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown-renderer';
import { ZoneUploadFichier } from './zone-upload-fichier';

type Message = { role: 'user' | 'assistant'; content: string; horodatage: string };
type ConversationListItem = { id: string; titre: string | null; updated_at: string };

type Props = {
  conversationIdInitial: string | null;
  messagesInitiaux: Message[];
  conversationsRecentes: ConversationListItem[];
};

export function ChatAssistantIaAvecHistorique({
  conversationIdInitial,
  messagesInitiaux,
  conversationsRecentes,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(conversationIdInitial);
  const [messages, setMessages] = useState<Message[]>(messagesInitiaux);
  const [draft, setDraft] = useState('');
  const [fichiersAttaches, setFichiersAttaches] = useState<FichierTraite[]>([]);
  const [pending, startTransition] = useTransition();
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages, pending]);

  // Si l'utilisateur change de conversation via URL, on synchronise.
  useEffect(() => {
    setConversationId(conversationIdInitial);
    setMessages(messagesInitiaux);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationIdInitial]);

  const onEnvoyer = () => {
    const texte = draft.trim();
    if ((!texte && fichiersAttaches.length === 0) || pending) return;

    // Si seulement des fichiers : on injecte un texte par défaut.
    const contenuFinal = texte || 'Analyse les fichiers joints.';

    const nouveauMessage: Message = {
      role: 'user',
      content: contenuFinal,
      horodatage: new Date().toISOString(),
    };
    // Snapshot des fichiers attachés au moment de l'envoi
    const piecesJointes = fichiersAttaches.map((f) =>
      f.type === 'image'
        ? { type: 'image' as const, nom: f.nom, base64: f.base64, mime: f.mime }
        : { type: 'texte' as const, nom: f.nom, contenu_text: f.contenu_text },
    );
    const next = [...messages, nouveauMessage];
    setMessages(next);
    setDraft('');
    setFichiersAttaches([]);

    startTransition(async () => {
      // 1. Crée la conversation si nécessaire (premier message)
      let convId = conversationId;
      let estPremierMessage = false;
      if (!convId) {
        const creation = await creerConversation();
        if (creation.status === 'erreur') {
          toast.error(`Création conversation : ${creation.message}`);
          setMessages(messages);
          setDraft(texte);
          return;
        }
        convId = creation.id;
        estPremierMessage = true;
        setConversationId(convId);
        // Mise à jour de l'URL (sans rechargement)
        const params = new URLSearchParams(searchParams.toString());
        params.set('c', convId);
        window.history.replaceState(null, '', `?${params.toString()}`);
      }

      // 2. Appel Claude (les pièces jointes ne sont attachées qu'au DERNIER message)
      const messagesPourIa = next.map((m, idx) =>
        idx === next.length - 1
          ? { role: m.role, content: m.content, pieces_jointes: piecesJointes }
          : { role: m.role, content: m.content },
      );
      const res = await analyser({ messages: messagesPourIa });

      if (res.status === 'erreur') {
        toast.error(`Erreur IA : ${res.message}`);
        setMessages(messages);
        setDraft(texte);
        return;
      }

      // 3. Affichage de la réponse
      const reponseMsg: Message = {
        role: 'assistant',
        content: res.reponse,
        horodatage: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, reponseMsg]);

      // 4. Persistance asynchrone (non bloquant)
      void persisterEchange({
        conversation_id: convId,
        user_content: texte,
        assistant_content: res.reponse,
        tokens_utilises: res.tokens_utilises,
      });

      // 5. Génération du titre au premier échange
      if (estPremierMessage) {
        void genererTitreConversation(convId, texte).then(() => {
          // refresh côté serveur pour récupérer le titre auto-généré dans la sidebar
          router.refresh();
        });
      }
    });
  };

  const onNouvelleConversation = () => {
    setConversationId(null);
    setMessages([]);
    setDraft('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('c');
    const url = params.toString() ? `?${params.toString()}` : '';
    router.push(`/assistant-ia${url}`);
  };

  const onSupprimerConversation = async (id: string) => {
    if (!confirm('Supprimer définitivement cette conversation ?')) return;
    const res = await supprimerConversation(id);
    if (res.status === 'erreur') {
      toast.error(res.message);
      return;
    }
    toast.success('Conversation supprimée');
    if (id === conversationId) onNouvelleConversation();
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      {/* SIDEBAR — historique conversations */}
      <aside
        className={cn(
          'border-r border-slate-200 bg-slate-50/60',
          historiqueOuvert ? 'block' : 'hidden lg:block',
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Conversations
          </p>
          <button
            type="button"
            onClick={() => setHistoriqueOuvert(false)}
            className="text-slate-500 hover:text-slate-900 lg:hidden"
            aria-label="Fermer l'historique"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-3 py-2">
          <Button
            type="button"
            onClick={onNouvelleConversation}
            className="w-full justify-start gap-2"
            size="sm"
          >
            <Plus className="size-4" />
            Nouvelle conversation
          </Button>
        </div>
        <ul className="max-h-[calc(60vh-4rem)] overflow-y-auto px-1 py-1">
          {conversationsRecentes.length === 0 ? (
            <li className="text-muted-foreground px-3 py-4 text-center text-xs italic">
              Aucune conversation enregistrée.
            </li>
          ) : (
            conversationsRecentes.map((c) => {
              const isActive = c.id === conversationId;
              return (
                <li key={c.id} className="group relative">
                  <Link
                    href={`/assistant-ia?c=${c.id}`}
                    className={cn(
                      'block truncate rounded-md px-2 py-1.5 pr-8 text-xs transition-colors',
                      isActive ? 'bg-[#0E4F88] text-white' : 'text-slate-700 hover:bg-slate-100',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{c.titre || 'Conversation sans titre'}</span>
                    </div>
                    <span
                      className={cn(
                        'mt-0.5 block text-[10px] tabular-nums',
                        isActive ? 'text-white/70' : 'text-slate-400',
                      )}
                    >
                      {new Date(c.updated_at).toLocaleDateString('fr-FR')}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onSupprimerConversation(c.id);
                    }}
                    aria-label="Supprimer la conversation"
                    className={cn(
                      'absolute top-1.5 right-1 inline-flex size-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100',
                      isActive
                        ? 'text-white hover:bg-white/20'
                        : 'text-slate-400 hover:bg-red-50 hover:text-red-600',
                    )}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {/* CHAT PRINCIPAL */}
      <div className="flex h-[60vh] min-h-[500px] flex-col">
        {/* Bouton mobile pour ouvrir l'historique */}
        <div className="border-b border-slate-200 px-3 py-2 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHistoriqueOuvert(true)}
            className="gap-2"
          >
            <History className="size-4" />
            Historique
          </Button>
        </div>

        {/* Conversation */}
        <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/30 p-4">
          {messages.length === 0 && !pending && (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-center text-sm italic">
                Démarrez la conversation en posant une question ci-dessous.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}

          {pending && (
            <div className="flex items-start gap-3">
              <span
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
              >
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div className="flex items-center gap-1.5">
                <span className="size-2 animate-pulse rounded-full bg-slate-400 [animation-delay:0ms]" />
                <span className="size-2 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="size-2 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                <span className="text-muted-foreground ml-2 text-xs">Claude réfléchit…</span>
              </div>
            </div>
          )}
        </div>

        {/* Composer (sticky en bas) */}
        <div className="sticky bottom-0 space-y-2 border-t border-slate-200 bg-white p-3">
          <ZoneUploadFichier
            fichiersAttaches={fichiersAttaches}
            onFichiersAjoutes={(nouveaux) => setFichiersAttaches((prev) => [...prev, ...nouveaux])}
            onFichierRetire={(idx) =>
              setFichiersAttaches((prev) => prev.filter((_, i) => i !== idx))
            }
            disabled={pending}
          />
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onEnvoyer();
                }
              }}
              rows={2}
              placeholder="Posez votre question… (Cmd/Ctrl + Entrée pour envoyer)"
              disabled={pending}
              className="flex-1 resize-none"
            />
            <Button
              onClick={onEnvoyer}
              disabled={pending || (draft.trim().length === 0 && fichiersAttaches.length === 0)}
              className="gap-1.5"
            >
              <Send className="size-4" aria-hidden />
              Envoyer
            </Button>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Modèle Claude · Données live + base de connaissance dans le contexte · Anonymisation
            côté serveur · Images analysées par Claude Vision.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const onCopier = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('Copié dans le presse-papiers');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier — vérifiez les permissions du navigateur.');
    }
  };

  return (
    <div className={cn('group flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-white"
        style={
          isUser
            ? { backgroundColor: '#0E4F88' }
            : { background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }
        }
      >
        {isUser ? (
          <User className="size-4" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
      </span>
      <div
        className={cn(
          'relative max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed',
          isUser ? 'bg-[#0E4F88] text-white' : 'bg-white ring-1 ring-slate-200',
        )}
      >
        {!isUser && (
          <button
            type="button"
            onClick={onCopier}
            aria-label="Copier la réponse"
            title={copied ? 'Copié !' : 'Copier la réponse (Markdown brut)'}
            className={cn(
              'absolute -top-2 -right-2 inline-flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all',
              'opacity-0 group-hover:opacity-100 focus:opacity-100',
              copied
                ? 'border-emerald-300 text-emerald-600'
                : 'text-slate-500 hover:border-[#0E4F88]/40 hover:text-[#0E4F88]',
            )}
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
          </button>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownRenderer>{message.content}</MarkdownRenderer>
        )}
      </div>
    </div>
  );
}
