import type { DeviseCode } from '@/lib/schemas/nomenclatures';

/**
 * Formate un montant monétaire pour affichage utilisateur (fr-FR) selon la
 * devise passée en paramètre. Utilise `Intl.NumberFormat` pour respecter les
 * règles locales (séparateur milliers espacé insécable, symbole devise, etc.).
 *
 * Valeurs supportées :
 *   - Codes ISO 4217 standard : EUR, USD, XOF, XAF, MAD, DZD, TND, MGA, MRU,
 *     CDF, RWF, DJF, LBP, HTG — tous reconnus nativement par Intl.
 *   - Valeur spéciale « Autre » : pas de devise native → on affiche le
 *     montant formaté en fr-FR sans suffixe devise (responsabilité du
 *     composant appelant d'afficher le libellé libre saisi si besoin).
 *
 * @param montant Nombre positif (ou 0). `undefined`/`null` → chaîne vide.
 * @param devise Code devise parmi `DEVISES_CODES`. Par défaut `EUR`.
 * @returns Chaîne formatée, ex. « 1 500,00 € » ou « 250 000 FCFA ».
 *
 * @example
 * formaterMontant(1500, 'EUR')  // "1 500,00 €"
 * formaterMontant(250000, 'XOF') // "250 000 F CFA"
 * formaterMontant(undefined)    // ""
 */
export function formaterMontant(
  montant: number | null | undefined,
  devise: DeviseCode | null | undefined = 'EUR',
): string {
  if (montant === null || montant === undefined || Number.isNaN(montant)) return '';

  // Devise libre (valeur « Autre » du nomenclature) : formatage numérique
  // simple sans symbole, la devise littérale est portée par le composant UI.
  if (!devise || devise === 'Autre') {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(montant);
  }

  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: devise,
      // XOF/XAF n'ont pas de sous-unité — on laisse Intl choisir le nombre
      // de décimales adapté à la devise (0 pour XOF, 2 pour EUR, etc.).
    }).format(montant);
  } catch {
    // Devise inconnue d'Intl (peu probable vu la whitelist) → fallback.
    return `${new Intl.NumberFormat('fr-FR').format(montant)} ${devise}`;
  }
}
