/**
 * Nomenclatures closed — constantes TypeScript dérivées du seed SQL
 * (`supabase/seed.sql`) + migration 001 (`20260422000001_initial_schema.sql`).
 *
 * Ces arrays `as const` sont la source de vérité côté client pour la
 * validation Zod (enums) et l'alimentation des dropdowns des filtres.
 *
 * Règle de cohérence : toute modification d'une nomenclature côté BDD doit
 * être répercutée ici (les fonctions `supabase.from('domaines_formation')`
 * côté Server Component lisent les libellés complets pour l'affichage,
 * mais les codes restent validés par Zod via ces constantes).
 */

// =============================================================================
// Projets officiels OIF (source : 00_NOMENCLATURE_PROJETS_OIF.md)
// =============================================================================

export const PROJETS_CODES = [
  'PROJ_A01a',
  'PROJ_A01b',
  'PROJ_A01c',
  'PROJ_A02',
  'PROJ_A03',
  'PROJ_A04',
  'PROJ_A05',
  'PROJ_A06',
  'PROJ_A07',
  'PROJ_A08',
  'PROJ_A09',
  'PROJ_A10',
  'PROJ_A11',
  'PROJ_A12',
  'PROJ_A13',
  'PROJ_A14',
  'PROJ_A15',
  'PROJ_A16a',
  'PROJ_A16b',
  'PROJ_A17',
  'PROJ_A18',
  'PROJ_A19',
  'PROJ_A20',
] as const;

export const PROJETS_EMPLOI_JEUNES_CODES = [
  'PROJ_A14',
  'PROJ_A15',
  'PROJ_A16a',
  'PROJ_A16b',
  'PROJ_A17',
  'PROJ_A18',
  'PROJ_A19',
  'PROJ_A20',
] as const;

export type ProjetCode = (typeof PROJETS_CODES)[number];
export type ProjetEmploiJeunesCode = (typeof PROJETS_EMPLOI_JEUNES_CODES)[number];

// =============================================================================
// Programmes Stratégiques (3 valeurs)
// =============================================================================

export const PROGRAMMES_STRATEGIQUES_CODES = ['PS1', 'PS2', 'PS3'] as const;
export type ProgrammeStrategiqueCode = (typeof PROGRAMMES_STRATEGIQUES_CODES)[number];

// =============================================================================
// Pays ISO-3 (61 valeurs — feuille 5 du template V1)
// =============================================================================

export const PAYS_CODES = [
  'ALB',
  'AND',
  'ARG',
  'ARM',
  'BRB',
  'BEL',
  'BEN',
  'BRA',
  'BGR',
  'BFA',
  'BDI',
  'CPV',
  'KHM',
  'CMR',
  'CAN',
  'CAF',
  'COM',
  'COG',
  'COD',
  'CIV',
  'DJI',
  'DOM',
  'EGY',
  'FRA',
  'GAB',
  'GHA',
  'GRC',
  'GIN',
  'GNB',
  'GNQ',
  'HTI',
  'ITA',
  'KEN',
  'LAO',
  'LBN',
  'LUX',
  'MKD',
  'MDG',
  'MLI',
  'MLT',
  'MAR',
  'MUS',
  'MRT',
  'MDA',
  'MCO',
  'NER',
  'ROU',
  'RWA',
  'LCA',
  'STP',
  'SEN',
  'SRB',
  'SYC',
  'CHE',
  'TCD',
  'TGO',
  'TUN',
  'UKR',
  'VUT',
  'VNM',
  'USA',
] as const;
export type PaysCode = (typeof PAYS_CODES)[number];

// =============================================================================
// Sexe (3 valeurs — enum PG public.sexe)
// =============================================================================

export const SEXE_VALUES = ['F', 'M', 'Autre'] as const;
export type Sexe = (typeof SEXE_VALUES)[number];

// =============================================================================
// Domaines de formation (16 valeurs, après correction migration 003)
// =============================================================================

export const DOMAINES_FORMATION_CODES = [
  'AGR_ELV_PCH',
  'AGROALIM',
  'ARTISANAT',
  'COMMERCE',
  'DEV_PERS',
  'ENTREPR_GEST',
  'ENV_ECO_VERTE',
  'FP_TECH',
  'GEST_FIN_COMPTA',
  'LANGUES_COM',
  'NUM_INFO',
  'SANTE_SERV_PERS',
  'SERV_FIN_INCLUSION',
  'TOURISME',
  'TRANSPORT',
  'AUTRE',
] as const;
export type DomaineFormationCode = (typeof DOMAINES_FORMATION_CODES)[number];

// =============================================================================
// Modalités de formation (3 valeurs)
// =============================================================================

export const MODALITES_FORMATION_CODES = ['PRESENTIEL', 'EN_LIGNE', 'HYBRIDE'] as const;
export type ModaliteFormationCode = (typeof MODALITES_FORMATION_CODES)[number];

// =============================================================================
// Statuts bénéficiaire (5 valeurs)
// =============================================================================

export const STATUTS_BENEFICIAIRE_CODES = [
  'INSCRIT',
  'PRESENT_EFFECTIF',
  'FORMATION_ACHEVEE',
  'ABANDON',
  'NON_PRECISE',
] as const;
export type StatutBeneficiaireCode = (typeof STATUTS_BENEFICIAIRE_CODES)[number];

// =============================================================================
// Secteurs d'activité (17 valeurs) — utiles pour structures B1 (Étape 5)
// =============================================================================

export const SECTEURS_ACTIVITE_CODES = [
  'AGR_SYL_PCH',
  'AGROALIM',
  'ARTISANAT',
  'COMMERCE',
  'BTP',
  'CULTURE',
  'EDUC',
  'ENERGIE_ENV',
  'TOURISME',
  'INDUSTRIE',
  'SANTE_SOCIAL',
  'SERV_ENTR',
  'SERV_FIN',
  'SPORT_LOISIRS',
  'TIC',
  'TRANSPORT',
  'AUTRE',
] as const;
export type SecteurActiviteCode = (typeof SECTEURS_ACTIVITE_CODES)[number];

// =============================================================================
// Types de structure (7 valeurs) — utiles pour B1
// =============================================================================

export const TYPES_STRUCTURE_CODES = [
  'AGR',
  'MICRO_ENTR',
  'PETITE_ENTR',
  'COOP',
  'ASSOC',
  'GIE',
  'AUTRE',
] as const;
export type TypeStructureCode = (typeof TYPES_STRUCTURE_CODES)[number];

// =============================================================================
// Natures d'appui (7 valeurs) — utiles pour B1
// =============================================================================

export const NATURES_APPUI_CODES = [
  'SUBVENTION',
  'MATERIEL',
  'FORMATION',
  'MENTORAT',
  'MISE_RELATION',
  'APPUI_MIXTE',
  'AUTRE',
] as const;
export type NatureAppuiCode = (typeof NATURES_APPUI_CODES)[number];

// =============================================================================
// Devises (15 valeurs) — utiles pour B1
// =============================================================================

export const DEVISES_CODES = [
  'EUR',
  'USD',
  'XOF',
  'XAF',
  'MAD',
  'DZD',
  'TND',
  'MGA',
  'MRU',
  'CDF',
  'RWF',
  'DJF',
  'LBP',
  'HTG',
  'Autre',
] as const;
export type DeviseCode = (typeof DEVISES_CODES)[number];

// =============================================================================
// Statut de structure (enum PG public.statut_structure) — utile pour B1
// =============================================================================

export const STATUTS_STRUCTURE_VALUES = ['creation', 'renforcement', 'relance'] as const;
export type StatutStructure = (typeof STATUTS_STRUCTURE_VALUES)[number];

// =============================================================================
// Helpers de libellés UI — les libellés « pour utilisateur » sont gardés en
// lecture seule depuis les tables Supabase au moment du rendu, mais ces
// mappings statiques servent pour les tests, les stubs, et l'i18n future.
// =============================================================================

export const SEXE_LIBELLES: Record<Sexe, string> = {
  F: 'Femme',
  M: 'Homme',
  Autre: 'Autre',
};

export const STATUT_BENEFICIAIRE_LIBELLES: Record<StatutBeneficiaireCode, string> = {
  INSCRIT: 'Inscrit',
  PRESENT_EFFECTIF: 'Présent effectif',
  FORMATION_ACHEVEE: 'Formation achevée',
  ABANDON: 'Abandon',
  NON_PRECISE: 'Non précisé',
};

export const MODALITE_FORMATION_LIBELLES: Record<ModaliteFormationCode, string> = {
  PRESENTIEL: 'Présentiel',
  EN_LIGNE: 'En ligne (à distance)',
  HYBRIDE: 'Hybride (mixte)',
};

// =============================================================================
// Libellés B1 — structures (Étape 5)
// =============================================================================

export const TYPE_STRUCTURE_LIBELLES: Record<TypeStructureCode, string> = {
  AGR: 'Agriculture / Élevage / Pêche',
  MICRO_ENTR: 'Micro-entreprise',
  PETITE_ENTR: 'Petite entreprise',
  COOP: 'Coopérative',
  ASSOC: 'Association',
  GIE: 'Groupement d’intérêt économique (GIE)',
  AUTRE: 'Autre',
};

export const SECTEUR_ACTIVITE_LIBELLES: Record<SecteurActiviteCode, string> = {
  AGR_SYL_PCH: 'Agriculture, sylviculture, pêche',
  AGROALIM: 'Agroalimentaire',
  ARTISANAT: 'Artisanat',
  COMMERCE: 'Commerce',
  BTP: 'BTP, construction',
  CULTURE: 'Culture, arts',
  EDUC: 'Éducation, formation',
  ENERGIE_ENV: 'Énergie, environnement',
  TOURISME: 'Tourisme, hôtellerie, restauration',
  INDUSTRIE: 'Industrie, transformation',
  SANTE_SOCIAL: 'Santé, action sociale',
  SERV_ENTR: 'Services aux entreprises',
  SERV_FIN: 'Services financiers',
  SPORT_LOISIRS: 'Sport, loisirs',
  TIC: 'TIC, numérique',
  TRANSPORT: 'Transport, logistique',
  AUTRE: 'Autre',
};

export const NATURE_APPUI_LIBELLES: Record<NatureAppuiCode, string> = {
  SUBVENTION: 'Subvention',
  MATERIEL: 'Appui matériel / équipement',
  FORMATION: 'Formation',
  MENTORAT: 'Mentorat / accompagnement',
  MISE_RELATION: 'Mise en relation / réseautage',
  APPUI_MIXTE: 'Appui mixte',
  AUTRE: 'Autre',
};

export const STATUT_STRUCTURE_LIBELLES: Record<StatutStructure, string> = {
  creation: 'Création',
  renforcement: 'Renforcement',
  relance: 'Relance',
};

/**
 * Libellés des devises affichés dans les Selects. Le code ISO 4217 reste la
 * valeur stockée ; le libellé est l'écriture longue + symbole courant.
 */
export const DEVISE_LIBELLES: Record<(typeof DEVISES_CODES)[number], string> = {
  EUR: 'Euro (€)',
  USD: 'Dollar US ($)',
  XOF: 'Franc CFA BCEAO (FCFA)',
  XAF: 'Franc CFA BEAC (FCFA)',
  MAD: 'Dirham marocain (DH)',
  DZD: 'Dinar algérien (DA)',
  TND: 'Dinar tunisien (DT)',
  MGA: 'Ariary malgache (Ar)',
  MRU: 'Ouguiya (UM)',
  CDF: 'Franc congolais (FC)',
  RWF: 'Franc rwandais (FRw)',
  DJF: 'Franc djiboutien (Fdj)',
  LBP: 'Livre libanaise (LL)',
  HTG: 'Gourde haïtienne (G)',
  Autre: 'Autre devise',
};
