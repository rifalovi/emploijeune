'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { ChatbotPanel } from './chatbot-panel';
import { cn } from '@/lib/utils';

/**
 * Composant racine du chatbot SCS — V2.5.0.
 *
 * Affiche un bouton flottant + un panel modal sur les pages PUBLIQUES
 * uniquement. Filtrage par pathname côté client (pas de duplication
 * de logique côté serveur).
 *
 * Routes EXCLUES (chatbot masqué) :
 *   - /dashboard, /admin/*, /super-admin/*, /assistant-ia
 *   - /beneficiaires, /structures, /enquetes, /imports
 *   - /connexion, /demande-acces, /motpasse-oublie, /motpasse/*
 *   - /en-attente-de-validation
 *   - /mon-compte
 *
 * Routes AUTORISÉES (chatbot visible) : tout le reste, principalement
 * les onglets de la vitrine publique : /, /referentiels/*,
 * /realisations, /contact.
 */

const PATHS_EXCLUS = [
  '/dashboard',
  '/admin',
  '/super-admin',
  '/assistant-ia',
  '/beneficiaires',
  '/structures',
  '/enquetes',
  '/imports',
  '/connexion',
  '/demande-acces',
  '/motpasse-oublie',
  '/motpasse',
  '/en-attente-de-validation',
  '/mon-compte',
] as const;

function estPagePublique(pathname: string): boolean {
  return !PATHS_EXCLUS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function ChatbotScs() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [monte, setMonte] = useState(false);

  // Évite l'hydratation mismatch : on ne rend rien tant que le client
  // n'a pas pris le relais (le pathname côté serveur ne fait pas la
  // même évaluation que côté client dans certains cas avec Suspense).
  useEffect(() => {
    setMonte(true);
  }, []);

  if (!monte) return null;
  if (!estPagePublique(pathname)) return null;

  return (
    <>
      {!open && <ChatbotBubble onClick={() => setOpen(true)} />}
      {open && <ChatbotPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function ChatbotBubble({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ouvrir l'Assistant SCS"
      title="💬 Assistant SCS — Posez vos questions"
      className={cn(
        'fixed right-6 bottom-6 z-50 inline-flex size-14 items-center justify-center rounded-full text-white shadow-xl transition-all',
        'hover:scale-110 hover:shadow-2xl',
        'focus-visible:ring-4 focus-visible:ring-[#F5A623]/40 focus-visible:outline-none',
        'animate-in fade-in slide-in-from-bottom-2 duration-500',
      )}
      style={{ background: 'linear-gradient(135deg, #0E4F88 0%, #1565a8 100%)' }}
    >
      {/* Pulsation décorative */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full opacity-60"
        style={{
          background: 'linear-gradient(135deg, #0E4F88 0%, #1565a8 100%)',
          animation: 'chatbot-pulse 2s ease-in-out infinite',
        }}
      />
      <MessageCircle className="size-6" aria-hidden />
      <span className="sr-only">Ouvrir l&apos;Assistant SCS</span>
      <style>{`
        @keyframes chatbot-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>
    </button>
  );
}
