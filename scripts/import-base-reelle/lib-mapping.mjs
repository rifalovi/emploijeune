/**
 * Helpers communs aux scripts d'import de la base OIF officielle
 * (data/oif/import/*.csv → tables `beneficiaires` / `structures`).
 *
 * Pas de dépendance Supabase ici : module pur, testable.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mapping codes projets : P14 → PROJ_A14 (cf. projets_codes_legacy en BDD).
// La migration 017 ajoute P6 et P13 manquants en seed initial.
// ─────────────────────────────────────────────────────────────────────────────
export const PROJET_LEGACY_VERS_OFFICIEL = {
  P6: 'PROJ_A06',
  P13: 'PROJ_A13',
  P14: 'PROJ_A14',
  P15: 'PROJ_A15',
  P16: 'PROJ_A16a',
  P16a: 'PROJ_A16a',
  P16b: 'PROJ_A16b',
  P17: 'PROJ_A17',
  P18: 'PROJ_A18',
  P19: 'PROJ_A19',
  P20: 'PROJ_A20',
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapping pays libellé FR → code ISO (cf. seed.sql public.pays).
// Inclut les variantes orthographiques observées dans le CSV de la base OIF
// + variantes anglaises + typos courantes (hotfix v1.2.6).
//
// Code sentinelle ZZZ ("Non spécifié") créé en migration 019 pour router les
// pays vides ou inattendus sans rejeter la ligne d'import (décision Carlos
// Option B). Un libellé inattendu est routé vers ZZZ + log warning.
// ─────────────────────────────────────────────────────────────────────────────

export const CODE_PAYS_NON_SPECIFIE = 'ZZZ';

const PAYS_BRUT = {
  Albanie: 'ALB',
  Andorre: 'AND',
  Argentine: 'ARG',
  Arménie: 'ARM',
  Barbade: 'BRB',
  Belgique: 'BEL',
  Bénin: 'BEN',
  Brésil: 'BRA',
  Bulgarie: 'BGR',
  'Burkina Faso': 'BFA',
  Burundi: 'BDI',
  'Cabo Verde': 'CPV',
  'Cap Vert': 'CPV',
  '6Cap Vert': 'CPV', // typo récurrente
  'Cape Verde': 'CPV', // variante anglophone
  'Cap Verde': 'CPV', // variante orthographique
  Cambodge: 'KHM',
  Cambodia: 'KHM', // variante anglophone
  Cameroun: 'CMR',
  Cameroon: 'CMR', // variante anglophone vue dans structures CSV
  Canada: 'CAN',
  Centrafrique: 'CAF',
  'République centrafricaine': 'CAF',
  'République Centrafricaine': 'CAF',
  Comores: 'COM',
  Comoros: 'COM', // variante anglophone
  Congo: 'COG',
  'Congo (RD)': 'COD',
  'Congo RD': 'COD',
  'Congo RDC': 'COD',
  'Congo (République démocratique)': 'COD',
  'République démocratique du Congo': 'COD',
  'République Démocratique du Congo': 'COD',
  "Côte d'Ivoire": 'CIV',
  'Côte d’Ivoire': 'CIV', // apostrophe Unicode
  Djibouti: 'DJI',
  Dominique: 'DOM',
  Égypte: 'EGY',
  Egypte: 'EGY',
  Egypt: 'EGY', // variante anglophone
  Éthiopie: 'ETH',
  Ethiopie: 'ETH',
  Ethiopia: 'ETH',
  'États-Unis': 'USA',
  'Etats-Unis': 'USA',
  'United States': 'USA',
  France: 'FRA',
  Gabon: 'GAB',
  Ghana: 'GHA',
  Grèce: 'GRC',
  Guinée: 'GIN',
  'Guinée-Bissau': 'GNB',
  'Guinée équatoriale': 'GNQ',
  Haïti: 'HTI',
  Italie: 'ITA',
  Kenya: 'KEN',
  Laos: 'LAO',
  Liban: 'LBN',
  Luxembourg: 'LUX',
  'Macédoine du Nord': 'MKD',
  Madagascar: 'MDG',
  Madasgacar: 'MDG', // typo récurrente
  Mali: 'MLI',
  Malte: 'MLT',
  Maroc: 'MAR',
  Maurice: 'MUS',
  Mauritius: 'MUS', // variante anglophone
  Mauritanie: 'MRT',
  Moldavie: 'MDA',
  Monaco: 'MCO',
  Niger: 'NER',
  Roumanie: 'ROU',
  Rwanda: 'RWA',
  'Sainte-Lucie': 'LCA',
  'Sainte Lucie': 'LCA',
  'São Tomé-et-Príncipe': 'STP',
  Sénégal: 'SEN',
  Serbie: 'SRB',
  Seychelles: 'SYC',
  Suisse: 'CHE',
  Switzerland: 'CHE', // variante anglophone
  Tchad: 'TCD',
  Togo: 'TGO',
  Tunisie: 'TUN',
  Ukraine: 'UKR',
  Vanuatu: 'VUT',
  Vietnam: 'VNM',
  'Viêt Nam': 'VNM',
};

// Construit aussi une variante normalisée (sans accent, casse) pour le lookup
// fuzzy quand le CSV contient des libellés inattendus.
const PAYS_NORM_VERS_CODE = (() => {
  const map = new Map();
  for (const [libelle, code] of Object.entries(PAYS_BRUT)) {
    map.set(libelle, code);
    map.set(normaliser(libelle), code);
  }
  return map;
})();

function normaliser(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Retourne le code ISO 3 lettres correspondant au libellé. Hotfix v1.2.6 :
 * fallback sur ZZZ ("Non spécifié") au lieu de null pour ne pas rejeter la
 * ligne d'import (décision Carlos « Option B »). L'appelant peut tracer
 * le mapping fallback via la valeur de retour `{ code, fallback }` du
 * helper `paysCodeAvecTrace`.
 */
export function paysCode(libelle) {
  if (!libelle) return CODE_PAYS_NON_SPECIFIE;
  const trim = libelle.trim();
  if (trim === '') return CODE_PAYS_NON_SPECIFIE;
  if (PAYS_NORM_VERS_CODE.has(trim)) return PAYS_NORM_VERS_CODE.get(trim);
  return PAYS_NORM_VERS_CODE.get(normaliser(trim)) ?? CODE_PAYS_NON_SPECIFIE;
}

/** Variante avec trace explicite pour les rapports d'import. */
export function paysCodeAvecTrace(libelle) {
  if (!libelle || libelle.trim() === '') {
    return { code: CODE_PAYS_NON_SPECIFIE, fallback: true, raison: 'libelle_vide' };
  }
  const trim = libelle.trim();
  const direct = PAYS_NORM_VERS_CODE.get(trim);
  if (direct) return { code: direct, fallback: false, raison: null };
  const norm = PAYS_NORM_VERS_CODE.get(normaliser(trim));
  if (norm) return { code: norm, fallback: false, raison: null };
  return {
    code: CODE_PAYS_NON_SPECIFIE,
    fallback: true,
    raison: `libelle_inconnu:${trim}`,
  };
}

/** Map sexe CSV (F/H/Femme/Homme) → enum BDD (F/M). */
export function sexeCode(brut) {
  if (!brut) return null;
  const c = brut.trim().toUpperCase();
  if (c === 'F' || c === 'FEMME' || c === 'FÉMININ') return 'F';
  if (c === 'H' || c === 'M' || c === 'HOMME' || c === 'MASCULIN') return 'M';
  return null;
}

/** Construit une date ISO "AAAA-01-01" à partir de l'année déclarée. */
export function dateDebutFormation(annee) {
  const n = Number(annee);
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return null;
  return `${n}-01-01`;
}

/**
 * Génère un email technique unique pour les bénéficiaires sans courriel
 * (la BDD n'impose pas l'email mais la traçabilité est utile).
 * Format : prenom.nom.<index>@import-oif-2025.local
 *
 * Les emails techniques @import-oif-2025.local sont filtrés côté UI pour
 * ne pas être affichés (ils servent uniquement de placeholder unique).
 */
export function emailTechnique(prenom, nom, index) {
  const base = `${prenom ?? ''}.${nom ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${base || 'beneficiaire'}.${index}@import-oif-2025.local`;
}

/** Texte trimé ou null si vide. */
export function texteOuNull(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

/** Nombre ou null. Accepte les nombres avec virgule décimale française. */
export function nombreOuNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n =
    typeof v === 'number'
      ? v
      : Number(
          String(v)
            .replace(/\s/g, '')
            .replace(',', '.')
            .replace(/[^\d.-]/g, ''),
        );
  return Number.isFinite(n) ? n : null;
}
