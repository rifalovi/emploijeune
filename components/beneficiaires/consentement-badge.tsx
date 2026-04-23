import { Check, X, CircleHelp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Badge visuel RGPD pour un bénéficiaire :
 *   - recueilli === true : « Consentement recueilli » en vert avec icône ✓
 *   - recueilli === false : « Consentement non recueilli » en rouge avec icône ✗
 *   - recueilli === null/undefined : « Non précisé » en gris avec ?
 *
 * Utilisé dans la vue détail et dans la liste (colonne optionnelle).
 */

export type ConsentementBadgeProps = {
  recueilli: boolean | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
};

export function ConsentementBadge({ recueilli, size = 'md', className }: ConsentementBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs py-0.5 px-1.5' : '';
  const iconSize = size === 'sm' ? 'size-3' : 'size-3.5';

  if (recueilli === true) {
    return (
      <Badge
        className={cn(
          'gap-1 border-transparent bg-[var(--color-oif-vert)]/15 text-[var(--color-oif-vert)]',
          sizeClasses,
          className,
        )}
        aria-label="Consentement RGPD recueilli"
      >
        <Check aria-hidden className={iconSize} />
        Consentement recueilli
      </Badge>
    );
  }
  if (recueilli === false) {
    return (
      <Badge
        className={cn(
          'gap-1 border-transparent bg-[var(--color-oif-rouge)]/15 text-[var(--color-oif-rouge)]',
          sizeClasses,
          className,
        )}
        aria-label="Consentement RGPD non recueilli"
      >
        <X aria-hidden className={iconSize} />
        Consentement non recueilli
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        'bg-muted text-muted-foreground gap-1 border-transparent',
        sizeClasses,
        className,
      )}
      aria-label="Statut du consentement RGPD non précisé"
    >
      <CircleHelp aria-hidden className={iconSize} />
      Non précisé
    </Badge>
  );
}
