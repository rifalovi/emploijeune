'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, X } from 'lucide-react';
import { sortirVueUtilisateur } from '@/lib/auth/view-as-actions';
import { Button } from '@/components/ui/button';

const ROLE_LIBELLES: Record<string, string> = {
  admin_scs: 'Administrateur SCS',
  editeur_projet: 'Coordonnateur',
  contributeur_partenaire: 'Partenaire',
  lecteur: 'Lecteur',
};

export type BandeauViewAsProps = {
  cibleNomComplet: string;
  cibleRole: string;
  expiresAt: number;
};

/**
 * Bandeau permanent affiché en haut de toutes les pages quand l'admin SCS
 * est en mode view-as. Affiche la cible + un compte à rebours + un bouton
 * « Revenir à mon admin » qui supprime le cookie.
 */
export function BandeauViewAs({ cibleNomComplet, cibleRole, expiresAt }: BandeauViewAsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [restant, setRestant] = useState<number>(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const t = setInterval(() => {
      setRestant(Math.max(0, expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const handleSortir = () => {
    startTransition(async () => {
      await sortirVueUtilisateur();
      router.refresh();
    });
  };

  const minutes = Math.floor(restant / 60000);
  const secondes = Math.floor((restant % 60000) / 1000);
  const expireSoon = restant < 5 * 60 * 1000;

  return (
    <div
      className="sticky top-0 z-50 border-b border-amber-500/40 bg-amber-100 dark:bg-amber-950/60"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
        <div className="flex items-center gap-2">
          <Eye aria-hidden className="size-4 shrink-0" />
          <span>
            <strong>Vous visualisez la plateforme</strong> en tant que{' '}
            <strong>{cibleNomComplet}</strong> ({ROLE_LIBELLES[cibleRole] ?? cibleRole}). Toutes les
            écritures sont bloquées.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs tabular-nums ${expireSoon ? 'font-bold text-amber-700 dark:text-amber-300' : ''}`}
            aria-label="Temps restant avant expiration de la session view-as"
          >
            {minutes}:{String(secondes).padStart(2, '0')}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSortir}
            disabled={pending}
            className="gap-1 border-amber-700 bg-white text-amber-900 hover:bg-amber-50"
          >
            <X aria-hidden className="size-3.5" />
            {pending ? 'Sortie…' : 'Revenir à mon admin'}
          </Button>
        </div>
      </div>
    </div>
  );
}
