import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PROGRAMMES_STRATEGIQUES, programmeStrategiqueDuProjet } from '@/lib/design/oif/programmes';
import type { ProgrammeStrategiqueCode } from '@/lib/schemas/nomenclatures';

/**
 * Badge d'identification d'un projet bénéficiaire avec couleur du Programme
 * Stratégique auquel il appartient.
 *
 * Sources :
 *   - Couleurs PS : `lib/design/oif/programmes.ts` (PS1 bleu cyan, PS2 violet, PS3 vert)
 *   - Mapping PROJ_A* → PS : via helper `programmeStrategiqueDuProjet()` en fallback,
 *     OU via la prop `programmeStrategique` si déjà récupérée par JOIN côté DB
 *     (source de vérité préférée).
 *
 * Utilisations :
 *   1. Dans la liste bénéficiaires (mode `variant="inline"`) : petite pastille + code court
 *   2. Dans la vue détail (mode `variant="full"`) : pastille large + code + libellé long
 *
 * @example
 * <BadgeProjet code="PROJ_A16a" libelle="D-CLIC : Formez-vous au numérique" />
 * <BadgeProjet code="PROJ_A14" variant="inline" />
 */

export type BadgeProjetProps = {
  /** Code projet officiel (ex. `PROJ_A16a`). */
  code: string;
  /**
   * Libellé complet du projet (si fourni, affiché en mode `full`).
   * Si absent, seul le code est affiché.
   */
  libelle?: string | null;
  /**
   * PS du projet, si déjà récupéré par JOIN en DB (source de vérité).
   * Sinon, déduit via `programmeStrategiqueDuProjet(code)`.
   */
  programmeStrategique?: ProgrammeStrategiqueCode | null;
  /**
   * `inline` (défaut) : pastille compacte pour listes.
   * `full` : badge large avec code + libellé pour vue détail.
   */
  variant?: 'inline' | 'full';
  className?: string;
};

export function BadgeProjet({
  code,
  libelle,
  programmeStrategique,
  variant = 'inline',
  className,
}: BadgeProjetProps) {
  const ps = programmeStrategique ?? programmeStrategiqueDuProjet(code);
  const couleur = ps ? PROGRAMMES_STRATEGIQUES[ps].principale : null;

  const style = couleur
    ? {
        backgroundColor: `${couleur}15`, // ~8% alpha
        color: couleur,
        borderColor: `${couleur}40`,
      }
    : undefined;

  const ariaLabel = ps
    ? `Projet ${code} (${PROGRAMMES_STRATEGIQUES[ps].libelle})`
    : `Projet ${code}`;

  if (variant === 'inline') {
    return (
      <Badge
        variant="outline"
        style={style}
        className={cn('font-medium', className)}
        aria-label={ariaLabel}
      >
        {code}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      style={style}
      className={cn('gap-1.5 px-2.5 py-1 font-medium', className)}
      aria-label={ariaLabel}
    >
      <span className="font-semibold">{code}</span>
      {libelle && (
        <>
          <span aria-hidden>—</span>
          <span className="font-normal">{libelle}</span>
        </>
      )}
    </Badge>
  );
}
