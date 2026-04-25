'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Hook miroir de `useStructureFilters` pour la liste enquêtes (6c).
 * URL = source de vérité, validation côté serveur via `enqueteFiltersSchema`.
 */
export function useEnqueteFilters() {
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
