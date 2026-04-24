import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUT_STRUCTURE_LIBELLES, type StatutStructure } from '@/lib/schemas/nomenclatures';

/**
 * Badge coloré pour afficher le statut de création / renforcement / relance
 * d'une structure appuyée (indicateur B1).
 *
 * Les trois valeurs de `public.statut_structure` :
 *   - creation : vert OIF (nouvelle structure créée via le projet)
 *   - renforcement : bleu cyan OIF (structure existante renforcée)
 *   - relance : orange (structure en difficulté ayant été relancée)
 *
 * @example
 * <StatutStructureBadge code="creation" />
 * <StatutStructureBadge code={structure.statut_creation} />
 */

const STATUT_STYLES: Record<StatutStructure, string> = {
  creation: 'border-transparent bg-[var(--color-oif-vert)]/15 text-[var(--color-oif-vert)]',
  renforcement:
    'border-transparent bg-[var(--color-oif-bleu-cyan)]/15 text-[var(--color-oif-bleu-cyan)]',
  relance: 'border-transparent bg-[var(--color-oif-rouge)]/15 text-[var(--color-oif-rouge)]',
};

export type StatutStructureBadgeProps = {
  code: StatutStructure;
  className?: string;
};

export function StatutStructureBadge({ code, className }: StatutStructureBadgeProps) {
  const libelle = STATUT_STRUCTURE_LIBELLES[code];
  return (
    <Badge
      className={cn('font-medium', STATUT_STYLES[code], className)}
      aria-label={`Statut structure : ${libelle}`}
    >
      {libelle}
    </Badge>
  );
}
