'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Radio « choix unique » pour les questions à options du questionnaire
 * (Q A203, A205, A206, A401, A405, A406, A408, A409, B211).
 *
 * HTML radio standard (pas de Base-UI). Layout en colonne pour favoriser
 * la lecture des libellés longs (les énoncés OIF sont parfois verbeux).
 */

export type RadioChoixUniqueOption = { valeur: string; libelle: string };

export type RadioChoixUniqueProps = {
  options: ReadonlyArray<RadioChoixUniqueOption>;
  value: string | undefined;
  onValueChange: (valeur: string) => void;
  name: string;
  disabled?: boolean;
  className?: string;
};

export function RadioChoixUnique({
  options,
  value,
  onValueChange,
  name,
  disabled,
  className,
}: RadioChoixUniqueProps) {
  return (
    <fieldset className={cn('flex flex-col gap-1.5', disabled && 'opacity-60', className)}>
      {options.map((opt) => {
        const id = `${name}-${opt.valeur}`;
        const checked = value === opt.valeur;
        return (
          <label
            key={opt.valeur}
            htmlFor={id}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
              'hover:bg-accent',
              checked ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-input',
              disabled && 'pointer-events-none cursor-not-allowed',
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={opt.valeur}
              checked={checked}
              disabled={disabled}
              onChange={() => onValueChange(opt.valeur)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'mt-0.5 inline-block size-3 shrink-0 rounded-full border-2',
                checked ? 'border-primary bg-primary' : 'border-muted-foreground',
              )}
            />
            <span className="leading-tight">{opt.libelle}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
