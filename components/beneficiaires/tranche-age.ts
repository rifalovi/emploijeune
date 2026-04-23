/**
 * Calcul de la tranche d'âge d'un bénéficiaire.
 *
 * Tranches d'âge alignées sur le Questionnaire officiel OIF
 * Indicateurs A (V2), question 105.
 * Source : docs/specifications/questionnaires/Questionnaire EmploiJeunes_ Indicateurs A_V2.docx
 *
 * Tranches officielles OIF :
 *   - 18-34 ans (jeunes selon définition OIF/ONU)
 *   - 35-60 ans (adultes)
 *   - +60 ans (seniors)
 *
 * Ajouts plateforme V1 pour traçabilité :
 *   - « Mineur (<18) » : cas rare mais possible, signale une anomalie de saisie
 *     (la cible opérationnelle OIF est 15-29 / élargi 15-35 — cf. note méthodo),
 *     ce libellé attire l'attention sur les lignes atypiques
 *   - « Non renseigné » : date_naissance nulle ou invalide
 *
 * Fonction pure : testable sans mock, déterministe pour une paire
 * (naissance, référence). La date de référence est injectable pour les tests.
 */

export const TRANCHES_AGE = [
  'Mineur (<18)',
  '18-34 ans',
  '35-60 ans',
  '+60 ans',
  'Non renseigné',
] as const;

export type TrancheAge = (typeof TRANCHES_AGE)[number];

/**
 * Retourne la tranche d'âge calculée à partir de `dateNaissance` et
 * `dateReference` (défaut : aujourd'hui). Si `dateNaissance` est null,
 * undefined, ou invalide, renvoie « Non renseigné ».
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

  if (age < 18) return 'Mineur (<18)';
  if (age <= 34) return '18-34 ans';
  if (age <= 60) return '35-60 ans';
  return '+60 ans';
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
