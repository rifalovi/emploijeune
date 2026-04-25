'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Radio binaire Oui/Non pour les questions booléennes des questionnaires
 * (Q A201, A208, A403, A407, B201, B203, B204, B301, etc.).
 *
 * HTML radio standard — pas de Base-UI (cf. hotfix 5h).
 * Convention : value === true ↔ « Oui », value === false ↔ « Non ».
 * Tri-state : `undefined` = non répondu (aucune sélection).
 */

export type RadioOuiNonProps = {
  value: boolean | undefined;
  onValueChange: (valeur: boolean) => void;
  name: string;
  disabled?: boolean;
  libelleOui?: string;
  libelleNon?: string;
  className?: string;
};

export function RadioOuiNon({
  value,
  onValueChange,
  name,
  disabled,
  libelleOui = 'Oui',
  libelleNon = 'Non',
  className,
}: RadioOuiNonProps) {
  return (
    <fieldset className={cn('flex flex-wrap gap-2', disabled && 'opacity-60', className)}>
      {[
        { val: true, libelle: libelleOui },
        { val: false, libelle: libelleNon },
      ].map(({ val, libelle }) => {
        const id = `${name}-${val ? 'oui' : 'non'}`;
        const checked = value === val;
        return (
          <label
            key={String(val)}
            htmlFor={id}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors',
              'hover:bg-accent',
              checked ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-input',
              disabled && 'pointer-events-none cursor-not-allowed',
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={String(val)}
              checked={checked}
              disabled={disabled}
              onChange={() => onValueChange(val)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'inline-block size-3 rounded-full border-2',
                checked ? 'border-primary bg-primary' : 'border-muted-foreground',
              )}
            />
            <span>{libelle}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
