/**
 * Smart mapper — normalisation tolérante pour l'import bénéficiaires (Phase A).
 *
 * Philosophie : "absorber le maximum, signaler le reste". Les coordinateurs
 * envoient des fichiers Excel hétérogènes (en-têtes libres, codes abrégés,
 * libellés français/anglais). Ce module :
 *
 *   1. Mappe les en-têtes lus vers le template officiel (fuzzy matching)
 *   2. Normalise les valeurs (codes projets P14→PROJ_A14, pays "Cameroun"→CMR,
 *      sexe H→M, tranche d'âge texte libre, etc.)
 *   3. Calcule un score de complétude pour la stratégie de fusion de doublons
 *
 *  Ce fichier ne fait QUE de la normalisation pure — il n'écrit pas en BDD,
 *  ne consomme pas l'API. Il est testable unitairement sans mock.
 */

import {
  DOMAINES_FORMATION_CODES,
  MODALITES_FORMATION_CODES,
  NATURES_APPUI_CODES,
  PAYS_CODES,
  PROJETS_CODES,
  SECTEURS_ACTIVITE_CODES,
  STATUTS_BENEFICIAIRE_CODES,
  STATUTS_STRUCTURE_VALUES,
  TYPES_STRUCTURE_CODES,
  type DomaineFormationCode,
  type ModaliteFormationCode,
  type NatureAppuiCode,
  type PaysCode,
  type ProjetCode,
  type SecteurActiviteCode,
  type StatutBeneficiaireCode,
  type StatutStructure,
  type TypeStructureCode,
} from '@/lib/schemas/nomenclatures';

// =============================================================================
// 1A. Mapping d'en-têtes flou (fuzzy header matching)
// =============================================================================

/**
 * Dictionnaire des variantes d'en-têtes connues → en-tête canonique du template.
 *
 * Les clés sont **normalisées** (lowercase, sans accent, sans whitespace
 * superflu) — l'algorithme applique la même normalisation à l'en-tête lu
 * avant lookup. Les valeurs sont les en-têtes officiels du Template V1.
 */
const HEADER_SYNONYMES: Record<string, string> = {
  // → 'Code projet *'
  projet: 'Code projet *',
  'code projet': 'Code projet *',
  code_projet: 'Code projet *',
  project: 'Code projet *',

  // → 'Code pays bénéficiaire *'
  pays: 'Code pays bénéficiaire *',
  'pays de provenance': 'Code pays bénéficiaire *',
  'pays de residence': 'Code pays bénéficiaire *',
  country: 'Code pays bénéficiaire *',
  'pays beneficiaire': 'Code pays bénéficiaire *',
  'code pays': 'Code pays bénéficiaire *',

  // → 'Prénom *'
  prenom: 'Prénom *',
  prenoms: 'Prénom *',
  'first name': 'Prénom *',

  // → 'Nom *'
  nom: 'Nom *',
  'last name': 'Nom *',
  'nom de famille': 'Nom *',

  // → 'Sexe *'
  sexe: 'Sexe *',
  genre: 'Sexe *',
  gender: 'Sexe *',
  sex: 'Sexe *',

  // → 'Domaine de formation *'
  domaine: 'Domaine de formation *',
  'domaine de formation': 'Domaine de formation *',
  'type de formation': 'Domaine de formation *',
  formation: 'Domaine de formation *',
  secteur: 'Domaine de formation *',
  'type de formation suivi': 'Domaine de formation *',

  // → 'Modalité *'
  modalite: 'Modalité *',
  mode: 'Modalité *',

  // → 'Année de la formation *'
  annee: 'Année de la formation *',
  'annee de la formation': 'Année de la formation *',
  'annee durant laquelle': 'Année de la formation *',
  'annee formation': 'Année de la formation *',
  year: 'Année de la formation *',

  // → 'Statut *'
  statut: 'Statut *',
  status: 'Statut *',
  etat: 'Statut *',

  // → 'Consentement *'
  consentement: 'Consentement *',
  consent: 'Consentement *',
  rgpd: 'Consentement *',
  accord: 'Consentement *',

  // → 'Courriel'
  email: 'Courriel',
  courriel: 'Courriel',
  'e-mail': 'Courriel',
  mail: 'Courriel',
  'adresse email': 'Courriel',

  // → 'Téléphone (avec indicatif)'
  telephone: 'Téléphone (avec indicatif)',
  tel: 'Téléphone (avec indicatif)',
  contact: 'Téléphone (avec indicatif)',
  contacts: 'Téléphone (avec indicatif)',
  phone: 'Téléphone (avec indicatif)',

  // → "Partenaire d'accompagnement"
  organisation: "Partenaire d'accompagnement",
  'organisation qui vous a accompagne': "Partenaire d'accompagnement",
  partenaire: "Partenaire d'accompagnement",
  structure: "Partenaire d'accompagnement",

  // → 'Fonction / Statut actuel'
  fonction: 'Fonction / Statut actuel',
  poste: 'Fonction / Statut actuel',
  'fonction actuelle': 'Fonction / Statut actuel',

  // → "Tranche d'âge déclarée"
  'tranche age': "Tranche d'âge déclarée",
  "tranche d'age": "Tranche d'âge déclarée",
  age: "Tranche d'âge déclarée",
  'categorie age': "Tranche d'âge déclarée",
  jeune: "Tranche d'âge déclarée",
  'jeune (18-34 ans)': "Tranche d'âge déclarée",
  'adulte (35 ans et +)': "Tranche d'âge déclarée",
  'jeune (18-34 ans)/*adulte (35 ans et +)1': "Tranche d'âge déclarée",
};

/**
 * Mots-clés indicatifs si le header lu CONTIENT le mot (fallback dernier recours).
 *
 * Ordre IMPORTANT : les patterns plus spécifiques d'abord (ex. `annee` doit
 * matcher AVANT `formation`, sinon « Année durant laquelle la formation
 * a été suivie » est attribué à Domaine de formation au lieu de Année).
 */
const HEADER_KEYWORDS: Array<{ motCle: string; cible: string }> = [
  // Très spécifiques d'abord
  { motCle: 'annee', cible: 'Année de la formation *' },
  { motCle: 'jeune', cible: "Tranche d'âge déclarée" },
  { motCle: 'adulte', cible: "Tranche d'âge déclarée" },
  { motCle: 'tranche', cible: "Tranche d'âge déclarée" },
  { motCle: 'modalite', cible: 'Modalité *' },
  { motCle: 'consentement', cible: 'Consentement *' },
  { motCle: 'courriel', cible: 'Courriel' },
  { motCle: 'email', cible: 'Courriel' },
  { motCle: 'telephone', cible: 'Téléphone (avec indicatif)' },
  { motCle: 'contact', cible: 'Téléphone (avec indicatif)' },
  { motCle: 'organisation', cible: "Partenaire d'accompagnement" },
  { motCle: 'partenaire', cible: "Partenaire d'accompagnement" },
  { motCle: 'structure', cible: "Partenaire d'accompagnement" },
  { motCle: 'fonction', cible: 'Fonction / Statut actuel' },
  { motCle: 'poste', cible: 'Fonction / Statut actuel' },
  // Plus génériques ensuite
  { motCle: 'projet', cible: 'Code projet *' },
  { motCle: 'pays', cible: 'Code pays bénéficiaire *' },
  { motCle: 'prenom', cible: 'Prénom *' },
  { motCle: 'nom', cible: 'Nom *' },
  { motCle: 'sexe', cible: 'Sexe *' },
  { motCle: 'genre', cible: 'Sexe *' },
  { motCle: 'domaine', cible: 'Domaine de formation *' },
  { motCle: 'formation', cible: 'Domaine de formation *' },
  { motCle: 'statut', cible: 'Statut *' },
  { motCle: 'age', cible: "Tranche d'âge déclarée" },
];

/**
 * Normalise un texte pour comparaison fuzzy :
 *   - lowercase
 *   - strip accents (combining marks)
 *   - apostrophes et tirets remplacés par espace (« Côte d'Ivoire » →
 *     « cote d ivoire » uniformisé)
 *   - whitespace réduit à un seul espace
 *   - astérisques * (marqueurs obligatoires) supprimés
 */
export function normaliserPourComparaison(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks (accents)
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[*]/g, '')
    .replace(/['’\-]/g, ' ') // apostrophe (droite/courbe) et tiret → espace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Détecte les en-têtes du fichier avec une stratégie graduée :
 *   1. Correspondance exacte (insensible casse/accent)
 *   2. Synonyme connu dans HEADER_SYNONYMES
 *   3. Match par mot-clé (HEADER_KEYWORDS)
 *
 * Pour les colonnes non identifiées, on les laisse dans `headersNonReconnus`
 * — l'UI les affichera comme "colonnes ignorées".
 */
export function detecterEnTetesFlexibles(
  headersLus: (string | null)[],
  headersAttendus: readonly string[],
): {
  mapping: Map<string, string>; // header_lu → header_attendu (canonique)
  headersMappesAuto: Record<string, string>; // mappings qui ont requis une stratégie floue (info utilisateur)
  headersNonReconnus: string[]; // headers totalement ignorés
} {
  const mapping = new Map<string, string>();
  const headersMappesAuto: Record<string, string> = {};
  const headersNonReconnus: string[] = [];

  // Set des headers attendus pour vérif exact-match (insensible casse/accent)
  const attendusNormalises = new Map<string, string>();
  for (const h of headersAttendus) {
    attendusNormalises.set(normaliserPourComparaison(h), h);
  }

  for (const lu of headersLus) {
    if (!lu) continue;
    const norme = normaliserPourComparaison(lu);

    // 1. Exact match (normalisé)
    const exactCible = attendusNormalises.get(norme);
    if (exactCible) {
      mapping.set(lu, exactCible);
      continue;
    }

    // 2. Synonyme direct
    const synonymeCible = HEADER_SYNONYMES[norme];
    if (synonymeCible) {
      mapping.set(lu, synonymeCible);
      headersMappesAuto[lu] = synonymeCible;
      continue;
    }

    // 3. Match par mot-clé (fallback)
    let matchKeyword: string | null = null;
    for (const { motCle, cible } of HEADER_KEYWORDS) {
      if (norme.includes(motCle)) {
        matchKeyword = cible;
        break;
      }
    }
    if (matchKeyword) {
      mapping.set(lu, matchKeyword);
      headersMappesAuto[lu] = matchKeyword;
      continue;
    }

    // 4. Non reconnu
    headersNonReconnus.push(lu);
  }

  return { mapping, headersMappesAuto, headersNonReconnus };
}

// =============================================================================
// 1B. Normalisation des valeurs
// =============================================================================

/**
 * Mappage des codes abrégés P14/P16a... vers les codes officiels PROJ_A*.
 * Source : docs/references/00_NOMENCLATURE_PROJETS_OIF.md (table de correspondance).
 */
const PROJET_ALIASES: Record<string, ProjetCode> = {
  P6: 'PROJ_A06',
  P9: 'PROJ_A09',
  P13: 'PROJ_A13',
  P14: 'PROJ_A14',
  P15: 'PROJ_A15',
  P16: 'PROJ_A16a',
  P16A: 'PROJ_A16a',
  P16B: 'PROJ_A16b',
  P17: 'PROJ_A17',
  P18: 'PROJ_A18',
  P19: 'PROJ_A19',
  P20: 'PROJ_A20',
  PROJA06: 'PROJ_A06',
  PROJA09: 'PROJ_A09',
  PROJA14: 'PROJ_A14',
  PROJA15: 'PROJ_A15',
  PROJA16A: 'PROJ_A16a',
  PROJA16B: 'PROJ_A16b',
  PROJA17: 'PROJ_A17',
  PROJA18: 'PROJ_A18',
  PROJA19: 'PROJ_A19',
  PROJA20: 'PROJ_A20',
};

/**
 * Libellés français de pays → code ISO-3.
 *
 * Limité aux 61 pays présents dans `PAYS_CODES` (Template V1 OIF) — les
 * pays hors enum (Afghanistan, Estonie, Pologne, etc.) ne sont pas inclus
 * car la BDD les rejetterait via la contrainte FK pays.code. Les variantes
 * courantes (Côte d'Ivoire, RDC, RCA, etc.) sont mappées sur le code OIF
 * adéquat.
 *
 * Les clés sont déjà normalisées (sans accent, apostrophe → espace).
 */
const PAYS_PAR_LIBELLE: Record<string, PaysCode> = {
  albanie: 'ALB',
  andorre: 'AND',
  argentine: 'ARG',
  armenie: 'ARM',
  barbade: 'BRB',
  belgique: 'BEL',
  benin: 'BEN',
  bresil: 'BRA',
  bulgarie: 'BGR',
  'burkina faso': 'BFA',
  burundi: 'BDI',
  cambodge: 'KHM',
  cameroun: 'CMR',
  canada: 'CAN',
  'cap vert': 'CPV',
  capvert: 'CPV',
  centrafrique: 'CAF',
  'republique centrafricaine': 'CAF',
  rca: 'CAF',
  comores: 'COM',
  congo: 'COG',
  'congo brazzaville': 'COG',
  'republique democratique du congo': 'COD',
  'congo rd': 'COD',
  'congo kinshasa': 'COD',
  rdc: 'COD',
  'cote d ivoire': 'CIV',
  djibouti: 'DJI',
  dominicaine: 'DOM',
  'republique dominicaine': 'DOM',
  egypte: 'EGY',
  france: 'FRA',
  gabon: 'GAB',
  ghana: 'GHA',
  grece: 'GRC',
  guinee: 'GIN',
  'guinee bissau': 'GNB',
  'guinee equatoriale': 'GNQ',
  haiti: 'HTI',
  italie: 'ITA',
  kenya: 'KEN',
  laos: 'LAO',
  liban: 'LBN',
  luxembourg: 'LUX',
  macedoine: 'MKD',
  madagascar: 'MDG',
  mali: 'MLI',
  malte: 'MLT',
  maroc: 'MAR',
  maurice: 'MUS',
  'ile maurice': 'MUS',
  mauritanie: 'MRT',
  moldavie: 'MDA',
  monaco: 'MCO',
  niger: 'NER',
  roumanie: 'ROU',
  rwanda: 'RWA',
  'sainte lucie': 'LCA',
  'saint thomas et prince': 'STP',
  'sao tome et principe': 'STP',
  senegal: 'SEN',
  serbie: 'SRB',
  seychelles: 'SYC',
  suisse: 'CHE',
  tchad: 'TCD',
  togo: 'TGO',
  tunisie: 'TUN',
  ukraine: 'UKR',
  vanuatu: 'VUT',
  vietnam: 'VNM',
  'etats unis': 'USA',
  usa: 'USA',
};

const SEXE_ALIASES: Record<string, 'F' | 'M' | 'Autre'> = {
  h: 'M',
  homme: 'M',
  hommes: 'M',
  masculin: 'M',
  male: 'M',
  m: 'M',
  f: 'F',
  femme: 'F',
  femmes: 'F',
  feminin: 'F',
  female: 'F',
  autre: 'Autre',
  other: 'Autre',
  'non precise': 'Autre',
};

/**
 * Variantes de saisie pour la tranche d'âge. Les clés sont déjà normalisées
 * (sans accent, lowercase, tirets/apostrophes en espace) — la fonction
 * normaliserPourComparaison() est appliquée à la valeur lue avant lookup.
 */
const TRANCHE_AGE_ALIASES: Record<string, 'Jeune' | 'Adulte'> = {
  jeune: 'Jeune',
  j: 'Jeune',
  '18 34': 'Jeune', // ex « 18-34 » après normalisation
  '18 34 ans': 'Jeune',
  'jeune (18 34 ans)': 'Jeune',
  adulte: 'Adulte',
  a: 'Adulte',
  '35+': 'Adulte',
  '35 ans et +': 'Adulte',
  '35 et +': 'Adulte',
  'adulte (35 ans et +)': 'Adulte',
};

/**
 * Heuristiques texte libre → code domaine de formation OIF.
 * Pour les valeurs non mappables, retourne 'AUTRE' (catégorie fourre-tout
 * définie dans le seed) et signale dans le rapport.
 */
const DOMAINE_ALIASES: Record<string, DomaineFormationCode> = {
  // Numérique
  'competences techniques': 'NUM_INFO',
  numerique: 'NUM_INFO',
  informatique: 'NUM_INFO',
  digital: 'NUM_INFO',
  tic: 'NUM_INFO',
  // Agriculture / agroalim
  agriculture: 'AGR_ELV_PCH',
  elevage: 'AGR_ELV_PCH',
  peche: 'AGR_ELV_PCH',
  'agro-alimentaire': 'AGROALIM',
  agroalimentaire: 'AGROALIM',
  // Artisanat / commerce / tourisme
  artisanat: 'ARTISANAT',
  commerce: 'COMMERCE',
  vente: 'COMMERCE',
  tourisme: 'TOURISME',
  hotellerie: 'TOURISME',
  // Gestion / entrepreneuriat / finance
  entrepreneuriat: 'ENTREPR_GEST',
  gestion: 'ENTREPR_GEST',
  comptabilite: 'GEST_FIN_COMPTA',
  finance: 'GEST_FIN_COMPTA',
  'finance et comptabilite': 'GEST_FIN_COMPTA',
  'services financiers': 'SERV_FIN_INCLUSION',
  microfinance: 'SERV_FIN_INCLUSION',
  // Communication / langues
  marketing: 'LANGUES_COM',
  communication: 'LANGUES_COM',
  langues: 'LANGUES_COM',
  // Santé / services
  sante: 'SANTE_SERV_PERS',
  'services a la personne': 'SANTE_SERV_PERS',
  // Environnement / transports
  environnement: 'ENV_ECO_VERTE',
  'economie verte': 'ENV_ECO_VERTE',
  transport: 'TRANSPORT',
  logistique: 'TRANSPORT',
  // Formations techniques / pro
  technique: 'FP_TECH',
  'formation professionnelle': 'FP_TECH',
  'developpement personnel': 'DEV_PERS',
};

const MODALITE_ALIASES: Record<string, ModaliteFormationCode> = {
  presentiel: 'PRESENTIEL',
  'en presentiel': 'PRESENTIEL',
  'en ligne': 'EN_LIGNE',
  online: 'EN_LIGNE',
  distanciel: 'EN_LIGNE',
  hybride: 'HYBRIDE',
  mixte: 'HYBRIDE',
};

const STATUT_ALIASES: Record<string, StatutBeneficiaireCode> = {
  inscrit: 'INSCRIT',
  'present effectif': 'PRESENT_EFFECTIF',
  present: 'PRESENT_EFFECTIF',
  'formation achevee': 'FORMATION_ACHEVEE',
  acheve: 'FORMATION_ACHEVEE',
  diplome: 'FORMATION_ACHEVEE',
  certifie: 'FORMATION_ACHEVEE',
  abandon: 'ABANDON',
  abandonne: 'ABANDON',
  'non precise': 'NON_PRECISE',
};

const CONSENTEMENT_TRUE = new Set([
  'oui',
  'yes',
  'true',
  '1',
  'accord',
  'accorde',
  'donne',
  'recueilli',
  'consenti',
]);
const CONSENTEMENT_FALSE = new Set([
  'non',
  'no',
  'false',
  '0',
  'pas de consentement',
  'refus',
  'refuse',
]);

function toStringNonVide(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export function normaliserCodeProjet(v: unknown): ProjetCode | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  // 1. Déjà dans les codes officiels ?
  if ((PROJETS_CODES as readonly string[]).includes(s)) return s as ProjetCode;
  // 2. Casse insensible
  const upper = s.toUpperCase().replace(/[\s_-]/g, '');
  if ((PROJETS_CODES as readonly string[]).includes(upper)) return upper as ProjetCode;
  // 3. Alias abrégés (P14, P16a, etc.)
  const alias = PROJET_ALIASES[upper];
  if (alias) return alias;
  return null;
}

export function normaliserCodePays(v: unknown): PaysCode | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  // 1. Code ISO-3 direct
  const upper = s.toUpperCase();
  if ((PAYS_CODES as readonly string[]).includes(upper)) return upper as PaysCode;
  // 2. Libellé français
  const norme = normaliserPourComparaison(s);
  const alias = PAYS_PAR_LIBELLE[norme];
  if (alias) return alias;
  return null;
}

export function normaliserSexe(v: unknown): 'F' | 'M' | 'Autre' | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  const norme = normaliserPourComparaison(s);
  return SEXE_ALIASES[norme] ?? null;
}

export function normaliserTrancheAge(v: unknown): 'Jeune' | 'Adulte' | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  const norme = normaliserPourComparaison(s);
  return TRANCHE_AGE_ALIASES[norme] ?? null;
}

export function normaliserDomaineFormation(v: unknown): DomaineFormationCode | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  // 1. Code officiel direct
  const upper = s.toUpperCase().replace(/\s+/g, '_');
  if ((DOMAINES_FORMATION_CODES as readonly string[]).includes(upper)) {
    return upper as DomaineFormationCode;
  }
  // 2. Alias texte libre
  const norme = normaliserPourComparaison(s);
  const alias = DOMAINE_ALIASES[norme];
  if (alias) return alias;
  // 3. Fallback : valeur présente mais non reconnue → 'AUTRE'
  //    (domaine_formation_code est NOT NULL en base — ne jamais retourner null
  //     si une valeur a été fournie, même non identifiable)
  return 'AUTRE';
}

export function normaliserModalite(v: unknown): ModaliteFormationCode | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  const upper = s.toUpperCase().replace(/\s+/g, '_');
  if ((MODALITES_FORMATION_CODES as readonly string[]).includes(upper)) {
    return upper as ModaliteFormationCode;
  }
  const norme = normaliserPourComparaison(s);
  return MODALITE_ALIASES[norme] ?? null;
}

export function normaliserStatut(v: unknown): StatutBeneficiaireCode | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  const upper = s.toUpperCase().replace(/\s+/g, '_');
  if ((STATUTS_BENEFICIAIRE_CODES as readonly string[]).includes(upper)) {
    return upper as StatutBeneficiaireCode;
  }
  const norme = normaliserPourComparaison(s);
  return STATUT_ALIASES[norme] ?? null;
}

// =============================================================================
// Normalizers B1 — structures (utilisés par l'extracteur IA B1)
// =============================================================================

const TYPE_STRUCTURE_ALIASES: Record<string, TypeStructureCode> = {
  // AGR
  agr: 'AGR',
  agriculture: 'AGR',
  agricole: 'AGR',
  elevage: 'AGR',
  peche: 'AGR',
  'groupement agricole': 'AGR',
  'groupe agricole': 'AGR',
  pisciculture: 'AGR',
  // MICRO_ENTR
  micro_entr: 'MICRO_ENTR',
  micro: 'MICRO_ENTR',
  'micro entreprise': 'MICRO_ENTR',
  'micro-entreprise': 'MICRO_ENTR',
  microentreprise: 'MICRO_ENTR',
  tpe: 'MICRO_ENTR',
  'tres petite entreprise': 'MICRO_ENTR',
  // PETITE_ENTR
  petite_entr: 'PETITE_ENTR',
  pme: 'PETITE_ENTR',
  'petite entreprise': 'PETITE_ENTR',
  'small business': 'PETITE_ENTR',
  sme: 'PETITE_ENTR',
  // COOP
  coop: 'COOP',
  cooperative: 'COOP',
  coopérative: 'COOP',
  'cooperative agricole': 'COOP',
  // ASSOC
  assoc: 'ASSOC',
  association: 'ASSOC',
  ong: 'ASSOC',
  ngo: 'ASSOC',
  'organisation non gouvernementale': 'ASSOC',
  // GIE
  gie: 'GIE',
  'groupement interet economique': 'GIE',
  'groupement d interet economique': 'GIE',
  "groupement d'interet economique": 'GIE',
  // AUTRE
  autre: 'AUTRE',
  other: 'AUTRE',
  divers: 'AUTRE',
};

export function normaliserTypeStructure(v: unknown): TypeStructureCode | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  const upper = s.toUpperCase().replace(/\s+/g, '_');
  if ((TYPES_STRUCTURE_CODES as readonly string[]).includes(upper)) {
    return upper as TypeStructureCode;
  }
  const norme = normaliserPourComparaison(s);
  return TYPE_STRUCTURE_ALIASES[norme] ?? 'AUTRE';
}

const SECTEUR_ACTIVITE_ALIASES: Record<string, SecteurActiviteCode> = {
  // AGR_SYL_PCH
  'agriculture sylviculture peche': 'AGR_SYL_PCH',
  agriculture: 'AGR_SYL_PCH',
  sylviculture: 'AGR_SYL_PCH',
  agr: 'AGR_SYL_PCH',
  'agr syl pch': 'AGR_SYL_PCH',
  agricole: 'AGR_SYL_PCH',
  peche: 'AGR_SYL_PCH',
  elevage: 'AGR_SYL_PCH',
  // AGROALIM
  agroalimentaire: 'AGROALIM',
  'agro alimentaire': 'AGROALIM',
  alimentaire: 'AGROALIM',
  food: 'AGROALIM',
  agroalim: 'AGROALIM',
  // ARTISANAT
  artisanat: 'ARTISANAT',
  artisan: 'ARTISANAT',
  craft: 'ARTISANAT',
  artisanal: 'ARTISANAT',
  // COMMERCE
  commerce: 'COMMERCE',
  commercial: 'COMMERCE',
  trade: 'COMMERCE',
  negoce: 'COMMERCE',
  vente: 'COMMERCE',
  // BTP
  btp: 'BTP',
  construction: 'BTP',
  batiment: 'BTP',
  'travaux publics': 'BTP',
  'batiment travaux publics': 'BTP',
  immobilier: 'BTP',
  // CULTURE
  culture: 'CULTURE',
  arts: 'CULTURE',
  cultural: 'CULTURE',
  art: 'CULTURE',
  // EDUC
  education: 'EDUC',
  formation: 'EDUC',
  enseignement: 'EDUC',
  'education formation': 'EDUC',
  educ: 'EDUC',
  scolaire: 'EDUC',
  // ENERGIE_ENV
  energie: 'ENERGIE_ENV',
  environnement: 'ENERGIE_ENV',
  energy: 'ENERGIE_ENV',
  ecologie: 'ENERGIE_ENV',
  'energie environnement': 'ENERGIE_ENV',
  'energies renouvelables': 'ENERGIE_ENV',
  // TOURISME
  tourisme: 'TOURISME',
  hotellerie: 'TOURISME',
  restauration: 'TOURISME',
  hotel: 'TOURISME',
  'tourisme hotellerie restauration': 'TOURISME',
  // INDUSTRIE
  industrie: 'INDUSTRIE',
  manufacturing: 'INDUSTRIE',
  'industrie manufacturiere': 'INDUSTRIE',
  // SANTE_SOCIAL
  sante: 'SANTE_SOCIAL',
  social: 'SANTE_SOCIAL',
  healthcare: 'SANTE_SOCIAL',
  medical: 'SANTE_SOCIAL',
  'sante social': 'SANTE_SOCIAL',
  // SERV_ENTR
  'services aux entreprises': 'SERV_ENTR',
  conseil: 'SERV_ENTR',
  consulting: 'SERV_ENTR',
  'serv entr': 'SERV_ENTR',
  // SERV_FIN
  'services financiers': 'SERV_FIN',
  finance: 'SERV_FIN',
  microfinance: 'SERV_FIN',
  fintech: 'SERV_FIN',
  'serv fin': 'SERV_FIN',
  banque: 'SERV_FIN',
  // SPORT_LOISIRS
  sport: 'SPORT_LOISIRS',
  loisirs: 'SPORT_LOISIRS',
  recreation: 'SPORT_LOISIRS',
  'sport loisirs': 'SPORT_LOISIRS',
  // TIC
  tic: 'TIC',
  informatique: 'TIC',
  numerique: 'TIC',
  digital: 'TIC',
  tech: 'TIC',
  it: 'TIC',
  ntic: 'TIC',
  technologie: 'TIC',
  // TRANSPORT
  transport: 'TRANSPORT',
  logistique: 'TRANSPORT',
  logistics: 'TRANSPORT',
  // AUTRE
  autre: 'AUTRE',
  other: 'AUTRE',
  divers: 'AUTRE',
};

export function normaliserSecteurActivite(v: unknown): SecteurActiviteCode | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  const upper = s.toUpperCase().replace(/\s+/g, '_');
  if ((SECTEURS_ACTIVITE_CODES as readonly string[]).includes(upper)) {
    return upper as SecteurActiviteCode;
  }
  const norme = normaliserPourComparaison(s);
  return SECTEUR_ACTIVITE_ALIASES[norme] ?? 'AUTRE';
}

const STATUT_CREATION_ALIASES: Record<string, StatutStructure> = {
  // creation
  creation: 'creation',
  création: 'creation',
  create: 'creation',
  nouveau: 'creation',
  nouvelle: 'creation',
  new: 'creation',
  'nouvelle structure': 'creation',
  'newly created': 'creation',
  // renforcement
  renforcement: 'renforcement',
  renforcer: 'renforcement',
  strengthen: 'renforcement',
  strengthening: 'renforcement',
  appui: 'renforcement',
  soutien: 'renforcement',
  'appui renforcement': 'renforcement',
  // relance
  relance: 'relance',
  relancer: 'relance',
  relaunch: 'relance',
  revival: 'relance',
  redemarrage: 'relance',
  redémarrage: 'relance',
  'remise en activite': 'relance',
};

export function normaliserStatutCreation(v: unknown): StatutStructure | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  const lower = s.toLowerCase().trim();
  if ((STATUTS_STRUCTURE_VALUES as readonly string[]).includes(lower)) {
    return lower as StatutStructure;
  }
  const norme = normaliserPourComparaison(s);
  return STATUT_CREATION_ALIASES[norme] ?? null;
}

const NATURE_APPUI_ALIASES: Record<string, NatureAppuiCode> = {
  // SUBVENTION
  subvention: 'SUBVENTION',
  grant: 'SUBVENTION',
  'subvention financiere': 'SUBVENTION',
  financement: 'SUBVENTION',
  'aide financiere': 'SUBVENTION',
  // MATERIEL
  materiel: 'MATERIEL',
  equipment: 'MATERIEL',
  equipement: 'MATERIEL',
  'don materiel': 'MATERIEL',
  'appui materiel': 'MATERIEL',
  // FORMATION
  formation: 'FORMATION',
  training: 'FORMATION',
  'appui formation': 'FORMATION',
  renforcement: 'FORMATION',
  'renforcement de capacites': 'FORMATION',
  capacites: 'FORMATION',
  // MENTORAT
  mentorat: 'MENTORAT',
  mentoring: 'MENTORAT',
  coaching: 'MENTORAT',
  accompagnement: 'MENTORAT',
  'appui technique': 'MENTORAT',
  // MISE_RELATION
  'mise en relation': 'MISE_RELATION',
  networking: 'MISE_RELATION',
  'mise relation': 'MISE_RELATION',
  mise_en_relation: 'MISE_RELATION',
  reseautage: 'MISE_RELATION',
  // APPUI_MIXTE
  'appui mixte': 'APPUI_MIXTE',
  'mixed support': 'APPUI_MIXTE',
  combine: 'APPUI_MIXTE',
  mixte: 'APPUI_MIXTE',
  appui_mixte: 'APPUI_MIXTE',
  pluriel: 'APPUI_MIXTE',
  // AUTRE
  autre: 'AUTRE',
  other: 'AUTRE',
  divers: 'AUTRE',
};

export function normaliserNatureAppui(v: unknown): NatureAppuiCode | null {
  const s = toStringNonVide(v);
  if (!s) return null;
  const upper = s.toUpperCase().replace(/\s+/g, '_');
  if ((NATURES_APPUI_CODES as readonly string[]).includes(upper)) {
    return upper as NatureAppuiCode;
  }
  const norme = normaliserPourComparaison(s);
  return NATURE_APPUI_ALIASES[norme] ?? 'AUTRE';
}

export function normaliserConsentement(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s.length === 0) return null;
  if (CONSENTEMENT_TRUE.has(s)) return true;
  if (CONSENTEMENT_FALSE.has(s)) return false;
  return null;
}

// =============================================================================
// 1C. Score de complétude + fusion de doublons
// =============================================================================

/** Champs poids pour le score. Les obligatoires métier valent plus. */
const POIDS_CHAMPS: Record<string, number> = {
  prenom: 3,
  nom: 3,
  sexe: 2,
  pays_code: 2,
  annee_formation: 2,
  domaine_formation_code: 2,
  projet_code: 2,
  courriel: 2,
  tranche_age_declaree: 1,
  telephone: 1,
  modalite_formation_code: 1,
  statut_code: 1,
  partenaire_accompagnement: 1,
  fonction_actuelle: 1,
  date_debut_formation: 1,
};

/**
 * Score de complétude d'un enregistrement (0..N). Plus c'est haut, plus on a
 * de données utiles. Utilisé pour comparer deux records doublons et décider
 * lequel est plus complet (donc à enrichir avec les champs de l'autre).
 */
export function calculerScoreCompletude(donnees: Record<string, unknown>): number {
  let total = 0;
  for (const [champ, poids] of Object.entries(POIDS_CHAMPS)) {
    const v = donnees[champ];
    if (v !== null && v !== undefined && v !== '') total += poids;
  }
  return total;
}

/**
 * Fusionne deux enregistrements : pour chaque champ, on garde la valeur la
 * plus informative — `existant` est prioritaire (on ne l'écrase pas), `nouveau`
 * comble seulement les NULL/vides de `existant`.
 *
 * Convention : préserve les corrections manuelles éventuelles côté `existant`.
 */
export function fusionnerBeneficiaires<T extends Record<string, unknown>>(
  existant: T,
  nouveau: Partial<T>,
): { fusionne: T; champsMisAJour: string[] } {
  const fusionne: T = { ...existant };
  const champsMisAJour: string[] = [];
  for (const [champ, valNouvelle] of Object.entries(nouveau)) {
    const valActuelle = (existant as Record<string, unknown>)[champ];
    const actuelleVide = valActuelle === null || valActuelle === undefined || valActuelle === '';
    const nouvelleRenseignee =
      valNouvelle !== null && valNouvelle !== undefined && valNouvelle !== '';
    if (actuelleVide && nouvelleRenseignee) {
      (fusionne as Record<string, unknown>)[champ] = valNouvelle;
      champsMisAJour.push(champ);
    }
  }
  return { fusionne, champsMisAJour };
}
