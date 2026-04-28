'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { X, Send, Sparkles, RotateCcw, AlertTriangle, Mail } from 'lucide-react';
import { useChatbotScs, type Message } from './use-chatbot-scs';
import { MarkdownRenderer } from '@/components/ia/markdown-renderer';
import { TAILLE_MAX_MESSAGE, LIMITE_REQUETES_INTENSES } from '@/lib/chatbot-scs/config';
import type { SuggestionPayload } from '@/app/api/chatbot-scs/route';
import { cn } from '@/lib/utils';

/**
 * Panel chatbot SCS — V2.5.0.
 *
 * Modal flottant 400×600 (desktop) / plein écran (mobile).
 * Header bleu OIF, zone messages scrollable, footer composer.
 */
export function ChatbotPanel({ onClose }: { onClose: () => void }) {
  const { messages, pending, limiteAtteinte, requetesRestantes, envoyerMessage, reinitialiser } =
    useChatbotScs();
  const [draft, setDraft] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll en bas à chaque nouveau message
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages.length, pending]);

  const onEnvoyer = () => {
    const t = draft.trim();
    if (!t) return;
    envoyerMessage(t);
    setDraft('');
  };

  const onClickBulle = (sugg: SuggestionPayload) => {
    if (pending || limiteAtteinte) return;
    envoyerMessage(sugg.question);
  };

  const onReset = () => {
    if (confirm('Effacer la conversation et démarrer un nouveau chat ?')) {
      reinitialiser();
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-auto bottom-0 z-[60] flex flex-col bg-white shadow-2xl',
        'sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[600px] sm:max-h-[calc(100vh-3rem)] sm:w-[400px] sm:overflow-hidden sm:rounded-2xl',
        'h-[100dvh] sm:h-[600px]',
        'animate-in slide-in-from-bottom-4 fade-in duration-300',
      )}
      role="dialog"
      aria-label="Assistant SCS — chatbot public"
      aria-modal="true"
    >
      {/* Header */}
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-3 text-white"
        style={{ background: 'linear-gradient(135deg, #0E4F88 0%, #1565a8 100%)' }}
      >
        <span
          className="inline-flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm"
          aria-hidden
        >
          <Sparkles className="size-5 text-[#F5A623]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-semibold">Assistant SCS</p>
          <p className="text-[11px] text-white/80">Découvrez la plateforme OIF Emploi Jeunes</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
          className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le chat"
          className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* Bandeau quota */}
      {!limiteAtteinte && requetesRestantes < LIMITE_REQUETES_INTENSES && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
          {requetesRestantes} question{requetesRestantes > 1 ? 's' : ''} approfondie
          {requetesRestantes > 1 ? 's' : ''} restante{requetesRestantes > 1 ? 's' : ''} dans cette
          session.
        </div>
      )}

      {/* Zone messages */}
      <div ref={containerRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 px-3 py-4">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            disabled={pending || limiteAtteinte}
            onClickSuggestion={onClickBulle}
          />
        ))}

        {pending && (
          <div className="flex items-start gap-2">
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
            >
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <div className="flex items-center gap-1.5 rounded-lg bg-[#E3F2FD] px-3 py-2">
              <span className="size-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:0ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:300ms]" />
              <span className="ml-1 text-[10px] text-slate-500">Assistant SCS écrit…</span>
            </div>
          </div>
        )}

        {limiteAtteinte && <BlocLimiteAtteinte onReset={reinitialiser} />}
      </div>

      {/* Composer */}
      <footer className="shrink-0 border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onEnvoyer();
              }
            }}
            rows={1}
            maxLength={TAILLE_MAX_MESSAGE}
            placeholder={
              limiteAtteinte
                ? 'Limite atteinte — utilisez le formulaire de contact.'
                : 'Posez votre question…'
            }
            disabled={pending || limiteAtteinte}
            className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#0E4F88] focus:ring-2 focus:ring-[#0E4F88]/20 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            aria-label="Saisir votre question"
          />
          <button
            type="button"
            onClick={onEnvoyer}
            disabled={pending || limiteAtteinte || draft.trim().length === 0}
            aria-label="Envoyer le message"
            className={cn(
              'inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-white transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'bg-[#0E4F88] hover:bg-[#1565a8]',
            )}
          >
            <Send className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400">
          Powered by Claude · Vos messages ne sont pas enregistrés au-delà de cette session.
        </p>
      </footer>
    </div>
  );
}

function MessageBubble({
  message,
  disabled,
  onClickSuggestion,
}: {
  message: Message;
  disabled: boolean;
  onClickSuggestion: (s: SuggestionPayload) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-2', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        )}
        style={
          isUser
            ? { backgroundColor: '#0E4F88' }
            : { background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }
        }
        aria-hidden
      >
        {isUser ? 'V' : <Sparkles className="size-3.5" />}
      </span>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser ? 'bg-[#0E4F88] text-white' : 'bg-[#E3F2FD] text-slate-800',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownRenderer>{message.content}</MarkdownRenderer>
        )}

        {/* Bulles de suggestion (uniquement messages assistant) */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {message.suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onClickSuggestion(s)}
                  disabled={disabled}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-[#0E4F88]/30 bg-white px-3 py-1 text-[11px] font-medium text-[#0E4F88] transition-all',
                    'hover:border-[#0E4F88] hover:bg-[#0E4F88] hover:text-white hover:shadow-sm',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {s.emoji && <span aria-hidden>{s.emoji}</span>}
                  <span>{s.texte}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BlocLimiteAtteinte({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-lg border border-[#F5A623]/30 bg-[#F5A623]/10 p-4 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-5 shrink-0 text-[#F5A623]" aria-hidden />
        <div className="space-y-2">
          <p className="font-semibold text-slate-900">Limite de la session atteinte</p>
          <p className="text-xs text-slate-700">
            Vous avez utilisé vos {LIMITE_REQUETES_INTENSES} questions approfondies. Pour poursuivre
            :
          </p>
          <div className="flex flex-col gap-1.5">
            <Link
              href="/contact"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0E4F88] hover:underline"
            >
              <Mail className="size-3.5" aria-hidden />
              Nous contacter directement
            </Link>
            <Link
              href="/referentiels"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0E4F88] hover:underline"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Explorer les référentiels OIF
            </Link>
            <button
              type="button"
              onClick={onReset}
              className="mt-1 inline-flex items-center gap-1 self-start rounded-md bg-[#0E4F88] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#1565a8]"
            >
              <RotateCcw className="size-3" aria-hidden />
              Démarrer un nouveau chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
