/**
 * Normalisation des valeurs parasites (placeholders sans valeur métier).
 *
 * "Valeur parasite" = chaîne saisie mécaniquement sans information réelle :
 * ZZZ, N/A, ---, xxx, 000, inconnu, test, etc.
 *
 * Convention : toute valeur parasite est convertie en `null` (champ vide).
 * Utilisé à deux niveaux :
 *   1. IMPORT-TIME  — nettoyerLigneImport() est appelé avant mappage BDD
 *   2. BATCH BDD    — estValeurParasite() + CHAMPS_TEXTE pour le scan admin
 */

// =============================================================================
// Liste d'exactes (comparaison lowercase + trim)
// =============================================================================

/**
 * Valeurs exactes considérées comme placeholder.
 * La comparaison est effectuée après trim() + toLowerCase().
 */
export const GARBAGE_EXACT: ReadonlySet<string> = new Set([
  // Séries de lettres répétées (toutes combinaisons jusqu'à 6 chars)
  'z', 'zz', 'zzz', 'zzzz', 'zzzzz', 'zzzzzz',
  'x', 'xx', 'xxx', 'xxxx', 'xxxxx',
  'a', 'aa', 'aaa', 'aaaa',
  'b', 'bb', 'bbb',
  'c', 'cc', 'ccc',
  'abc', 'abcd', 'azerty', 'qwerty',
  // Abréviations "pas de valeur"
  'n/a', 'na', 'n.a', 'n.a.', 'n/a.',
  'nd', 'n/d', 'n.d', 'n.d.', 'n/d.',
  'nc', 'n/c', 'n.c', 'n.c.',
  'nr', 'n/r',
  // Tirets / séparateurs
  '-', '--', '---', '----', '-----',
  '/', '//', '\\', '\\\\',
  '.', '..', '...', '.....',
  '_', '__', '___',
  '?', '??', '???', '????',
  '!', '!!',
  '0', '00', '000', '0000', '00000', '000000',
  '1',
  // Mots génériques français
  'test', 'testing', 'essai', 'exemple',
  'null', 'nil', 'none', 'void', 'empty', 'vide',
  'inconnu', 'inconnue', 'unknown', 'unkn',
  'néant', 'neant', 'rien',
  'non renseigné', 'non renseigne',
  'non défini', 'non defini',
  'non communiqué', 'non communique',
  'non précisé', 'non precise',
  'à compléter', 'a completer',
  'à renseigner', 'a renseigner',
  'à saisir', 'a saisir',
  'pas de données', 'pas de donnees',
  'sans objet', 's/o', 's.o',
  // Autres placeholders courants
  'xxx', 'yyy', 'zzz',
  'tbd', 'tba', 'tbf', 'to be defined', 'to be filled',
  'pending', 'todo', 'to do',
]);

// =============================================================================
// Patterns regex (sur la valeur trimmed, après lowercase)
// =============================================================================

const GARBAGE_REGEX: RegExp[] = [
  /^z+$/i,                  // ZZZ, zzz, ZZZZZ
  /^x+$/i,                  // XXX, xxx
  /^y+$/i,                  // YYY
  /^a+$/i,                  // aaa, AAA
  /^b+$/i,                  // bbb
  /^-+$/,                   // ---, ----
  /^\.+$/,                  // ...
  /^\?+$/,                  // ???
  /^0+$/,                   // 000, 0000
  /^[\s]+$/,                // seulement des espaces
  /^[\-_\.\/\\*#@!]+$/,     // seulement des symboles/séparateurs
  /^[=]+$/,                 // ===
  /^[+]+$/,                 // +++
  /^[~]+$/,                 // ~~~
  /^test\d*$/i,             // test, test1, test2
];

// =============================================================================
// API publique
// =============================================================================

/**
 * Détermine si une valeur texte est un placeholder sans valeur métier.
 * La comparaison est insensible à la casse et au whitespace entourant.
 */
export function estValeurParasite(v: string): boolean {
  const s = v.trim();
  if (s.length === 0) return true;
  const sl = s.toLowerCase();
  if (GARBAGE_EXACT.has(sl)) return true;
  return GARBAGE_REGEX.some((re) => re.test(sl));
}

/**
 * Retourne `null` si la valeur est parasite ou vide, sinon retourne la chaîne
 * trimmée. Accepte null/undefined → retourne null (idempotent).
 */
export function nettoyerTexte(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const trimmed = v.trim();
  if (trimmed === '') return null;
  if (estValeurParasite(trimmed)) return null;
  return trimmed;
}

/**
 * Applique `nettoyerTexte` à tous les champs string d'un enregistrement brut.
 * Les champs vides ou parasites sont ramenés à la chaîne vide `''` (compatible
 * avec les mappers d'import qui traitent `''` comme "absent").
 *
 * Utilisé dans le pipeline d'import AVANT le mapping métier.
 */
export function nettoyerLigneImport(
  ligne: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ligne)) {
    if (typeof v === 'string') {
      const net = nettoyerTexte(v);
      // '' signale "absent" aux helpers lireTexte() — identique à une cellule vide
      out[k] = net ?? '';
    } else {
      out[k] = v;
    }
  }
  return out;
}

// =============================================================================
// Configuration par table — champs texte libres à scanner en BDD
// (les champs codifiés comme projet_code, pays_code sont exclus car
//  leur validation dépend de la nomenclature, pas du filtre parasite)
// =============================================================================

export type TableCible = 'beneficiaires' | 'structures';

/**
 * Champs de texte optionnels (nullable en BDD) → peuvent être mis à NULL
 * automatiquement lors du nettoyage batch.
 */
export const CHAMPS_TEXTE_NULLABLE: Record<TableCible, ReadonlyArray<string>> = {
  beneficiaires: [
    'fonction_actuelle',
    'intitule_formation',
    'localite_residence',
    'partenaire_accompagnement',
    'telephone',
    'courriel',
    'tranche_age_declaree',
    'commentaire',
  ],
  structures: [
    'porteur_prenom',
    'fonction_porteur',
    'adresse',
    'localite',
    'ville',
    'secteur_precis',
    'intitule_initiative',
    'telephone_porteur',
    'courriel_porteur',
    'commentaire',
  ],
};

/**
 * Champs de texte obligatoires (NOT NULL en BDD) → ne peuvent PAS être mis à NULL.
 * Ils sont signalés dans le rapport de scan mais nécessitent une correction manuelle.
 */
export const CHAMPS_TEXTE_OBLIGATOIRES: Record<TableCible, ReadonlyArray<string>> = {
  beneficiaires: ['prenom', 'nom'],
  structures: ['porteur_nom', 'nom_structure'],
};

/**
 * Tous les champs texte à scanner (nullable + obligatoires).
 * À utiliser pour le scan uniquement.
 */
export const CHAMPS_TEXTE: Record<TableCible, ReadonlyArray<string>> = {
  beneficiaires: [
    ...CHAMPS_TEXTE_OBLIGATOIRES.beneficiaires,
    ...CHAMPS_TEXTE_NULLABLE.beneficiaires,
  ],
  structures: [
    ...CHAMPS_TEXTE_OBLIGATOIRES.structures,
    ...CHAMPS_TEXTE_NULLABLE.structures,
  ],
};

// =============================================================================
// Types pour le rapport de scan / nettoyage
// =============================================================================

export type ValeurParasite = {
  table: TableCible;
  id: string;
  champ: string;
  valeur_actuelle: string;
  /**
   * TRUE si le champ est nullable → nettoyage auto possible (→ NULL).
   * FALSE si le champ est NOT NULL → signalé uniquement, correction manuelle requise.
   */
  auto_corrigeable: boolean;
};

export type RapportScan = {
  total_parasites: number;
  /** Nombre total auto-corrigeables (nullable). */
  total_auto_corrigeables: number;
  /** Nombre nécessitant correction manuelle (NOT NULL). */
  total_manuels: number;
  par_table: Record<TableCible, number>;
  par_champ: Record<string, number>;
  exemples: ValeurParasite[]; // max 200 pour l'UI
};

export type RapportNettoyage = {
  nb_champs_nettoyes: number;
  nb_enregistrements_affectes: number;
  par_table: Record<TableCible, number>;
  execute_a: string;
};
