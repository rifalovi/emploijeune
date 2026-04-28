'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { Send, Sparkles, User, Trash2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { analyser } from '@/lib/ia/server-actions';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown-renderer';

type Message = { role: 'user' | 'assistant'; content: string; horodatage: string };

export function ChatAssistantIa() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages, pending]);

  const onEnvoyer = () => {
    const texte = draft.trim();
    if (!texte || pending) return;

    const nouveauMessage: Message = {
      role: 'user',
      content: texte,
      horodatage: new Date().toISOString(),
    };
    const next = [...messages, nouveauMessage];
    setMessages(next);
    setDraft('');

    startTransition(async () => {
      const res = await analyser({
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      });

      if (res.status === 'erreur') {
        toast.error(`Erreur IA : ${res.message}`);
        // On retire le dernier message user pour éviter de polluer le contexte
        // si la requête a échoué pour une raison de config / quota.
        setMessages(messages);
        setDraft(texte);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reponse,
          horodatage: new Date().toISOString(),
        },
      ]);
    });
  };

  const onReset = () => {
    if (messages.length === 0) return;
    setMessages([]);
  };

  return (
    <div className="flex h-[60vh] min-h-[400px] flex-col">
      {/* Conversation */}
      <div
        ref={containerRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/50 p-4"
      >
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

      {/* Composer */}
      <div className="mt-3 flex items-end gap-2">
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
        <div className="flex flex-col gap-2">
          <Button
            onClick={onEnvoyer}
            disabled={pending || draft.trim().length === 0}
            className="gap-1.5"
          >
            <Send className="size-4" aria-hidden />
            Envoyer
          </Button>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={pending}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Réinitialiser
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-[11px]">
        Modèle : Claude · Anonymisation côté serveur · Aucune donnée nominative envoyée à l'API. Les
        conversations ne sont pas conservées au-delà de la session.
      </p>
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
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-white',
        )}
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
