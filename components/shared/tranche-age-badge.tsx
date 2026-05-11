/**
 * Badge visuel OIF pour la tranche d'âge d'un bénéficiaire.
 *
 * Deux niveaux d'entrée possibles :
 *  - `trancheCalculee` : résultat de `calculerTrancheAge()` ('18-34 ans', '35-60 ans', …)
 *    Utilisé dans BeneficiaireTable où on a la date de naissance.
 *  - `trancheDeclaree` : valeur brute base OIF ('Jeune' | 'Adulte' | null)
 *    Utilisé dans EnqueteTable / ListeCiblesRevue où on n'a que la donnée déclarée.
 *
 * Palette OIF (alignée sur les programmes stratégiques) :
 *   Jeune (18-34)  → cyan   #0198E9  (PS1 — Éducation / Emploi)
 *   Adulte (35-60) → violet #5D0073  (PS2 — Francophonie économique)
 *   Senior (+60)   → gris ardoise  (hors cible opérationnelle)
 *   Mineur         → ambre  (anomalie de saisie)
 *   Non renseigné  → tiret gris
 */

import { Badge } from '@/components/ui/badge';
import type { TrancheAge } from '@/components/beneficiaires/tranche-age';

// ─── Couleurs OIF ────────────────────────────────────────────────────────────
const JEUNE_COLOR = '#0198E9';
const ADULTE_COLOR = '#5D0073';
const SENIOR_COLOR = '#64748B'; // slate-500
const MINEUR_COLOR = '#D97706'; // amber-600

// ─── 1. Depuis tranche calculée (prioritaire — date de naissance connue) ─────

type TrancheCalculeeProps = {
  tranche: TrancheAge;
  /** Affiche "(déclaré)" si la tranche vient du fallback declaré, pas du calcul. */
  estDeclaree?: boolean;
};

export function TrancheAgeCalculeeBadge({ tranche, estDeclaree }: TrancheCalculeeProps) {
  if (tranche === 'Non renseigné') {
    return <span className="text-muted-foreground text-xs italic">—</span>;
  }

  const { couleur, libelle } = TRANCHE_CALCULEE_META[tranche];

  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        variant="outline"
        className="text-[10px] leading-tight"
        style={{ color: couleur, borderColor: `${couleur}55` }}
      >
        {libelle}
      </Badge>
      {estDeclaree && (
        <span className="text-muted-foreground text-[9px]" title="Tranche déclarée (date de naissance non disponible)">
          décl.
        </span>
      )}
    </span>
  );
}

const TRANCHE_CALCULEE_META: Record<TrancheAge, { couleur: string; libelle: string }> = {
  '18-34 ans': { couleur: JEUNE_COLOR, libelle: 'Jeune 18–34' },
  '35-60 ans': { couleur: ADULTE_COLOR, libelle: 'Adulte 35–60' },
  '+60 ans': { couleur: SENIOR_COLOR, libelle: 'Senior 60+' },
  'Mineur (<18)': { couleur: MINEUR_COLOR, libelle: 'Mineur <18' },
  'Non renseigné': { couleur: SENIOR_COLOR, libelle: '—' },
};

// ─── 2. Depuis tranche déclarée OIF (Jeune / Adulte) ─────────────────────────

type TrancheDeclareeProps = {
  tranche: 'Jeune' | 'Adulte' | null | undefined;
};

export function TrancheAgeDeclareesBadge({ tranche }: TrancheDeclareeProps) {
  if (!tranche) {
    return <span className="text-muted-foreground text-[10px] italic">—</span>;
  }

  const couleur = tranche === 'Jeune' ? JEUNE_COLOR : ADULTE_COLOR;
  const libelle = tranche === 'Jeune' ? 'Jeune 18–34' : 'Adulte 35+';

  return (
    <Badge
      variant="outline"
      className="text-[10px]"
      style={{ color: couleur, borderColor: `${couleur}55` }}
    >
      {libelle}
    </Badge>
  );
}
