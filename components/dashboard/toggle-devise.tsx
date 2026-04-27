'use client';

import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type Devise = 'EUR' | 'FCFA';

const STORAGE_KEY = 'oif-dashboard-devise';

/**
 * Toggle EUR ↔ FCFA persisté en localStorage. Diffuse via un événement
 * personnalisé `oif:devise-change` que les composants enfants peuvent
 * écouter pour reformatter leurs montants.
 */
export function ToggleDevise() {
  const [devise, setDevise] = useState<Devise>('EUR');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'EUR' || stored === 'FCFA') setDevise(stored);
  }, []);

  const change = (d: Devise) => {
    setDevise(d);
    window.localStorage.setItem(STORAGE_KEY, d);
    window.dispatchEvent(new CustomEvent('oif:devise-change', { detail: d }));
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <Coins aria-hidden className="size-4" />
        Devise :
      </span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={devise === 'EUR' ? 'default' : 'outline'}
          onClick={() => change('EUR')}
          className={cn('h-8', devise === 'EUR' && 'pointer-events-none')}
        >
          EUR (€)
        </Button>
        <Button
          size="sm"
          variant={devise === 'FCFA' ? 'default' : 'outline'}
          onClick={() => change('FCFA')}
          className={cn('h-8', devise === 'FCFA' && 'pointer-events-none')}
        >
          FCFA
        </Button>
      </div>
    </div>
  );
}

/**
 * Hook utilitaire pour les Client Components qui veulent réagir au toggle.
 */
export function useDevise(): Devise {
  const [devise, setDevise] = useState<Devise>('EUR');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'EUR' || stored === 'FCFA') setDevise(stored);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Devise>).detail;
      if (detail) setDevise(detail);
    };
    window.addEventListener('oif:devise-change', onChange);
    return () => window.removeEventListener('oif:devise-change', onChange);
  }, []);

  return devise;
}
