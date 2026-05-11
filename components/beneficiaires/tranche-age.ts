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

/** Valeurs admises pour la tranche déclarée dans la base OIF. */
export type TrancheAgeDeclaree = 'Jeune' | 'Adulte';

/**
 * Convertit la tranche déclarée OIF (« Jeune » / « Adulte ») en libellé
 * affiché sur la plateforme, aligné sur les tranches officielles du
 * Questionnaire A V2 (question 105).
 *
 * Mapping :
 *   « Jeune »  (18-34 ans) → '18-34 ans'
 *   « Adulte » (35 ans et +) → '35-60 ans'  ← convention : on ne peut pas
 *     distinguer 35-60 et +60 depuis la base OIF (catégorie trop large).
 *     Un badge visuel "(déclaré)" est recommandé côté UI pour signaler
 *     l'absence de date de naissance.
 */
export function trancheAgeDepuisDeclaree(
  declaree: TrancheAgeDeclaree | string | null | undefined,
): TrancheAge | null {
  if (!declaree) return null;
  const v = declaree.trim().toLowerCase();
  if (v === 'jeune') return '18-34 ans';
  if (v === 'adulte') return '35-60 ans';
  return null;
}

/**
 * Retourne la tranche d'âge à afficher pour un bénéficiaire.
 *
 * Priorité :
 *   1. Calcul précis depuis `dateNaissance` si disponible
 *   2. Conversion depuis `trancheAgeDeclaree` (import OIF) si date_naissance NULL
 *   3. « Non renseigné » si aucune des deux n'est disponible
 *
 * L'âge est calculé au jour le jour : si l'anniversaire n'a pas encore eu
 * lieu dans l'année de référence, l'âge retenu est (année_ref - année_naiss - 1).
 */
export function calculerTrancheAge(
  dateNaissance: Date | string | null | undefined,
  dateReference: Date = new Date(),
  trancheDeclaree?: string | null,
): TrancheAge {
  // 1. Calcul depuis date_naissance (cas saisie manuelle ou questionnaire)
  if (dateNaissance) {
    const naissance = dateNaissance instanceof Date ? dateNaissance : new Date(dateNaissance);
    if (!isNaN(naissance.getTime())) {
      const age = calculerAge(naissance, dateReference);
      if (age < 18) return 'Mineur (<18)';
      if (age <= 34) return '18-34 ans';
      if (age <= 60) return '35-60 ans';
      return '+60 ans';
    }
  }

  // 2. Fallback sur la tranche déclarée dans la base OIF (import Excel)
  const depuisDeclaree = trancheAgeDepuisDeclaree(trancheDeclaree ?? null);
  if (depuisDeclaree) return depuisDeclaree;

  // 3. Aucune information disponible
  return 'Non renseigné';
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
