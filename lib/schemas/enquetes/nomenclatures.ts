/**
 * Nomenclatures des questionnaires d'enquête (Étape 6).
 *
 * Codes dérivés des questionnaires officiels OIF V2 (extractions docx
 * archivées dans `docs/specifications/questionnaires/`). Chaque énumération
 * correspond à une question fermée du questionnaire A ou B.
 *
 * Convention de nommage :
 *   - `Q_<NUM>_<INDICATEUR>_VALUES` : tuple littéral des valeurs autorisées
 *   - `Q_<NUM>_LIBELLES` : Record code → libellé long francophone
 *   - `Q_<NUM>_OPTIONS` : tableau d'objets {valeur, libelle} pour Select/Radio
 *
 * NB : les questionnaires source contiennent quelques typos de codification
 *      (Q A203 a deux valeurs « 4 », Q A408 saute le code « 2 »). Les
 *      nomenclatures ci-dessous corrigent ces incohérences ET conservent
 *      la traçabilité dans les commentaires inline.
 */

// =============================================================================
// QUESTIONNAIRE A — bénéficiaires (35 questions, 4 sections)
// =============================================================================

// --- Section II : Participation à la formation ---

/** Q A203 — Type de formation suivie (5 valeurs ; doublon code 4 corrigé). */
export const Q_A203_TYPE_FORMATION_VALUES = [
  'FP_TECH', // 1 = Formation technique et professionnelle
  'TOURISME', // 2 = Métiers du tourisme durable
  'NUM', // 3 = Métiers du numérique
  'ENV_CLIMAT', // 4a = Enjeux environnement et climat
  'FRANCAIS_PAIX', // 4b = Français dans opérations maintien de paix (corrigé : doublon code 4 dans source)
  'AUTRE', // 5 = Autre
] as const;
export type Q_A203_TypeFormation = (typeof Q_A203_TYPE_FORMATION_VALUES)[number];

export const Q_A203_TYPE_FORMATION_LIBELLES: Record<Q_A203_TypeFormation, string> = {
  FP_TECH: 'Formation technique et professionnelle (couture, coiffure, agriculture, etc.)',
  TOURISME: 'Formation aux métiers du tourisme durable',
  NUM: 'Formation aux métiers du numérique',
  ENV_CLIMAT: 'Formation sur les enjeux environnement et climat',
  FRANCAIS_PAIX: 'Formation en et au français (opérations de maintien de la paix)',
  AUTRE: 'Autre',
};

/** Q A205 — Durée totale de la formation. */
export const Q_A205_DUREE_FORMATION_VALUES = [
  'MOINS_1_MOIS',
  'DE_1_A_3_MOIS',
  'DE_3_A_6_MOIS',
  'PLUS_6_MOIS',
] as const;
export type Q_A205_DureeFormation = (typeof Q_A205_DUREE_FORMATION_VALUES)[number];

export const Q_A205_DUREE_FORMATION_LIBELLES: Record<Q_A205_DureeFormation, string> = {
  MOINS_1_MOIS: 'Moins de 1 mois',
  DE_1_A_3_MOIS: 'De 1 à 3 mois',
  DE_3_A_6_MOIS: 'De 3 à 6 mois',
  PLUS_6_MOIS: 'Plus de 6 mois',
};

/** Q A206 — Achèvement de la formation (indicateur A2). */
export const Q_A206_ACHEVEMENT_VALUES = [
  'ACHEVEE_100',
  'PARTIELLE_70',
  'ABANDON_MOINS_70',
] as const;
export type Q_A206_Achevement = (typeof Q_A206_ACHEVEMENT_VALUES)[number];

export const Q_A206_ACHEVEMENT_LIBELLES: Record<Q_A206_Achevement, string> = {
  ACHEVEE_100: 'Oui, 100 % terminée',
  PARTIELLE_70: 'Non, 70 % terminée',
  ABANDON_MOINS_70: 'Non, moins de 70 % terminée',
};

/** Q A209 / Q B304 — Échelle de satisfaction (4 paliers, partagée A/B → C5). */
export const ECHELLE_SATISFACTION_VALUES = [
  'PAS_DU_TOUT',
  'MOYENNEMENT',
  'SATISFAIT',
  'TRES_SATISFAIT',
] as const;
export type EchelleSatisfaction = (typeof ECHELLE_SATISFACTION_VALUES)[number];

export const ECHELLE_SATISFACTION_LIBELLES: Record<EchelleSatisfaction, string> = {
  PAS_DU_TOUT: 'Pas du tout satisfait',
  MOYENNEMENT: 'Moyennement satisfait',
  SATISFAIT: 'Satisfait',
  TRES_SATISFAIT: 'Très satisfait',
};

// --- Section III : Gain de compétences ---

/** Q A301 / Q A302 — Échelle de niveau de compétence (5 paliers). */
export const ECHELLE_COMPETENCE_VALUES = ['AUCUNE', 'FAIBLE', 'MOYEN', 'BON', 'TRES_BON'] as const;
export type EchelleCompetence = (typeof ECHELLE_COMPETENCE_VALUES)[number];

export const ECHELLE_COMPETENCE_LIBELLES: Record<EchelleCompetence, string> = {
  AUCUNE: 'Aucune compétence',
  FAIBLE: 'Faible',
  MOYEN: 'Moyen',
  BON: 'Bon',
  TRES_BON: 'Très bon',
};

// --- Section IV : Insertion professionnelle ---

/** Q A401 — Situation professionnelle avant la formation. */
export const Q_A401_SITUATION_AVANT_VALUES = [
  'SANS_EMPLOI',
  'ETUDIANT',
  'EMPLOYE',
  'INDEPENDANT',
  'PROMOTEUR_AGR',
  'AUTRE',
] as const;
export type Q_A401_SituationAvant = (typeof Q_A401_SITUATION_AVANT_VALUES)[number];

export const Q_A401_SITUATION_AVANT_LIBELLES: Record<Q_A401_SituationAvant, string> = {
  SANS_EMPLOI: 'Sans emploi ou aucune activité',
  ETUDIANT: 'Étudiant ou en formation',
  EMPLOYE: 'Employé(e) dans une structure',
  INDEPENDANT: 'Travailleur(se) indépendant(e)',
  PROMOTEUR_AGR: 'Promoteur(trice) d’une AGR',
  AUTRE: 'Autre',
};

/** Q A405 — Nature de l'activité professionnelle accédée après formation. */
export const Q_A405_NATURE_ACTIVITE_VALUES = [
  'MISSION_PONCTUELLE',
  'STAGE',
  'INDEPENDANT',
  'EMPLOI_DURABLE',
  'CREATION_RENFORCEMENT',
  'AUTRE',
] as const;
export type Q_A405_NatureActivite = (typeof Q_A405_NATURE_ACTIVITE_VALUES)[number];

export const Q_A405_NATURE_ACTIVITE_LIBELLES: Record<Q_A405_NatureActivite, string> = {
  MISSION_PONCTUELLE: 'Mission ponctuelle / activité occasionnelle',
  STAGE: 'Stage',
  INDEPENDANT: 'Activité indépendante',
  EMPLOI_DURABLE: 'Emploi durable',
  CREATION_RENFORCEMENT: 'Renforcement ou création d’entreprise',
  AUTRE: 'Autre',
};

/** Q A406 — Durée de l'activité professionnelle (mois). */
export const Q_A406_DUREE_ACTIVITE_VALUES = [
  'MOINS_6_MOIS',
  'DE_6_A_12_MOIS',
  'PLUS_12_MOIS',
] as const;
export type Q_A406_DureeActivite = (typeof Q_A406_DUREE_ACTIVITE_VALUES)[number];

export const Q_A406_DUREE_ACTIVITE_LIBELLES: Record<Q_A406_DureeActivite, string> = {
  MOINS_6_MOIS: 'Moins de 6 mois',
  DE_6_A_12_MOIS: 'Entre 6 et 12 mois',
  PLUS_12_MOIS: 'Plus de 12 mois',
};

/**
 * Q A408 — Évolution du revenu depuis la formation (3 valeurs).
 * Note : la source docx code 1/3/4 (saute 2). On normalise en
 * AUGMENTE/STABLE/DIMINUE pour cohérence sémantique.
 */
export const Q_A408_EVOLUTION_REVENU_VALUES = ['AUGMENTE', 'STABLE', 'DIMINUE'] as const;
export type Q_A408_EvolutionRevenu = (typeof Q_A408_EVOLUTION_REVENU_VALUES)[number];

export const Q_A408_EVOLUTION_REVENU_LIBELLES: Record<Q_A408_EvolutionRevenu, string> = {
  AUGMENTE: 'Mon revenu a augmenté',
  STABLE: 'Mon revenu est stable',
  DIMINUE: 'Mon revenu a diminué',
};

/** Q A409 — Proportion d'augmentation du revenu (si AUGMENTE). */
export const Q_A409_PROPORTION_AUGMENTATION_VALUES = [
  'CENT_POURCENT',
  'ENTRE_50_ET_100',
  'MOINS_50',
] as const;
export type Q_A409_ProportionAugmentation = (typeof Q_A409_PROPORTION_AUGMENTATION_VALUES)[number];

export const Q_A409_PROPORTION_AUGMENTATION_LIBELLES: Record<
  Q_A409_ProportionAugmentation,
  string
> = {
  CENT_POURCENT: '100 %',
  ENTRE_50_ET_100: 'Entre 50 % et 100 %',
  MOINS_50: 'Moins de 50 %',
};

// =============================================================================
// QUESTIONNAIRE B — structures (22 questions, 3 sections)
// =============================================================================

/** Q B211 — Type d'emploi créé ou renforcé grâce à l'appui (indicateur B3). */
export const Q_B211_TYPE_EMPLOI_VALUES = [
  'MISSION_PONCTUELLE',
  'STAGE',
  'EMPLOI_DURABLE',
  'AUTRE',
] as const;
export type Q_B211_TypeEmploi = (typeof Q_B211_TYPE_EMPLOI_VALUES)[number];

export const Q_B211_TYPE_EMPLOI_LIBELLES: Record<Q_B211_TypeEmploi, string> = {
  MISSION_PONCTUELLE: 'Mission ponctuelle / activité occasionnelle',
  STAGE: 'Stage',
  EMPLOI_DURABLE: 'Emploi durable',
  AUTRE: 'Autre',
};

// =============================================================================
// Méta : indicateurs cibles couverts par chaque questionnaire
// =============================================================================

/**
 * Liste des indicateurs (codes seedés dans `public.indicateurs`) couverts
 * par chaque questionnaire. Utilisé en 6e pour générer les N lignes
 * `reponses_enquetes` à l'INSERT atomique.
 */
export const INDICATEURS_PAR_QUESTIONNAIRE = {
  A: ['A2', 'A3', 'A4', 'A5', 'F1', 'C5'] as const,
  B: ['B2', 'B3', 'B4', 'C5'] as const,
} as const;

export type CodeQuestionnaire = keyof typeof INDICATEURS_PAR_QUESTIONNAIRE;
export type IndicateurCible =
  | (typeof INDICATEURS_PAR_QUESTIONNAIRE)['A'][number]
  | (typeof INDICATEURS_PAR_QUESTIONNAIRE)['B'][number];

/** Libellés humains des questionnaires (UI). */
export const QUESTIONNAIRE_LIBELLES: Record<CodeQuestionnaire, string> = {
  A: 'Questionnaire A — Bénéficiaires (formation et insertion)',
  B: 'Questionnaire B — Structures (survie et emplois)',
};

// =============================================================================
// Vagues d'enquête (alignées sur l'enum `public.vague_enquete`)
// =============================================================================

export const VAGUES_ENQUETE_VALUES = [
  '6_mois',
  '12_mois',
  '24_mois',
  'ponctuelle',
  'avant_formation',
  'fin_formation',
] as const;
export type VagueEnquete = (typeof VAGUES_ENQUETE_VALUES)[number];

export const VAGUE_ENQUETE_LIBELLES: Record<VagueEnquete, string> = {
  '6_mois': 'Suivi à 6 mois',
  '12_mois': 'Suivi à 12 mois',
  '24_mois': 'Suivi à 24 mois',
  ponctuelle: 'Ponctuelle',
  avant_formation: 'Avant formation (T0)',
  fin_formation: 'Fin de formation (T1)',
};

// =============================================================================
// Canaux de collecte (alignés sur l'enum `public.canal_collecte`)
// =============================================================================

export const CANAUX_COLLECTE_VALUES = [
  'formulaire_web',
  'entretien',
  'telephone',
  'import',
  'email',
  'sms',
  'whatsapp',
] as const;
export type CanalCollecte = (typeof CANAUX_COLLECTE_VALUES)[number];

export const CANAL_COLLECTE_LIBELLES: Record<CanalCollecte, string> = {
  formulaire_web: 'Formulaire web (saisie en ligne)',
  entretien: 'Entretien en présentiel',
  telephone: 'Appel téléphonique',
  import: 'Import Excel batch',
  email: 'Réponses transmises par e-mail',
  sms: 'Réponses transmises par SMS',
  whatsapp: 'Réponses transmises par WhatsApp',
};
