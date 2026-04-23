import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Message d'alerte non bloquant pour signaler une incohérence de saisie
 * sans freiner l'utilisateur (décision Q2 Étape 4c : warning + flag DB
 * qualite_a_verifier, pas de blocage).
 *
 * Usage typique : statut « Formation achevée » sélectionné mais date de fin
 * non renseignée — on prévient, on ne bloque pas.
 */

export type WarningQualiteProps = {
  message: string;
  className?: string;
};

export function WarningQualite({ message, className }: WarningQualiteProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900',
        'dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
        className,
      )}
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="leading-snug">{message}</p>
    </div>
  );
}

/**
 * Helper pur : retourne le message d'alerte à afficher si la combinaison
 * statut / date_fin_formation est incohérente. Aligné avec le calcul de la
 * colonne générée `qualite_a_verifier` (migration 007).
 *
 * Testable en unité (pas de state React). Appelé depuis `BeneficiaireForm`.
 */
export function messageWarningQualiteStatut(
  statutCode: string | undefined,
  dateFinFormation: unknown,
): string | null {
  const statutsExigeantDateFin = new Set(['FORMATION_ACHEVEE', 'ABANDON']);
  if (!statutCode || !statutsExigeantDateFin.has(statutCode)) return null;
  if (dateFinFormation && String(dateFinFormation).trim() !== '') return null;
  return 'Statut « Formation achevée » ou « Abandon » sélectionné mais date de fin de formation non renseignée. Vous pourrez compléter plus tard, mais cette fiche sera signalée comme incomplète dans le tableau qualité du SCS.';
}
