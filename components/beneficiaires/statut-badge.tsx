import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  STATUT_BENEFICIAIRE_LIBELLES,
  type StatutBeneficiaireCode,
} from '@/lib/schemas/nomenclatures';

/**
 * Badge coloré pour afficher le statut d'un bénéficiaire selon les 5 valeurs
 * de la table `statuts_beneficiaire` :
 *   - INSCRIT : gris neutre
 *   - PRESENT_EFFECTIF : bleu cyan OIF (en cours)
 *   - FORMATION_ACHEVEE : vert OIF (succès)
 *   - ABANDON : orange (alerte méthodologique)
 *   - NON_PRECISE : gris atténué
 *
 * Utilisation :
 *   <StatutBadge code="FORMATION_ACHEVEE" />
 *   <StatutBadge code={beneficiaire.statut_code} />
 */

const STATUT_STYLES: Record<StatutBeneficiaireCode, string> = {
  INSCRIT: 'border-transparent bg-muted text-muted-foreground',
  PRESENT_EFFECTIF:
    'border-transparent bg-[var(--color-oif-bleu-cyan)]/15 text-[var(--color-oif-bleu-cyan)]',
  FORMATION_ACHEVEE:
    'border-transparent bg-[var(--color-oif-vert)]/15 text-[var(--color-oif-vert)]',
  ABANDON: 'border-transparent bg-[var(--color-oif-rouge)]/15 text-[var(--color-oif-rouge)]',
  NON_PRECISE: 'border-transparent bg-muted/60 text-muted-foreground/80',
};

export type StatutBadgeProps = {
  code: StatutBeneficiaireCode;
  className?: string;
};

export function StatutBadge({ code, className }: StatutBadgeProps) {
  const libelle = STATUT_BENEFICIAIRE_LIBELLES[code];
  return (
    <Badge
      className={cn('font-medium', STATUT_STYLES[code], className)}
      aria-label={`Statut : ${libelle}`}
    >
      {libelle}
    </Badge>
  );
}
