'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Hook pour synchroniser les filtres de la liste bénéficiaires avec
 * les query params de l'URL (pattern classique, partageable, navigation
 * back/forward naturelle).
 *
 * Les valeurs sont lues/écrites comme strings dans l'URL. La validation
 * et la transformation en objet typé se font côté serveur via
 * `beneficiaireFiltersSchema`.
 */
export function useBeneficiaireFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback((key: string): string => searchParams.get(key) ?? '', [searchParams]);

  const setParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const current = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === '' || v === 'tous') {
          current.delete(k);
        } else {
          current.set(k, v);
        }
      }
      // Toute modification de filtre réinitialise la page à 1
      if (!('page' in updates)) {
        current.delete('page');
      }
      const qs = current.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const reset = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  return { get, setParams, reset };
}
