import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Section pliable basée sur l'élément HTML natif `<details>` / `<summary>`.
 *
 * Avantages :
 *   - Zéro dépendance JS (pas d'animation contrôlée par React, le navigateur
 *     gère l'ouverture/fermeture nativement).
 *   - Accessibilité native (rôle disclosure, support clavier Enter/Space,
 *     ARIA implicite).
 *   - Compatible SSR sans hydration mismatch.
 *
 * @example
 * <CollapsibleSection title="Détails du porteur" defaultOpen={false}>
 *   <FormField ... />
 * </CollapsibleSection>
 */

export type CollapsibleSectionProps = {
  title: string;
  /** Sous-titre optionnel affiché à droite du titre (ex. nombre de champs). */
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function CollapsibleSection({
  title,
  hint,
  defaultOpen = false,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group bg-card overflow-hidden rounded-lg border shadow-sm transition-shadow',
        'open:shadow',
        className,
      )}
    >
      <summary
        className={cn(
          'hover:bg-muted/50 flex cursor-pointer items-center justify-between px-4 py-3',
          'text-base font-semibold select-none',
          'list-none [&::-webkit-details-marker]:hidden',
          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        )}
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            aria-hidden
            className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
          />
          {title}
        </span>
        {hint && <span className="text-muted-foreground text-sm font-normal">{hint}</span>}
      </summary>
      <div className="space-y-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}
