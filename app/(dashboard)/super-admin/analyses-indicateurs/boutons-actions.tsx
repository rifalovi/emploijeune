'use client';

import { useFormStatus } from 'react-dom';
import { RefreshCw, Eye, Trash2, PenLine, Loader2 } from 'lucide-react';

/**
 * Boutons clients avec spinner de pending state pour les Server Actions
 * de la page /super-admin/analyses-indicateurs.
 *
 * Pourquoi `'use client'` :
 *   - `useFormStatus()` ne fonctionne QUE dans un Client Component
 *   - chaque bouton doit être à l'intérieur d'un <form action={serverAction}>
 *     (le hook lit le pending state du <form> parent)
 *
 * Pourquoi 4 composants distincts plutôt qu'un :
 *   - chacun a son icône + son label spécifique (Générer/Publier/Supprimer/Sauvegarder)
 *   - chacun peut être disabled/coloré indépendamment
 *   - bundle reste minuscule (5kB gzipped pour les 4)
 */

// ─── Bouton Générer / Regénérer ───────────────────────────────────────────────
export function BoutonGenerer({ aDejaAnalyse }: { aDejaAnalyse: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="size-3" aria-hidden />
      )}
      {pending ? 'Génération…' : aDejaAnalyse ? 'Regénérer' : 'Générer'}
    </button>
  );
}

// ─── Bouton Publier ───────────────────────────────────────────────────────────
export function BoutonPublier({ couleur }: { couleur: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ color: couleur }}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <Eye className="size-3" aria-hidden />
      )}
      {pending ? 'Publication…' : 'Publier'}
    </button>
  );
}

// ─── Bouton Supprimer ─────────────────────────────────────────────────────────
export function BoutonSupprimer() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="size-3" aria-hidden />
      )}
      {pending ? 'Suppression…' : 'Supprimer'}
    </button>
  );
}

// ─── Bouton Sauvegarder (éditeur inline) ─────────────────────────────────────
export function BoutonSauvegarder() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E4F88] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0a3d6b] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <PenLine className="size-3" aria-hidden />
      )}
      {pending ? 'Sauvegarde…' : 'Sauvegarder les modifications'}
    </button>
  );
}
