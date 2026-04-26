import ExcelJS from 'exceljs';
import type { ErreurImport } from './types';

// Note : pas de `'server-only'` ici car les utilitaires sont aussi
// appelés depuis Vitest (tests unitaires). Le parser n'accède jamais
// à Supabase — pas de risque de fuite côté navigateur.

/**
 * Parser Excel générique pour les imports (Étape 7).
 *
 * Lit le premier worksheet, valide les en-têtes contre une liste
 * attendue, retourne les lignes sous forme `{numLigne, donnees}` où
 * `donnees` est un Record<header, valeur>.
 *
 * Limites V1 :
 *   - Lit uniquement le 1er worksheet (le template OIF n'a qu'une feuille
 *     « Bénéficiaires » ou « Structures B1 »).
 *   - Plafond 5000 lignes par import (au-delà, refus + suggestion de
 *     scinder le fichier).
 */

export type ParseExcelResult = {
  lignes: Array<{ numLigne: number; donnees: Record<string, unknown> }>;
  /** Erreurs structurelles (en-têtes manquants, format invalide). */
  erreursStructure: ErreurImport[];
};

const PLAFOND_LIGNES = 5000;

export async function parseExcel(
  buffer: ArrayBuffer | Buffer,
  enTetesAttendus: ReadonlyArray<string>,
  /** Sous-ensemble OBLIGATOIRE (les colonnes optionnelles peuvent manquer). */
  enTetesObligatoires: ReadonlyArray<string>,
): Promise<ParseExcelResult> {
  const workbook = new ExcelJS.Workbook();
  const buf = buffer instanceof Buffer ? buffer : Buffer.from(new Uint8Array(buffer));
  try {
    await workbook.xlsx.load(buf as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (err) {
    return {
      lignes: [],
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

  const ws = workbook.worksheets[0];
  if (!ws) {
    return {
      lignes: [],
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

  // Lecture des en-têtes (ligne 1)
  const headerRow = ws.getRow(1);
  const headersLus: Array<string | null> = [];
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    const v = cell.value;
    headersLus.push(typeof v === 'string' ? v.trim() : v ? String(v).trim() : null);
  });

  // Vérification des en-têtes obligatoires
  const erreursStructure: ErreurImport[] = [];
  const headersUtiles = new Set(enTetesAttendus);
  const headersPresents = new Set(headersLus.filter((h): h is string => Boolean(h)));

  for (const obligatoire of enTetesObligatoires) {
    if (!headersPresents.has(obligatoire)) {
      erreursStructure.push({
        ligne: 1,
        colonne: obligatoire,
        valeur: null,
        message: `Colonne obligatoire manquante : « ${obligatoire} ».`,
      });
    }
  }
  if (erreursStructure.length > 0) {
    return { lignes: [], erreursStructure };
  }

  // Lecture des données — colonnes mappées par leur en-tête
  const indexParEnTete = new Map<string, number>();
  headersLus.forEach((h, i) => {
    if (h && headersUtiles.has(h)) indexParEnTete.set(h, i + 1);
  });

  const lignes: Array<{ numLigne: number; donnees: Record<string, unknown> }> = [];
  const totalRows = ws.rowCount;

  if (totalRows - 1 > PLAFOND_LIGNES) {
    return {
      lignes: [],
      erreursStructure: [
        {
          ligne: 0,
          colonne: null,
          valeur: null,
          message: `Trop de lignes (${totalRows - 1}). Maximum autorisé : ${PLAFOND_LIGNES} par import. Scindez le fichier.`,
        },
      ],
    };
  }

  for (let r = 2; r <= totalRows; r++) {
    const row = ws.getRow(r);
    const donnees: Record<string, unknown> = {};
    let aAuMoinsUneCellule = false;
    for (const [header, colIndex] of indexParEnTete) {
      const cell = row.getCell(colIndex);
      const valeur = extraireValeurCellule(cell);
      if (valeur !== null && valeur !== undefined && valeur !== '') aAuMoinsUneCellule = true;
      donnees[header] = valeur;
    }
    // Ignore les lignes 100% vides (résidu de fichier nettoyé à la main)
    if (!aAuMoinsUneCellule) continue;
    lignes.push({ numLigne: r, donnees });
  }

  return { lignes, erreursStructure: [] };
}

/**
 * Extrait la valeur d'une cellule Excel en normalisant les types.
 * Date → string ISO `YYYY-MM-DD`, number reste number, formule → résultat,
 * tout le reste → string trimé ou null.
 */
function extraireValeurCellule(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;

  // Cellule date
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }

  // Formule : on prend le résultat
  if (typeof v === 'object' && v && 'result' in v) {
    const res = (v as { result?: unknown }).result;
    if (res === null || res === undefined) return null;
    if (res instanceof Date) return res.toISOString().slice(0, 10);
    return typeof res === 'number' ? res : String(res).trim();
  }

  // Hyperlink : prend le texte affiché
  if (typeof v === 'object' && v && 'text' in v) {
    return String((v as { text: unknown }).text).trim();
  }

  // RichText : concaténation
  if (typeof v === 'object' && v && 'richText' in v) {
    return (v as { richText: Array<{ text: string }> }).richText
      .map((r) => r.text)
      .join('')
      .trim();
  }

  if (typeof v === 'number') return v;
  return String(v).trim();
}
