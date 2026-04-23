'use client';

import {
  INDICATIFS_PAYS,
  PAYS_PICKER_DEFAUT,
  appliquerIndicatif,
  emojiDrapeau,
} from '@/lib/data/indicatifs-pays';
import { cn } from '@/lib/utils';

/**
 * Picker rapide des 5 indicatifs téléphoniques pour faciliter la saisie.
 *
 * Décision Q1 Étape 4c : input <input type="tel"> simple + 5 boutons de
 * pré-remplissage d'indicatif sous le champ. Les 5 pays affichés sont :
 *   - Par défaut : les 5 pays OIF les plus fréquents (MLI, BFA, HTI, KHM, MDG)
 *   - Si un projet est pré-rempli et qu'on connaît ses pays dominants :
 *     on utilise ces pays (prop `paysProposes`).
 *
 * Au clic sur un bouton, l'indicatif (+226 par exemple) est inséré en début
 * du champ téléphone :
 *   - Si champ vide → ajoute juste l'indicatif
 *   - Si champ commence déjà par +XXX → remplace l'indicatif
 *   - Sinon → prépend l'indicatif à la valeur existante
 *
 * La logique de remplacement est testable en unité (cf. tests indicatifs-pays).
 */

export type PickerIndicatifPaysProps = {
  /** Valeur courante du champ téléphone. */
  valeur: string;
  /** Handler de changement (reçoit la nouvelle valeur avec indicatif appliqué). */
  onChange: (nouvelle: string) => void;
  /**
   * Pays à proposer (5 max). Si non fourni, utilise les 5 pays OIF par défaut.
   * Reçoit des codes ISO-3.
   */
  paysProposes?: readonly string[];
  className?: string;
};

export function PickerIndicatifPays({
  valeur,
  onChange,
  paysProposes,
  className,
}: PickerIndicatifPaysProps) {
  const codes = (paysProposes && paysProposes.length > 0 ? paysProposes : PAYS_PICKER_DEFAUT).slice(
    0,
    5,
  );

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5 text-xs', className)}
      aria-label="Choix rapide de l’indicatif téléphonique"
    >
      <span className="text-muted-foreground">Indicatif rapide&nbsp;:</span>
      {codes.map((code) => {
        const pays = INDICATIFS_PAYS[code];
        if (!pays) return null;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(appliquerIndicatif(valeur, pays.indicatif))}
            className="border-border hover:bg-muted inline-flex items-center gap-1 rounded-md border bg-transparent px-2 py-1 text-xs transition-colors"
            aria-label={`Pré-remplir l’indicatif ${pays.libelle} (${pays.indicatif})`}
          >
            <span aria-hidden>{emojiDrapeau(pays.code_iso2)}</span>
            <span className="truncate">{pays.libelle}</span>
            <span className="text-muted-foreground tabular-nums">{pays.indicatif}</span>
          </button>
        );
      })}
    </div>
  );
}
