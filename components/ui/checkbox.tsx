'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Composant Checkbox minimaliste (sans Radix) — V2.6.
 *
 * Sémantique : wrappe un `<input type="checkbox">` natif avec un overlay
 * visuel stylé. Compatible avec react-hook-form via `ref` forwarding et
 * avec le pattern `onCheckedChange` de shadcn/ui (renvoie `true | false`,
 * jamais `'indeterminate'`).
 *
 * Pourquoi pas Radix : `@radix-ui/react-checkbox` n'est pas dans les deps,
 * et un input natif accessible suffit pour les formulaires de collecte.
 */
export type CheckboxProps = {
  id?: string;
  checked?: boolean;
  disabled?: boolean;
  className?: string;
  onCheckedChange?: (checked: boolean) => void;
  required?: boolean;
  'aria-label'?: string;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ id, checked, disabled, className, onCheckedChange, required, ...rest }, ref) {
    return (
      <span className={cn('relative inline-flex size-4 shrink-0 items-center justify-center', className)}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked ?? false}
          disabled={disabled}
          required={required}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          aria-label={rest['aria-label']}
          className={cn(
            'peer absolute inset-0 size-4 cursor-pointer appearance-none rounded border border-slate-300 bg-white',
            'checked:border-[#0E4F88] checked:bg-[#0E4F88]',
            'focus-visible:ring-2 focus-visible:ring-[#0E4F88]/30 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        <Check
          aria-hidden
          className="pointer-events-none size-3 text-white opacity-0 peer-checked:opacity-100"
        />
      </span>
    );
  },
);
