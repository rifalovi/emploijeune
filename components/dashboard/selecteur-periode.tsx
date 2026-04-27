'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PERIODES, PERIODE_LIBELLES, type Periode } from '@/lib/kpis/indicateurs-oif';
import { cn } from '@/lib/utils';

/**
 * Boutons radio pour filtrer les KPI par période (7j / 30j / 90j / all).
 * Pousse `?periode=XX` dans l'URL et déclenche un re-render serveur via
 * router.replace + transition. Le serveur lit le paramètre et appelle
 * `get_indicateurs_oif_v1(p_periode)`.
 */
export function SelecteurPeriode({ valeur }: { valeur: Periode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const change = (nouvelle: Periode) => {
    const params = new URLSearchParams(searchParams);
    params.set('periode', nouvelle);
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <Calendar aria-hidden className="size-4" />
        Période :
      </span>
      <div className="flex flex-wrap gap-1">
        {PERIODES.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={p === valeur ? 'default' : 'outline'}
            onClick={() => change(p)}
            disabled={pending}
            className={cn('h-8', p === valeur && 'pointer-events-none')}
          >
            {PERIODE_LIBELLES[p]}
          </Button>
        ))}
      </div>
    </div>
  );
}
