'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LIMITE_REQUETES_INTENSES,
  TIMEOUT_INACTIVITE_MS,
  SUGGESTIONS_ACCUEIL,
} from '@/lib/chatbot-scs/config';
import type { SuggestionPayload, ChatbotResponse } from '@/app/api/chatbot-scs/route';

/**
 * Hook gestion du chatbot SCS — V2.5.0.
 *
 * État local + persistance localStorage. Aucune écriture BDD (anonymat
 * total des visiteurs, conformité RGPD-friendly).
 *
 * Limite de 5 requêtes "intenses" (= round-trip Claude). Les clics sur
 * bulles de suggestion ne consomment PAS de quota — ils déclenchent une
 * vraie requête mais l'incrémentation ne se fait que si le serveur renvoie
 * `isIntense: true`.
 *
 * Reset automatique après 1 h d'inactivité ou via le bouton « Nouveau chat ».
 */

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  suggestions?: SuggestionPayload[];
  /** Le message d'accueil et les hors-sujet pré-filtrés ne sont pas marqués intenses. */
  isIntense?: boolean;
  horodatage: string;
};

type ChatbotState = {
  messages: Message[];
  intenseCount: number;
  derniereActivite: number;
};

const STORAGE_KEY = 'oif-chatbot-scs-v1';

function lireEtat(): ChatbotState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatbotState;
    // Reset auto si > 1h d'inactivité
    if (Date.now() - parsed.derniereActivite > TIMEOUT_INACTIVITE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persisterEtat(etat: ChatbotState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(etat));
  } catch {
    // localStorage plein ou désactivé : on ignore silencieusement
  }
}

function reinitialiserEtat(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

const MESSAGE_ACCUEIL: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "👋 **Bonjour !** Je suis l'Assistant SCS. Je peux vous aider à explorer la plateforme OIF Emploi Jeunes et comprendre nos indicateurs.\n\nVoici quelques questions pour démarrer, ou posez la vôtre 👇",
  suggestions: SUGGESTIONS_ACCUEIL,
  horodatage: new Date().toISOString(),
};

export function useChatbotScs() {
  const [messages, setMessages] = useState<Message[]>([MESSAGE_ACCUEIL]);
  const [intenseCount, setIntenseCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydratation initiale depuis localStorage
  useEffect(() => {
    const etat = lireEtat();
    if (etat) {
      setMessages(etat.messages.length > 0 ? etat.messages : [MESSAGE_ACCUEIL]);
      setIntenseCount(etat.intenseCount);
    }
    setHydrated(true);
  }, []);

  // Persistance à chaque changement
  useEffect(() => {
    if (!hydrated) return;
    persisterEtat({ messages, intenseCount, derniereActivite: Date.now() });
  }, [messages, intenseCount, hydrated]);

  const limiteAtteinte = intenseCount >= LIMITE_REQUETES_INTENSES;

  const envoyerMessage = useCallback(
    async (texte: string) => {
      if (pending || !texte.trim()) return;
      if (limiteAtteinte) return;

      const messageUtilisateur: Message = {
        id: uid(),
        role: 'user',
        content: texte.trim(),
        horodatage: new Date().toISOString(),
      };
      // Snapshot avant ajout pour l'envoi serveur
      const messagesAEnvoyer = [...messages, messageUtilisateur].filter((m) => m.role !== 'system');
      setMessages((prev) => [...prev, messageUtilisateur]);
      setPending(true);

      try {
        const res = await fetch('/api/chatbot-scs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagesAEnvoyer
              .filter((m) => m.id !== 'welcome')
              .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
          }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { erreur?: string };
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'assistant',
              content:
                err.erreur ?? 'Le service rencontre un incident. Réessayez dans quelques instants.',
              horodatage: new Date().toISOString(),
            },
          ]);
          return;
        }

        const data = (await res.json()) as ChatbotResponse;
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: data.reponse,
            suggestions: data.suggestions,
            isIntense: data.isIntense,
            horodatage: new Date().toISOString(),
          },
        ]);
        if (data.isIntense) {
          setIntenseCount((c) => c + 1);
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content:
              e instanceof Error
                ? `Erreur réseau : ${e.message}`
                : 'Erreur réseau. Réessayez dans quelques instants.',
            horodatage: new Date().toISOString(),
          },
        ]);
      } finally {
        setPending(false);
      }
    },
    [messages, pending, limiteAtteinte],
  );

  const reinitialiser = useCallback(() => {
    reinitialiserEtat();
    setMessages([MESSAGE_ACCUEIL]);
    setIntenseCount(0);
  }, []);

  return {
    messages,
    intenseCount,
    pending,
    limiteAtteinte,
    requetesRestantes: Math.max(0, LIMITE_REQUETES_INTENSES - intenseCount),
    envoyerMessage,
    reinitialiser,
    hydrated,
  };
}
