'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * En-tête de colonne cliquable pour trier la liste (tri serveur via les
 * query params `tri` + `ordre`). Générique : s'appuie directement sur
 * next/navigation, réutilisable pour Bénéficiaires et Structures.
 *
 * Cycle au clic : (inactif) → asc → desc → sans tri.
 */
export function EnteteTriable({
  colonne,
  children,
  className,
}: {
  /** Clé logique de tri (doit exister dans l'allowlist côté requête). */
  colonne: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const triActuel = searchParams.get('tri');
  const ordreActuel = searchParams.get('ordre') === 'desc' ? 'desc' : 'asc';
  const actif = triActuel === colonne;

  const onClick = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (!actif) {
      p.set('tri', colonne);
      p.set('ordre', 'asc');
    } else if (ordreActuel === 'asc') {
      p.set('tri', colonne);
      p.set('ordre', 'desc');
    } else {
      p.delete('tri');
      p.delete('ordre');
    }
    p.delete('page');
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [actif, colonne, ordreActuel, pathname, router, searchParams]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Trier par ${typeof children === 'string' ? children : colonne}`}
      className={cn(
        'hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors',
        actif ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      {children}
      {!actif ? (
        <ChevronsUpDown className="size-3 opacity-40" aria-hidden />
      ) : ordreActuel === 'asc' ? (
        <ArrowUp className="size-3" aria-hidden />
      ) : (
        <ArrowDown className="size-3" aria-hidden />
      )}
    </button>
  );
}
