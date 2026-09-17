'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Index alphabétique A–Z (façon répertoire de contacts) : filtre la liste sur
 * l'initiale du nom via le query param `lettre`. Générique (next/navigation),
 * réutilisable Bénéficiaires / Structures. « Tous » enlève le filtre.
 */
export function IndexAlphabetique({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = (searchParams.get('lettre') ?? '').toUpperCase();

  const go = useCallback(
    (lettre: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (!lettre || lettre === active) {
        p.delete('lettre');
      } else {
        p.set('lettre', lettre);
      }
      p.delete('page');
      const qs = p.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [active, pathname, router, searchParams],
  );

  const classeBouton = (estActif: boolean) =>
    cn(
      'rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
      estActif
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    );

  return (
    <div
      role="group"
      aria-label="Filtre alphabétique par initiale du nom"
      className={cn('flex flex-wrap items-center gap-0.5', className)}
    >
      <button type="button" onClick={() => go('')} className={classeBouton(active === '')}>
        Tous
      </button>
      {LETTRES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => go(l)}
          aria-pressed={active === l}
          className={classeBouton(active === l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
