'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Échelle de type Likert (4 ou 5 paliers) pour les questions de
 * satisfaction (Q A209 / Q B304 → C5) et de niveau de compétence
 * (Q A301 / Q A302 → A4).
 *
 * Pattern accessible : <fieldset> + <input type="radio"> standards.
 * Aucune dépendance Base-UI → pas de risque de régression
 * useCompositeListItem (cf. hotfix 5h).
 *
 * Mode d'utilisation typique avec react-hook-form :
 *
 *   <FormField
 *     control={form.control}
 *     name="c5.satisfaction"
 *     render={({ field }) => (
 *       <EchelleLikert
 *         options={ECHELLE_SATISFACTION_VALUES.map(v => ({ valeur: v, libelle: ECHELLE_SATISFACTION_LIBELLES[v] }))}
 *         value={field.value}
 *         onValueChange={field.onChange}
 *         name={field.name}
 *       />
 *     )}
 *   />
 */

export type EchelleLikertOption = { valeur: string; libelle: string };

export type EchelleLikertProps = {
  options: ReadonlyArray<EchelleLikertOption>;
  value: string | undefined;
  onValueChange: (valeur: string) => void;
  name: string;
  disabled?: boolean;
  /** Affiche les libellés en pleine largeur sous chaque palier (tablette). */
  layout?: 'horizontal' | 'compact';
  className?: string;
};

export function EchelleLikert({
  options,
  value,
  onValueChange,
  name,
  disabled,
  layout = 'horizontal',
  className,
}: EchelleLikertProps) {
  return (
    <fieldset
      className={cn('border-input rounded-md border p-2', disabled && 'opacity-60', className)}
    >
      <div
        className={cn(
          'grid gap-1',
          layout === 'horizontal' ? `grid-cols-${options.length}` : 'grid-cols-1 sm:grid-cols-2',
        )}
        // Tailwind ne génère pas dynamiquement grid-cols-${n} → fallback inline
        // pour éviter le risque de purge.
        style={
          layout === 'horizontal'
            ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {options.map((opt, idx) => {
          const id = `${name}-${opt.valeur}`;
          const checked = value === opt.valeur;
          return (
            <label
              key={opt.valeur}
              htmlFor={id}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-1 rounded-md border p-2 text-center text-xs transition-colors',
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
              <span className="text-muted-foreground font-mono text-[10px]">{idx + 1}</span>
              <span className="leading-tight">{opt.libelle}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
