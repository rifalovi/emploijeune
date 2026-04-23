/**
 * Table de correspondance `code_iso_3 → indicatif téléphonique international`
 * pour les 61 pays de la nomenclature OIF (seed SQL).
 *
 * Source : indicatifs ITU-T E.164 pour chaque pays.
 * Mis à jour sur la base de la nomenclature pays du template V1 OIF.
 *
 * Emoji drapeau : dérivé du code ISO-2 correspondant via offset Regional
 * Indicator Symbol (U+1F1E6 pour A). Fonction utilitaire `emojiDrapeau`.
 */

type PaysTelephone = {
  /** Code ISO-3 (identique à la clé primaire de public.pays). */
  code_iso: string;
  /** Code ISO-2 pour le rendu emoji drapeau. */
  code_iso2: string;
  /** Libellé court en français. */
  libelle: string;
  /** Indicatif téléphonique international (avec +). */
  indicatif: string;
};

export const INDICATIFS_PAYS: Record<string, PaysTelephone> = {
  ALB: { code_iso: 'ALB', code_iso2: 'AL', libelle: 'Albanie', indicatif: '+355' },
  AND: { code_iso: 'AND', code_iso2: 'AD', libelle: 'Andorre', indicatif: '+376' },
  ARG: { code_iso: 'ARG', code_iso2: 'AR', libelle: 'Argentine', indicatif: '+54' },
  ARM: { code_iso: 'ARM', code_iso2: 'AM', libelle: 'Arménie', indicatif: '+374' },
  BRB: { code_iso: 'BRB', code_iso2: 'BB', libelle: 'Barbade', indicatif: '+1246' },
  BEL: { code_iso: 'BEL', code_iso2: 'BE', libelle: 'Belgique', indicatif: '+32' },
  BEN: { code_iso: 'BEN', code_iso2: 'BJ', libelle: 'Bénin', indicatif: '+229' },
  BRA: { code_iso: 'BRA', code_iso2: 'BR', libelle: 'Brésil', indicatif: '+55' },
  BGR: { code_iso: 'BGR', code_iso2: 'BG', libelle: 'Bulgarie', indicatif: '+359' },
  BFA: { code_iso: 'BFA', code_iso2: 'BF', libelle: 'Burkina Faso', indicatif: '+226' },
  BDI: { code_iso: 'BDI', code_iso2: 'BI', libelle: 'Burundi', indicatif: '+257' },
  CPV: { code_iso: 'CPV', code_iso2: 'CV', libelle: 'Cabo Verde', indicatif: '+238' },
  KHM: { code_iso: 'KHM', code_iso2: 'KH', libelle: 'Cambodge', indicatif: '+855' },
  CMR: { code_iso: 'CMR', code_iso2: 'CM', libelle: 'Cameroun', indicatif: '+237' },
  CAN: { code_iso: 'CAN', code_iso2: 'CA', libelle: 'Canada', indicatif: '+1' },
  CAF: { code_iso: 'CAF', code_iso2: 'CF', libelle: 'Centrafrique', indicatif: '+236' },
  COM: { code_iso: 'COM', code_iso2: 'KM', libelle: 'Comores', indicatif: '+269' },
  COG: { code_iso: 'COG', code_iso2: 'CG', libelle: 'Congo', indicatif: '+242' },
  COD: { code_iso: 'COD', code_iso2: 'CD', libelle: 'Congo (RDC)', indicatif: '+243' },
  CIV: { code_iso: 'CIV', code_iso2: 'CI', libelle: "Côte d'Ivoire", indicatif: '+225' },
  DJI: { code_iso: 'DJI', code_iso2: 'DJ', libelle: 'Djibouti', indicatif: '+253' },
  DOM: { code_iso: 'DOM', code_iso2: 'DM', libelle: 'Dominique', indicatif: '+1767' },
  EGY: { code_iso: 'EGY', code_iso2: 'EG', libelle: 'Égypte', indicatif: '+20' },
  FRA: { code_iso: 'FRA', code_iso2: 'FR', libelle: 'France', indicatif: '+33' },
  GAB: { code_iso: 'GAB', code_iso2: 'GA', libelle: 'Gabon', indicatif: '+241' },
  GHA: { code_iso: 'GHA', code_iso2: 'GH', libelle: 'Ghana', indicatif: '+233' },
  GRC: { code_iso: 'GRC', code_iso2: 'GR', libelle: 'Grèce', indicatif: '+30' },
  GIN: { code_iso: 'GIN', code_iso2: 'GN', libelle: 'Guinée', indicatif: '+224' },
  GNB: { code_iso: 'GNB', code_iso2: 'GW', libelle: 'Guinée-Bissau', indicatif: '+245' },
  GNQ: { code_iso: 'GNQ', code_iso2: 'GQ', libelle: 'Guinée équatoriale', indicatif: '+240' },
  HTI: { code_iso: 'HTI', code_iso2: 'HT', libelle: 'Haïti', indicatif: '+509' },
  ITA: { code_iso: 'ITA', code_iso2: 'IT', libelle: 'Italie', indicatif: '+39' },
  KEN: { code_iso: 'KEN', code_iso2: 'KE', libelle: 'Kenya', indicatif: '+254' },
  LAO: { code_iso: 'LAO', code_iso2: 'LA', libelle: 'Laos', indicatif: '+856' },
  LBN: { code_iso: 'LBN', code_iso2: 'LB', libelle: 'Liban', indicatif: '+961' },
  LUX: { code_iso: 'LUX', code_iso2: 'LU', libelle: 'Luxembourg', indicatif: '+352' },
  MKD: { code_iso: 'MKD', code_iso2: 'MK', libelle: 'Macédoine du Nord', indicatif: '+389' },
  MDG: { code_iso: 'MDG', code_iso2: 'MG', libelle: 'Madagascar', indicatif: '+261' },
  MLI: { code_iso: 'MLI', code_iso2: 'ML', libelle: 'Mali', indicatif: '+223' },
  MLT: { code_iso: 'MLT', code_iso2: 'MT', libelle: 'Malte', indicatif: '+356' },
  MAR: { code_iso: 'MAR', code_iso2: 'MA', libelle: 'Maroc', indicatif: '+212' },
  MUS: { code_iso: 'MUS', code_iso2: 'MU', libelle: 'Maurice', indicatif: '+230' },
  MRT: { code_iso: 'MRT', code_iso2: 'MR', libelle: 'Mauritanie', indicatif: '+222' },
  MDA: { code_iso: 'MDA', code_iso2: 'MD', libelle: 'Moldavie', indicatif: '+373' },
  MCO: { code_iso: 'MCO', code_iso2: 'MC', libelle: 'Monaco', indicatif: '+377' },
  NER: { code_iso: 'NER', code_iso2: 'NE', libelle: 'Niger', indicatif: '+227' },
  ROU: { code_iso: 'ROU', code_iso2: 'RO', libelle: 'Roumanie', indicatif: '+40' },
  RWA: { code_iso: 'RWA', code_iso2: 'RW', libelle: 'Rwanda', indicatif: '+250' },
  LCA: { code_iso: 'LCA', code_iso2: 'LC', libelle: 'Sainte-Lucie', indicatif: '+1758' },
  STP: { code_iso: 'STP', code_iso2: 'ST', libelle: 'São Tomé-et-Príncipe', indicatif: '+239' },
  SEN: { code_iso: 'SEN', code_iso2: 'SN', libelle: 'Sénégal', indicatif: '+221' },
  SRB: { code_iso: 'SRB', code_iso2: 'RS', libelle: 'Serbie', indicatif: '+381' },
  SYC: { code_iso: 'SYC', code_iso2: 'SC', libelle: 'Seychelles', indicatif: '+248' },
  CHE: { code_iso: 'CHE', code_iso2: 'CH', libelle: 'Suisse', indicatif: '+41' },
  TCD: { code_iso: 'TCD', code_iso2: 'TD', libelle: 'Tchad', indicatif: '+235' },
  TGO: { code_iso: 'TGO', code_iso2: 'TG', libelle: 'Togo', indicatif: '+228' },
  TUN: { code_iso: 'TUN', code_iso2: 'TN', libelle: 'Tunisie', indicatif: '+216' },
  UKR: { code_iso: 'UKR', code_iso2: 'UA', libelle: 'Ukraine', indicatif: '+380' },
  VUT: { code_iso: 'VUT', code_iso2: 'VU', libelle: 'Vanuatu', indicatif: '+678' },
  VNM: { code_iso: 'VNM', code_iso2: 'VN', libelle: 'Viêt Nam', indicatif: '+84' },
  USA: { code_iso: 'USA', code_iso2: 'US', libelle: 'États-Unis', indicatif: '+1' },
};

/**
 * Les 5 pays OIF les plus fréquents dans les partenariats emploi jeunes —
 * utilisés comme défaut du picker si aucun contexte (hors mode à la chaîne).
 */
export const PAYS_PICKER_DEFAUT = ['MLI', 'BFA', 'HTI', 'KHM', 'MDG'] as const;

/**
 * Convertit un code ISO-2 en emoji drapeau via les Regional Indicator Symbols
 * (Unicode U+1F1E6 = A, U+1F1E7 = B, etc.).
 *
 * Exemple : `emojiDrapeau('FR')` → 🇫🇷
 */
export function emojiDrapeau(codeIso2: string): string {
  if (codeIso2.length !== 2) return '';
  const OFFSET = 0x1f1e6 - 'A'.charCodeAt(0);
  return Array.from(codeIso2.toUpperCase())
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + OFFSET))
    .join('');
}

/**
 * Liste triée par longueur décroissante des indicatifs connus OIF.
 * Permet un matching ambigu-robuste : `+1246` (Barbade) prime sur `+1` (Canada)
 * quand la chaîne commence par `+1246...`.
 */
const INDICATIFS_CONNUS_LONG_FIRST: string[] = Array.from(
  new Set(Object.values(INDICATIFS_PAYS).map((p) => p.indicatif)),
).sort((a, b) => b.length - a.length);

/**
 * Remplace (ou prépend) l'indicatif téléphonique dans une chaîne.
 *
 * Logique :
 *   - `valeur` vide → renvoie `indicatif` seul
 *   - `valeur` commence par un indicatif OIF connu (ex. `+226...`) → remplace
 *     cet indicatif (et garde le reste du numéro)
 *   - `valeur` commence par `+` + chiffres non listés → remplace au plus les
 *     4 premiers chiffres (heuristique E.164)
 *   - Sinon → prépend `indicatif` à la valeur existante
 *
 * @example appliquerIndicatif('+22676123456', '+223') → '+22376123456'
 * @example appliquerIndicatif('', '+226') → '+226'
 * @example appliquerIndicatif('76123456', '+226') → '+22676123456'
 */
export function appliquerIndicatif(valeur: string, indicatif: string): string {
  const clean = valeur.trim();
  if (!clean) return indicatif;

  // 1. Matching par liste des indicatifs OIF connus (longueur décroissante)
  for (const connu of INDICATIFS_CONNUS_LONG_FIRST) {
    if (clean.startsWith(connu)) {
      return indicatif + clean.slice(connu.length);
    }
  }

  // 2. Heuristique : si commence par +XX...X, retirer au plus 4 digits
  const fallbackMatch = clean.match(/^\+\d{1,4}/);
  if (fallbackMatch) {
    return indicatif + clean.slice(fallbackMatch[0].length);
  }

  // 3. Prépendre
  return `${indicatif}${clean}`;
}
