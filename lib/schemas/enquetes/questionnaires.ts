/**
 * Structure déclarative des questionnaires d'enquête (Étape 6b).
 *
 * Cette définition pilote :
 *   - Le rendu des formulaires (composants question-renderer en 6d)
 *   - Le moteur de règles « ALLER À » (sauts conditionnels)
 *   - L'affichage en lecture seule des fiches /enquetes/[id] (6e)
 *   - Les en-têtes de colonnes de l'export Excel (6f)
 *
 * Principe : modifier le questionnaire = modifier ce fichier (+ schémas).
 * Le code de rendu reste inchangé. Permet d'évoluer vers une admin V1.5
 * « éditeur de questionnaires » sans refonte (ticket V1.5 backlog).
 */

import {
  Q_A203_TYPE_FORMATION_VALUES,
  Q_A203_TYPE_FORMATION_LIBELLES,
  Q_A205_DUREE_FORMATION_VALUES,
  Q_A205_DUREE_FORMATION_LIBELLES,
  Q_A206_ACHEVEMENT_VALUES,
  Q_A206_ACHEVEMENT_LIBELLES,
  ECHELLE_SATISFACTION_VALUES,
  ECHELLE_SATISFACTION_LIBELLES,
  ECHELLE_COMPETENCE_VALUES,
  ECHELLE_COMPETENCE_LIBELLES,
  Q_A401_SITUATION_AVANT_VALUES,
  Q_A401_SITUATION_AVANT_LIBELLES,
  Q_A405_NATURE_ACTIVITE_VALUES,
  Q_A405_NATURE_ACTIVITE_LIBELLES,
  Q_A406_DUREE_ACTIVITE_VALUES,
  Q_A406_DUREE_ACTIVITE_LIBELLES,
  Q_A408_EVOLUTION_REVENU_VALUES,
  Q_A408_EVOLUTION_REVENU_LIBELLES,
  Q_A409_PROPORTION_AUGMENTATION_VALUES,
  Q_A409_PROPORTION_AUGMENTATION_LIBELLES,
  Q_B211_TYPE_EMPLOI_VALUES,
  Q_B211_TYPE_EMPLOI_LIBELLES,
} from './nomenclatures';

export type QuestionType =
  | 'oui_non'
  | 'choix_unique'
  | 'echelle'
  | 'texte_court'
  | 'texte_long'
  | 'nombre_entier'
  | 'nombre_decimal'
  | 'annee';

export type Option = { valeur: string; libelle: string };

export type Question = {
  /** Identifiant numérique du questionnaire (ex. 'A201', 'B211'). */
  id: string;
  type: QuestionType;
  libelle: string;
  /** Champ correspondant dans le payload Zod (ex. 'a2.a_participe'). */
  champ_payload: string;
  /** Options pour choix_unique / echelle. */
  options?: ReadonlyArray<Option>;
  /** True = la question doit avoir une réponse pour soumettre. */
  obligatoire?: boolean;
  /** Texte d'aide affiché sous le libellé. */
  aide?: string;
  /**
   * Affiche la question seulement si la condition est satisfaite.
   * Réf. au champ_payload d'une autre question + valeur cible.
   */
  affiche_si?: { champ_payload: string; valeur_egale: string | boolean | number };
};

export type Section = {
  id: string;
  titre: string;
  description?: string;
  questions: ReadonlyArray<Question>;
};

export type Questionnaire = {
  code: 'A' | 'B';
  titre: string;
  /** Indicateurs cibles (ordre = ordre d'affichage dans la fiche). */
  indicateurs: ReadonlyArray<string>;
  introduction: string;
  sections: ReadonlyArray<Section>;
};

// Helpers de conversion nomenclature → options uniformes pour Select / RadioGroup.
const toOptions = <T extends string>(
  values: ReadonlyArray<T>,
  libelles: Record<T, string>,
): ReadonlyArray<Option> => values.map((v) => ({ valeur: v, libelle: libelles[v] }));

// =============================================================================
// QUESTIONNAIRE A — bénéficiaires (35 questions, 4 sections, 6 indicateurs)
// =============================================================================

export const QUESTIONNAIRE_A: Questionnaire = {
  code: 'A',
  titre: 'Questionnaire A — Bénéficiaires (formation et insertion)',
  indicateurs: ['A2', 'A3', 'A4', 'A5', 'F1', 'C5'],
  introduction:
    'Enquête de suivi socio-économique adressée aux jeunes ayant bénéficié d’une formation via un projet OIF. Données strictement confidentielles, traitées de manière anonyme, conformément au secret statistique.',
  sections: [
    {
      id: 'A_PARTICIPATION',
      titre: 'Participation à la formation',
      description: 'Indicateur A2 — taux d’achèvement.',
      questions: [
        {
          id: 'A201',
          type: 'oui_non',
          libelle: 'Avez-vous participé à une formation dans le cadre du projet ?',
          champ_payload: 'a2.a_participe',
          obligatoire: true,
        },
        {
          id: 'A202',
          type: 'nombre_entier',
          libelle: 'Combien de formations avez-vous suivies dans le cadre du projet ?',
          champ_payload: 'a2.nb_formations',
          affiche_si: { champ_payload: 'a2.a_participe', valeur_egale: true },
        },
        {
          id: 'A203',
          type: 'choix_unique',
          libelle: 'Type de formation suivie',
          champ_payload: 'a2.type_formation',
          options: toOptions(Q_A203_TYPE_FORMATION_VALUES, Q_A203_TYPE_FORMATION_LIBELLES),
          affiche_si: { champ_payload: 'a2.a_participe', valeur_egale: true },
        },
        {
          id: 'A204',
          type: 'texte_court',
          libelle: 'Si autre formation, merci de préciser',
          champ_payload: 'a2.type_formation_autre',
          affiche_si: { champ_payload: 'a2.type_formation', valeur_egale: 'AUTRE' },
        },
        {
          id: 'A205',
          type: 'choix_unique',
          libelle: 'Durée totale de la formation suivie',
          champ_payload: 'a2.duree_formation',
          options: toOptions(Q_A205_DUREE_FORMATION_VALUES, Q_A205_DUREE_FORMATION_LIBELLES),
          affiche_si: { champ_payload: 'a2.a_participe', valeur_egale: true },
        },
        {
          id: 'A206',
          type: 'choix_unique',
          libelle: 'Avez-vous terminé la formation ?',
          champ_payload: 'a2.achevement',
          options: toOptions(Q_A206_ACHEVEMENT_VALUES, Q_A206_ACHEVEMENT_LIBELLES),
          affiche_si: { champ_payload: 'a2.a_participe', valeur_egale: true },
        },
        {
          id: 'A207',
          type: 'texte_long',
          libelle: 'Si non, pourquoi ?',
          champ_payload: 'a2.raison_non_achevement',
          affiche_si: { champ_payload: 'a2.achevement', valeur_egale: 'PARTIELLE_70' },
        },
        {
          id: 'A208',
          type: 'oui_non',
          libelle:
            'Avez-vous obtenu une certification ou une attestation à l’issue de la formation ?',
          champ_payload: 'a3.certifie',
          obligatoire: true,
          affiche_si: { champ_payload: 'a2.a_participe', valeur_egale: true },
        },
        {
          id: 'A209',
          type: 'echelle',
          libelle: 'Êtes-vous satisfait de la formation suivie ?',
          champ_payload: 'c5.satisfaction',
          options: toOptions(ECHELLE_SATISFACTION_VALUES, ECHELLE_SATISFACTION_LIBELLES),
          obligatoire: true,
          affiche_si: { champ_payload: 'a2.a_participe', valeur_egale: true },
        },
        {
          id: 'A210',
          type: 'texte_long',
          libelle: 'Si non satisfait, pourquoi ?',
          champ_payload: 'c5.raison_insatisfaction',
          affiche_si: { champ_payload: 'c5.satisfaction', valeur_egale: 'PAS_DU_TOUT' },
        },
      ],
    },
    {
      id: 'A_COMPETENCES',
      titre: 'Gain de compétences',
      description: 'Indicateur A4 — auto-évaluation T0 / T1.',
      questions: [
        {
          id: 'A301',
          type: 'echelle',
          libelle: 'Avant la formation, comment évalueriez-vous votre niveau de compétence ?',
          champ_payload: 'a4.niveau_avant',
          options: toOptions(ECHELLE_COMPETENCE_VALUES, ECHELLE_COMPETENCE_LIBELLES),
          obligatoire: true,
        },
        {
          id: 'A302',
          type: 'echelle',
          libelle: 'Aujourd’hui, comment évaluez-vous votre niveau de compétence ?',
          champ_payload: 'a4.niveau_apres',
          options: toOptions(ECHELLE_COMPETENCE_VALUES, ECHELLE_COMPETENCE_LIBELLES),
          obligatoire: true,
        },
        {
          id: 'A303',
          type: 'texte_long',
          libelle: 'Quelles compétences avez-vous acquises ?',
          champ_payload: 'a4.competences_acquises',
        },
      ],
    },
    {
      id: 'A_INSERTION',
      titre: 'Insertion professionnelle',
      description: 'Indicateurs A5 (insertion) et F1 (apport du français).',
      questions: [
        {
          id: 'A401',
          type: 'choix_unique',
          libelle: 'Quelle était votre situation avant la formation ?',
          champ_payload: 'a5.situation_avant',
          options: toOptions(Q_A401_SITUATION_AVANT_VALUES, Q_A401_SITUATION_AVANT_LIBELLES),
          obligatoire: true,
        },
        {
          id: 'A402',
          type: 'texte_court',
          libelle: 'Si autre, précisez votre situation',
          champ_payload: 'a5.situation_avant_autre',
          affiche_si: { champ_payload: 'a5.situation_avant', valeur_egale: 'AUTRE' },
        },
        {
          id: 'A403',
          type: 'oui_non',
          libelle:
            'La formation et/ou l’accompagnement vous ont-ils permis d’accéder à une activité professionnelle ?',
          champ_payload: 'a5.a_accede',
          obligatoire: true,
        },
        {
          id: 'A404',
          type: 'annee',
          libelle: 'En quelle année avez-vous accédé à une activité professionnelle ?',
          champ_payload: 'a5.annee_acces',
          affiche_si: { champ_payload: 'a5.a_accede', valeur_egale: true },
        },
        {
          id: 'A405',
          type: 'choix_unique',
          libelle:
            'Quelle est la nature de l’activité professionnelle que vous avez trouvée à la suite de la formation ou de l’appui ?',
          champ_payload: 'a5.nature_activite',
          options: toOptions(Q_A405_NATURE_ACTIVITE_VALUES, Q_A405_NATURE_ACTIVITE_LIBELLES),
          affiche_si: { champ_payload: 'a5.a_accede', valeur_egale: true },
        },
        {
          id: 'A406',
          type: 'choix_unique',
          libelle: 'Quelle est la durée de l’activité professionnelle que vous avez trouvée ?',
          champ_payload: 'a5.duree_activite',
          options: toOptions(Q_A406_DUREE_ACTIVITE_VALUES, Q_A406_DUREE_ACTIVITE_LIBELLES),
          affiche_si: { champ_payload: 'a5.a_accede', valeur_egale: true },
        },
        {
          id: 'A407',
          type: 'oui_non',
          libelle:
            'Pensez-vous que votre usage du français a facilité l’accès ou l’amélioration de l’emploi ?',
          champ_payload: 'f1.francais_facilite_emploi',
          obligatoire: true,
          aide: 'Indicateur F1 — apport du français à l’employabilité.',
        },
        {
          id: 'A408',
          type: 'choix_unique',
          libelle: 'Depuis la formation, votre revenu a-t-il évolué ?',
          champ_payload: 'a5.evolution_revenu',
          options: toOptions(Q_A408_EVOLUTION_REVENU_VALUES, Q_A408_EVOLUTION_REVENU_LIBELLES),
        },
        {
          id: 'A409',
          type: 'choix_unique',
          libelle: 'Si votre revenu a augmenté, quelle est la proportion ?',
          champ_payload: 'a5.proportion_augmentation',
          options: toOptions(
            Q_A409_PROPORTION_AUGMENTATION_VALUES,
            Q_A409_PROPORTION_AUGMENTATION_LIBELLES,
          ),
          affiche_si: { champ_payload: 'a5.evolution_revenu', valeur_egale: 'AUGMENTE' },
        },
        {
          id: 'A410',
          type: 'texte_long',
          libelle: 'Quels sont les principaux effets et impacts constatés à la suite de l’appui ?',
          champ_payload: 'effets_impacts',
        },
        {
          id: 'A411',
          type: 'texte_long',
          libelle: 'Avez-vous des observations ou suggestions ?',
          champ_payload: 'observations_libres',
        },
        {
          id: 'A412',
          type: 'texte_long',
          libelle: 'Avez-vous un témoignage à partager ?',
          champ_payload: 'temoignage',
        },
      ],
    },
  ],
};

// =============================================================================
// QUESTIONNAIRE B — structures (22 questions, 3 sections, 4 indicateurs)
// =============================================================================

export const QUESTIONNAIRE_B: Questionnaire = {
  code: 'B',
  titre: 'Questionnaire B — Structures (survie et emplois)',
  indicateurs: ['B2', 'B3', 'B4', 'C5'],
  introduction:
    'Enquête de suivi socio-économique adressée aux organisations et entreprises ayant bénéficié d’un appui via un projet OIF. Données strictement confidentielles, traitées conformément au secret statistique.',
  sections: [
    {
      id: 'B_SURVIE',
      titre: 'Survie de l’activité économique',
      description: 'Indicateur B2 — survie 12/24 mois + amorce B3.',
      questions: [
        {
          id: 'B201',
          type: 'oui_non',
          libelle: 'Votre structure dispose-t-elle d’une activité économique ?',
          champ_payload: 'b2.a_activite_economique',
          obligatoire: true,
        },
        {
          id: 'B202',
          type: 'annee',
          libelle: 'Si oui, quelle est l’année de création de cette activité ?',
          champ_payload: 'b2.annee_creation_activite',
          affiche_si: { champ_payload: 'b2.a_activite_economique', valeur_egale: true },
        },
        {
          id: 'B203',
          type: 'oui_non',
          libelle:
            'L’appui de l’OIF a-t-il permis de créer ou renforcer cette activité économique ?',
          champ_payload: 'b2.oif_a_permis',
          affiche_si: { champ_payload: 'b2.a_activite_economique', valeur_egale: true },
        },
        {
          id: 'B204',
          type: 'oui_non',
          libelle: 'L’activité mise en place ou renforcée est-elle toujours active aujourd’hui ?',
          champ_payload: 'b2.toujours_active',
          affiche_si: { champ_payload: 'b2.a_activite_economique', valeur_egale: true },
        },
        {
          id: 'B205',
          type: 'nombre_decimal',
          libelle: 'Si oui, quel est votre chiffre d’affaires annuel ?',
          champ_payload: 'b2.ca_annuel',
          affiche_si: { champ_payload: 'b2.toujours_active', valeur_egale: true },
        },
        {
          id: 'B206',
          type: 'annee',
          libelle: 'Si non, en quelle année avez-vous arrêté cette activité ?',
          champ_payload: 'b2.annee_arret',
          affiche_si: { champ_payload: 'b2.toujours_active', valeur_egale: false },
        },
        {
          id: 'B207',
          type: 'texte_long',
          libelle: 'Quelle est la principale raison de l’arrêt ?',
          champ_payload: 'b2.raison_arret',
          affiche_si: { champ_payload: 'b2.toujours_active', valeur_egale: false },
        },
        {
          id: 'B208',
          type: 'nombre_entier',
          libelle:
            'Combien de personnes étaient rémunérées sur cette activité économique avant l’appui de l’OIF ?',
          champ_payload: 'b3.remuneres_avant',
          affiche_si: { champ_payload: 'b2.a_activite_economique', valeur_egale: true },
        },
        {
          id: 'B209',
          type: 'nombre_entier',
          libelle: 'Combien de personnes sont maintenues sur cette activité après l’appui ?',
          champ_payload: 'b3.maintenus_apres',
          affiche_si: { champ_payload: 'b2.a_activite_economique', valeur_egale: true },
        },
        {
          id: 'B210',
          type: 'nombre_entier',
          libelle:
            'Combien de nouvelles personnes sont rémunérées sur cette activité après l’appui ?',
          champ_payload: 'b3.nouveaux_apres',
          affiche_si: { champ_payload: 'b2.a_activite_economique', valeur_egale: true },
        },
        {
          id: 'B211',
          type: 'choix_unique',
          libelle: 'Quel est le type d’emploi créé ou renforcé grâce à l’appui de l’OIF ?',
          champ_payload: 'b3.type_emploi',
          options: toOptions(Q_B211_TYPE_EMPLOI_VALUES, Q_B211_TYPE_EMPLOI_LIBELLES),
          affiche_si: { champ_payload: 'b2.a_activite_economique', valeur_egale: true },
        },
        {
          id: 'B212',
          type: 'nombre_entier',
          libelle: 'Quel est le nombre de jeunes (18 à 34 ans) rémunérés sur l’activité ?',
          champ_payload: 'b3.jeunes_remuneres',
          affiche_si: { champ_payload: 'b2.a_activite_economique', valeur_egale: true },
        },
        {
          id: 'B213',
          type: 'nombre_entier',
          libelle: 'Quel est le nombre de femmes rémunérées sur l’activité ?',
          champ_payload: 'b3.femmes_remunerees',
          affiche_si: { champ_payload: 'b2.a_activite_economique', valeur_egale: true },
        },
      ],
    },
    {
      id: 'B_INDIRECTS',
      titre: 'Emplois indirects',
      description: 'Indicateur B4.',
      questions: [
        {
          id: 'B301',
          type: 'oui_non',
          libelle: 'L’appui a-t-il généré des emplois indirects ?',
          champ_payload: 'b4.a_genere_indirects',
          obligatoire: true,
        },
        {
          id: 'B302',
          type: 'nombre_entier',
          libelle: 'Si oui, estimez le nombre d’emplois indirects générés.',
          champ_payload: 'b4.nombre_indirects',
          affiche_si: { champ_payload: 'b4.a_genere_indirects', valeur_egale: true },
        },
        {
          id: 'B303',
          type: 'texte_long',
          libelle: 'Quels sont les principaux effets / impacts de l’appui ?',
          champ_payload: 'effets_impacts',
        },
        {
          id: 'B304',
          type: 'echelle',
          libelle: 'Êtes-vous satisfait de l’appui de l’OIF ?',
          champ_payload: 'c5.satisfaction',
          options: toOptions(ECHELLE_SATISFACTION_VALUES, ECHELLE_SATISFACTION_LIBELLES),
          obligatoire: true,
        },
        {
          id: 'B305',
          type: 'texte_long',
          libelle: 'Avez-vous des observations ou suggestions ?',
          champ_payload: 'observations_libres',
        },
        {
          id: 'B306',
          type: 'texte_long',
          libelle: 'Avez-vous un témoignage à partager ?',
          champ_payload: 'temoignage',
        },
      ],
    },
  ],
};

/** Accès indexé par code pour rendu dynamique. */
export const QUESTIONNAIRES: Record<'A' | 'B', Questionnaire> = {
  A: QUESTIONNAIRE_A,
  B: QUESTIONNAIRE_B,
};
