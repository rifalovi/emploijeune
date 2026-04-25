'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnqueteFilters } from './use-enquete-filters';
import { cn } from '@/lib/utils';

export type EnquetePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const PAGE_SIZES = [10, 25, 50, 100];

export function EnquetePagination({ page, pageSize, total, totalPages }: EnquetePaginationProps) {
  const { setParams } = useEnqueteFilters();
  if (total === 0) return null;

  const goTo = (p: number) => {
    const target = Math.max(1, Math.min(totalPages, p));
    setParams({ page: String(target) });
  };
  const setPageSize = (val: string) => {
    setParams({ pageSize: val === '25' ? null : val, page: '1' });
  };

  const debut = (page - 1) * pageSize + 1;
  const fin = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm">
        Affichage {debut}-{fin} sur <strong>{total.toLocaleString('fr-FR')}</strong> session
        {total > 1 ? 's' : ''} d’enquête · Page {page} sur {totalPages}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-muted-foreground text-sm">
            Par page
          </label>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v ?? '25')}>
            <SelectTrigger id="page-size" className="w-20" aria-label="Taille de la page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Première page"
            onClick={() => goTo(1)}
            disabled={page <= 1}
          >
            <ChevronsLeft aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Page précédente"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <span className={cn('px-2 text-sm font-medium', 'tabular-nums')}>
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Page suivante"
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Dernière page"
            onClick={() => goTo(totalPages)}
            disabled={page >= totalPages}
          >
            <ChevronsRight aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
