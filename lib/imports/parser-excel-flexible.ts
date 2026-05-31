import ExcelJS from 'exceljs';
import { detecterEnTetesFlexibles } from './smart-mapper';
import type { ErreurImport } from './types';

/**
 * Parser Excel **tolérant** pour le pipeline d'import "absorber le maximum"
 * (Phase B). Diffère de `parser-excel.ts` sur 3 axes :
 *
 *   1. **Détection auto de la ligne d'en-tête** : on parcourt les 15 premières
 *      lignes et on garde celle avec le plus de cellules non-vides (utile
 *      quand le fichier a un bandeau de titre, des fusions, ou des lignes
 *      d'instructions avant la vraie ligne d'en-tête).
 *   2. **Mapping flou des en-têtes** : via `detecterEnTetesFlexibles()` du
 *      smart-mapper, on accepte les variantes courantes ("Projet" →
 *      "Code projet *", "Pays de Provenance" → "Code pays bénéficiaire *").
 *   3. **AUCUN rejet** sur en-têtes obligatoires manquants — les colonnes
 *      manquantes sont signalées dans le rapport, et chaque ligne est traitée
 *      avec les données disponibles (l'algo de complétude décide si la ligne
 *      est `inseree`, `incomplete` ou `rejetee` selon le détail).
 */

const PLAFOND_LIGNES = 50000;
const HORIZON_LIGNE_ENTETE = 15;

/** Infos d'un onglet Excel pour la sélection multi-onglets. */
export type InfoOnglet = {
  nom: string;
  nbLignes: number;
  nbColonnes: number;
  /** Nombre d'en-têtes attendus qui matchent (fuzzy) — sert au scoring. */
  nbHeadersReconnus: number;
  /** Score 0-100 : pertinence estimée de cet onglet pour l'import. */
  score: number;
};

export type ParseExcelFlexibleResult = {
  /**
   * Lignes de données mappées sur les en-têtes canoniques (template officiel).
   * Les colonnes non reconnues sont conservées dans `donneesBrutes` pour
   * traçabilité (au cas où l'algo veut récupérer une info plus tard).
   */
  lignes: Array<{
    numLigne: number;
    /** Données indexées par l'en-tête canonique cible. */
    donnees: Record<string, unknown>;
    /** Données brutes complètes (header lu original → valeur). */
    donneesBrutes: Record<string, unknown>;
  }>;
  /** Map header lu → header canonique cible, pour les mappings non-triviaux. */
  headersMappesAuto: Record<string, string>;
  /** En-têtes du fichier qui n'ont pas pu être identifiés. */
  headersNonReconnus: string[];
  /** Numéro de ligne de l'en-tête détecté (≥ 1). */
  ligneEnTeteDetectee: number;
  /** Erreurs de structure (fichier illisible, vide, etc.). */
  erreursStructure: ErreurImport[];
};

/**
 * Liste les onglets d'un fichier Excel avec un score de pertinence pour l'import.
 * Le score est basé sur le nombre d'en-têtes reconnus par le smart-mapper.
 * L'onglet avec le meilleur score est le candidat auto-détecté.
 */
export async function listerOngletsExcel(
  buffer: ArrayBuffer | Buffer,
  enTetesAttendus: ReadonlyArray<string>,
  typeImport: TypeImport = 'beneficiaires',
): Promise<{ onglets: InfoOnglet[]; erreur?: string }> {
  const workbook = new ExcelJS.Workbook();
  const buf = buffer instanceof Buffer ? buffer : Buffer.from(new Uint8Array(buffer));

  try {
    await workbook.xlsx.load(buf as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (err) {
    return { onglets: [], erreur: `Fichier illisible : ${err instanceof Error ? err.message : 'format invalide'}` };
  }

  const onglets: InfoOnglet[] = [];
  for (const ws of workbook.worksheets) {
    const nbLignes = ws.rowCount;
    const nbColonnes = ws.columnCount;

    // Détecter la ligne d'en-tête (même algo que parseExcelFlexible)
    const horizonMax = Math.min(HORIZON_LIGNE_ENTETE, ws.rowCount);
    let meilleureLigne = 1;
    let meilleurScore = 0;
    for (let r = 1; r <= horizonMax; r++) {
      const row = ws.getRow(r);
      let cellulesNonVides = 0;
      const valeursUniques = new Set<string>();
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = extraireValeurCellule(cell);
        const s = v !== null && v !== undefined ? String(v).trim() : '';
        if (s !== '') { cellulesNonVides++; valeursUniques.add(s); }
      });
      if (cellulesNonVides > 1 && valeursUniques.size === 1) continue;
      if (cellulesNonVides > meilleurScore) { meilleurScore = cellulesNonVides; meilleureLigne = r; }
    }

    // Lire les en-têtes et scorer avec le smart-mapper
    const headerRow = ws.getRow(meilleureLigne);
    const headersLus: Array<string | null> = [];
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      const v = extraireValeurCellule(cell);
      headersLus.push(typeof v === 'string' && v.trim() ? v.trim() : v !== null ? String(v).trim() || null : null);
    });

    const { mapping } = detecterEnTetesFlexibles(headersLus, enTetesAttendus);
    const nbHeadersReconnus = mapping.size;

    // Bonus nom de feuille (+5 si contient un mot-clé pertinent pour le type)
    const nomNorm = ws.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const motsClesA = ['beneficiaire', 'individu', 'personne', 'jeune'];
    const motsClesB = ['structure', 'entreprise', 'micro', 'organisation'];
    const motsClesActifs = typeImport === 'structures' ? motsClesB : motsClesA;
    const bonusNom = motsClesActifs.some((m) => nomNorm.includes(m)) ? 5 : 0;

    const scoreBrut = enTetesAttendus.length > 0
      ? Math.round((nbHeadersReconnus / enTetesAttendus.length) * 100)
      : 0;
    const score = Math.min(scoreBrut + bonusNom, 100);

    // Nb de lignes de données (après l'en-tête)
    const nbLignesDonnees = Math.max(0, nbLignes - meilleureLigne);

    onglets.push({ nom: ws.name, nbLignes: nbLignesDonnees, nbColonnes, nbHeadersReconnus, score });
  }

  return { onglets };
}

/** Type d'import pour le bonus nom de feuille. */
export type TypeImport = 'beneficiaires' | 'structures';

export async function parseExcelFlexible(
  buffer: ArrayBuffer | Buffer,
  enTetesAttendus: ReadonlyArray<string>,
  nomOnglet?: string,
  typeImport: TypeImport = 'beneficiaires',
): Promise<ParseExcelFlexibleResult> {
  const workbook = new ExcelJS.Workbook();
  const buf = buffer instanceof Buffer ? buffer : Buffer.from(new Uint8Array(buffer));

  try {
    await workbook.xlsx.load(buf as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (err) {
    return {
      lignes: [],
      headersMappesAuto: {},
      headersNonReconnus: [],
      ligneEnTeteDetectee: 0,
      erreursStructure: [
        {
          ligne: 0,
          colonne: null,
          valeur: null,
          message: `Fichier Excel illisible : ${err instanceof Error ? err.message : 'format invalide'}`,
        },
      ],
    };
  }

  // Sélection de l'onglet : par nom si spécifié, sinon auto-détection du meilleur
  let ws = nomOnglet
    ? workbook.worksheets.find((s) => s.name === nomOnglet)
    : undefined;

  if (!ws && !nomOnglet && workbook.worksheets.length > 1) {
    // Auto-détection : scorer chaque onglet avec détection en-tête 15 lignes,
    // bonus nom de feuille, et minimum 10 lignes de données.
    let bestScore = -1;
    const feuillesInfos: string[] = [];
    for (const sheet of workbook.worksheets) {
      // Détection en-tête (même algo que le parser principal)
      const horizonMax = Math.min(HORIZON_LIGNE_ENTETE, sheet.rowCount);
      let ligneTete = 1;
      let meilleurScoreLigne = 0;
      for (let r = 1; r <= horizonMax; r++) {
        const row = sheet.getRow(r);
        let nonVides = 0;
        const vals = new Set<string>();
        row.eachCell({ includeEmpty: false }, (cell) => {
          const v = extraireValeurCellule(cell);
          const s = v !== null && v !== undefined ? String(v).trim() : '';
          if (s) { nonVides++; vals.add(s); }
        });
        if (nonVides > 1 && vals.size === 1) continue;
        if (nonVides > meilleurScoreLigne) { meilleurScoreLigne = nonVides; ligneTete = r; }
      }

      const headersLus: Array<string | null> = [];
      sheet.getRow(ligneTete).eachCell({ includeEmpty: true }, (cell) => {
        const v = extraireValeurCellule(cell);
        headersLus.push(typeof v === 'string' && v.trim() ? v.trim() : null);
      });
      const { mapping } = detecterEnTetesFlexibles(headersLus, enTetesAttendus);

      // Bonus nom de feuille (+5 si contient un mot-clé pertinent pour le type)
      const nomNorm = sheet.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const motsClesA = ['beneficiaire', 'individu', 'personne', 'jeune'];
      const motsClesB = ['structure', 'entreprise', 'micro', 'organisation'];
      const motsCles = typeImport === 'structures' ? motsClesB : motsClesA;
      const bonusNom = motsCles.some((m) => nomNorm.includes(m)) ? 5 : 0;

      const nbLignesDonnees = Math.max(0, sheet.rowCount - ligneTete);
      const score = mapping.size + bonusNom;
      feuillesInfos.push(`${sheet.name} (${nbLignesDonnees} lignes, ${mapping.size} colonnes)`);

      // Minimum 10 lignes de données pour être candidat
      if (nbLignesDonnees >= 10 && score > bestScore) {
        bestScore = score;
        ws = sheet;
      }
    }

    // Si aucun onglet n'a au moins 3 colonnes reconnues → erreur descriptive
    if (bestScore < 3) {
      return {
        lignes: [],
        headersMappesAuto: {},
        headersNonReconnus: [],
        ligneEnTeteDetectee: 0,
        erreursStructure: [{
          ligne: 0,
          colonne: null,
          valeur: null,
          message: `Aucune feuille reconnue dans ce fichier Excel. Feuilles trouvées : ${feuillesInfos.join(', ')}. Sélectionnez manuellement l'onglet à importer.`,
        }],
      };
    }
  }

  if (!ws) ws = workbook.worksheets[0];
  if (!ws) {
    return {
      lignes: [],
      headersMappesAuto: {},
      headersNonReconnus: [],
      ligneEnTeteDetectee: 0,
      erreursStructure: [
        {
          ligne: 0,
          colonne: null,
          valeur: null,
          message: 'Le classeur ne contient aucune feuille.',
        },
      ],
    };
  }

  // 1. Détecter la ligne d'en-tête : celle avec le plus de cellules non-vides
  //    dans les 15 premières lignes. Heuristique robuste face aux fichiers avec
  //    bandeau de titre, textes légaux, lignes de séparation.
  //
  //    Cas particulier — cellules fusionnées (merged cells) :
  //    ExcelJS réplique la valeur d'une cellule fusionnée dans CHAQUE colonne
  //    de la plage. Un titre sur une seule cellule fusionnée sur 14 colonnes
  //    apparaît donc avec un score de 14 — identique à la vraie ligne d'en-têtes.
  //    Correction : on disqualifie les lignes où toutes les cellules non-vides
  //    ont la MÊME valeur (signature d'une cellule fusionnée / titre répété).
  const horizonMax = Math.min(HORIZON_LIGNE_ENTETE, ws.rowCount);
  let meilleureLigne = 1;
  let meilleurScore = 0;
  for (let r = 1; r <= horizonMax; r++) {
    const row = ws.getRow(r);
    let cellulesNonVides = 0;
    const valeursUniques = new Set<string>();
    row.eachCell({ includeEmpty: false }, (cell) => {
      // Utiliser extraireValeurCellule pour gérer richText / objets ExcelJS
      const v = extraireValeurCellule(cell);
      const s = v !== null && v !== undefined ? String(v).trim() : '';
      if (s !== '') {
        cellulesNonVides++;
        valeursUniques.add(s);
      }
    });
    // Ligne fusionnée (toutes les cellules ont la même valeur) → ignorer
    if (cellulesNonVides > 1 && valeursUniques.size === 1) continue;
    if (cellulesNonVides > meilleurScore) {
      meilleurScore = cellulesNonVides;
      meilleureLigne = r;
    }
  }

  // 2. Lire les en-têtes de la ligne détectée
  //    ExcelJS peut retourner une valeur en format richText
  //    ({ richText: [{text:'...'}] }) pour les cellules avec mise en forme
  //    mixte (ex. une partie en gras). `String(v)` donnerait "[object Object]"
  //    au lieu du texte réel — on utilise extraireValeurCellule() qui gère
  //    richText, text et les autres formats ExcelJS.
  const headerRow = ws.getRow(meilleureLigne);
  const headersLus: Array<string | null> = [];
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    const v = extraireValeurCellule(cell);
    headersLus.push(
      typeof v === 'string' && v.trim() ? v.trim() : v !== null ? String(v).trim() || null : null,
    );
  });

  // 3. Appliquer le mapping flou
  const { mapping, headersMappesAuto, headersNonReconnus } = detecterEnTetesFlexibles(
    headersLus,
    enTetesAttendus,
  );

  // 4. Lire les données à partir de la ligne suivante
  const totalRows = ws.rowCount;
  const erreursStructure: ErreurImport[] = [];

  if (totalRows - meilleureLigne > PLAFOND_LIGNES) {
    erreursStructure.push({
      ligne: 0,
      colonne: null,
      valeur: null,
      message: `Trop de lignes (${totalRows - meilleureLigne}). Maximum autorisé : ${PLAFOND_LIGNES} par import. Scindez le fichier.`,
    });
    return {
      lignes: [],
      headersMappesAuto,
      headersNonReconnus,
      ligneEnTeteDetectee: meilleureLigne,
      erreursStructure,
    };
  }

  // Index header_lu → numéro de colonne (1-based pour ExcelJS)
  const indexParHeaderLu = new Map<string, number>();
  headersLus.forEach((h, i) => {
    if (h) indexParHeaderLu.set(h, i + 1);
  });

  const lignes: ParseExcelFlexibleResult['lignes'] = [];

  for (let r = meilleureLigne + 1; r <= totalRows; r++) {
    const row = ws.getRow(r);
    const donnees: Record<string, unknown> = {};
    const donneesBrutes: Record<string, unknown> = {};
    let aAuMoinsUneCellule = false;

    for (const [headerLu, colIndex] of indexParHeaderLu) {
      const cell = row.getCell(colIndex);
      const valeur = extraireValeurCellule(cell);
      if (valeur !== null && valeur !== undefined && valeur !== '') aAuMoinsUneCellule = true;
      donneesBrutes[headerLu] = valeur;
      const cible = mapping.get(headerLu);
      if (cible) donnees[cible] = valeur;
    }

    // Skip lignes 100% vides (résidu de fichier nettoyé à la main)
    if (!aAuMoinsUneCellule) continue;
    lignes.push({ numLigne: r, donnees, donneesBrutes });
  }

  return {
    lignes,
    headersMappesAuto,
    headersNonReconnus,
    ligneEnTeteDetectee: meilleureLigne,
    erreursStructure,
  };
}

/**
 * Extrait la valeur d'une cellule Excel en normalisant les types.
 * Logique identique à parser-excel.ts pour cohérence.
 */
function extraireValeurCellule(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;

  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }

  if (typeof v === 'object' && v && 'result' in v) {
    const res = (v as { result?: unknown }).result;
    if (res === null || res === undefined) return null;
    if (res instanceof Date) return res.toISOString().slice(0, 10);
    return typeof res === 'number' ? res : String(res).trim();
  }

  if (typeof v === 'object' && v && 'text' in v) {
    return String((v as { text: unknown }).text).trim();
  }

  if (typeof v === 'object' && v && 'richText' in v) {
    return (v as { richText: Array<{ text: string }> }).richText
      .map((r) => r.text)
      .join('')
      .trim();
  }

  if (typeof v === 'number') return v;
  return String(v).trim();
}
