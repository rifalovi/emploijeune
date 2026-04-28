'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Switch — toggle accessible custom (sans dépendance Radix). Pattern button
 * + role=switch + aria-checked. Compatible clavier (Espace/Entrée), focus
 * visible via ring.
 */
export interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, className, id, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange?.(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
          'transition-colors duration-200',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-[#0E4F88]' : 'bg-slate-300',
          className,
        )}
        {...rest}
      >
        <span
          aria-hidden
          className={cn(
            'pointer-events-none inline-block size-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    );
  },
);
Switch.displayName = 'Switch';
