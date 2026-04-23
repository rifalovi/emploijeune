/**
 * Calcul de la tranche d'âge d'un bénéficiaire à partir de sa date de naissance
 * et d'une date de référence (par défaut, aujourd'hui).
 *
 * Les tranches utilisées sont celles de la Note méthodologique V2 de l'OIF :
 *   - « 15-17 ans (mineur) »
 *   - « 18-29 ans (cœur de cible) »
 *   - « 30-35 ans (institutionnel élargi) »
 *   - « Hors cible » (< 15 ou > 35)
 *
 * Référence : docs/references/Note méthodologique V2.docx — § 2 Portée du cadre.
 *
 * Fonction pure : testable sans mock, déterministe pour une paire (naissance,
 * référence). La date de référence est injectable pour les tests.
 */

export type TrancheAge =
  | '15-17 ans (mineur)'
  | '18-29 ans (cœur de cible)'
  | '30-35 ans (institutionnel élargi)'
  | 'Hors cible'
  | 'Non renseigné';

/**
 * Retourne la tranche d'âge calculée à partir de `dateNaissance` et
 * `dateReference` (défaut : aujourd'hui). Si `dateNaissance` est null ou
 * undefined, renvoie « Non renseigné ».
 *
 * L'âge est calculé au jour le jour : si l'anniversaire n'a pas encore eu
 * lieu dans l'année de référence, l'âge retenu est (année_ref - année_naiss - 1).
 */
export function calculerTrancheAge(
  dateNaissance: Date | string | null | undefined,
  dateReference: Date = new Date(),
): TrancheAge {
  if (!dateNaissance) return 'Non renseigné';

  const naissance = dateNaissance instanceof Date ? dateNaissance : new Date(dateNaissance);
  if (isNaN(naissance.getTime())) return 'Non renseigné';

  const age = calculerAge(naissance, dateReference);

  if (age < 15) return 'Hors cible';
  if (age <= 17) return '15-17 ans (mineur)';
  if (age <= 29) return '18-29 ans (cœur de cible)';
  if (age <= 35) return '30-35 ans (institutionnel élargi)';
  return 'Hors cible';
}

/**
 * Âge en années entières à une date de référence.
 * Gère le cas où l'anniversaire n'a pas encore eu lieu dans l'année de
 * référence (on retranche 1 an).
 */
export function calculerAge(naissance: Date, dateReference: Date = new Date()): number {
  let age = dateReference.getFullYear() - naissance.getFullYear();
  const mois = dateReference.getMonth() - naissance.getMonth();
  if (mois < 0 || (mois === 0 && dateReference.getDate() < naissance.getDate())) {
    age -= 1;
  }
  return age;
}
