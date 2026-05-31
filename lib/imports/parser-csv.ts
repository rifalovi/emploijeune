import { parse } from 'csv-parse/sync';
import { detecterEnTetesFlexibles } from './smart-mapper';
import type { ParseExcelFlexibleResult } from './parser-excel-flexible';
import type { ErreurImport } from './types';

/**
 * Parser CSV tolérant — même interface que parseExcelFlexible.
 *
 * Accepte les fichiers CSV avec :
 *   - Séparateur auto-détecté (virgule, point-virgule, tabulation)
 *   - Encodage UTF-8 (avec ou sans BOM)
 *   - Guillemets simples ou doubles pour les champs contenant le séparateur
 *   - Lignes vides ignorées
 *
 * La première ligne non-vide est considérée comme l'en-tête (pas de
 * détection multi-lignes comme le parser Excel — les CSV n'ont pas de
 * bandeaux de titre ni de fusions de cellules).
 */

const PLAFOND_LIGNES = 50000;

/** Détecte le séparateur le plus probable dans les premières lignes. */
function detecterSeparateur(texte: string): string {
  const echantillon = texte.slice(0, 2000);
  const compteurs = { ';': 0, ',': 0, '\t': 0 };
  for (const c of echantillon) {
    if (c in compteurs) compteurs[c as keyof typeof compteurs]++;
  }
  if (compteurs[';'] >= compteurs[','] && compteurs[';'] >= compteurs['\t']) return ';';
  if (compteurs['\t'] >= compteurs[',']) return '\t';
  return ',';
}

export async function parseCsv(
  buffer: ArrayBuffer | Buffer,
  enTetesAttendus: ReadonlyArray<string>,
): Promise<ParseExcelFlexibleResult> {
  const erreursStructure: ErreurImport[] = [];

  // Décoder le buffer en texte UTF-8
  let texte: string;
  try {
    const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
    texte = buf.toString('utf-8');
    // Retirer le BOM si présent
    if (texte.charCodeAt(0) === 0xfeff) texte = texte.slice(1);
  } catch {
    erreursStructure.push({
      ligne: 0,
      colonne: null,
      valeur: null,
      message: 'Impossible de décoder le fichier CSV (encodage non supporté).',
    });
    return {
      lignes: [],
      headersMappesAuto: {},
      headersNonReconnus: [],
      ligneEnTeteDetectee: 0,
      erreursStructure,
    };
  }

  if (!texte.trim()) {
    erreursStructure.push({
      ligne: 0,
      colonne: null,
      valeur: null,
      message: 'Fichier CSV vide.',
    });
    return {
      lignes: [],
      headersMappesAuto: {},
      headersNonReconnus: [],
      ligneEnTeteDetectee: 0,
      erreursStructure,
    };
  }

  // Parser avec csv-parse (sync)
  const separateur = detecterSeparateur(texte);
  let records: string[][];
  try {
    records = parse(texte, {
      delimiter: separateur,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];
  } catch (e) {
    erreursStructure.push({
      ligne: 0,
      colonne: null,
      valeur: null,
      message: `Erreur de parsing CSV : ${e instanceof Error ? e.message : 'format invalide'}.`,
    });
    return {
      lignes: [],
      headersMappesAuto: {},
      headersNonReconnus: [],
      ligneEnTeteDetectee: 0,
      erreursStructure,
    };
  }

  if (records.length < 2) {
    erreursStructure.push({
      ligne: 0,
      colonne: null,
      valeur: null,
      message: 'Le fichier CSV ne contient pas assez de lignes (en-tête + données).',
    });
    return {
      lignes: [],
      headersMappesAuto: {},
      headersNonReconnus: [],
      ligneEnTeteDetectee: 0,
      erreursStructure,
    };
  }

  // Première ligne = en-têtes
  const headersLus = records[0]!.map((h) => h.trim()).filter(Boolean);

  if (headersLus.length === 0) {
    erreursStructure.push({
      ligne: 1,
      colonne: null,
      valeur: null,
      message: 'Aucun en-tête détecté dans la première ligne du CSV.',
    });
    return {
      lignes: [],
      headersMappesAuto: {},
      headersNonReconnus: [],
      ligneEnTeteDetectee: 1,
      erreursStructure,
    };
  }

  // Mapping flou des en-têtes (même algo que le parser Excel)
  const { mapping, headersMappesAuto, headersNonReconnus } = detecterEnTetesFlexibles(
    headersLus,
    enTetesAttendus,
  );

  // Construire les lignes de données
  const lignes: ParseExcelFlexibleResult['lignes'] = [];
  const nbMax = Math.min(records.length, PLAFOND_LIGNES + 1); // +1 pour l'en-tête

  for (let i = 1; i < nbMax; i++) {
    const row = records[i]!;

    // Ignorer les lignes entièrement vides
    if (row.every((cell) => !cell.trim())) continue;

    // Construire donneesBrutes (header lu → valeur)
    const donneesBrutes: Record<string, unknown> = {};
    for (let j = 0; j < headersLus.length; j++) {
      donneesBrutes[headersLus[j]!] = row[j]?.trim() || null;
    }

    // Construire donnees (header canonique → valeur via mapping)
    const donnees: Record<string, unknown> = {};
    for (let j = 0; j < headersLus.length; j++) {
      const headerLu = headersLus[j]!;
      const headerCanonique = mapping.get(headerLu);
      if (headerCanonique) {
        donnees[headerCanonique] = row[j]?.trim() || null;
      }
    }

    lignes.push({
      numLigne: i + 1, // +1 car ligne 1 = en-tête (numérotation humaine)
      donnees,
      donneesBrutes,
    });
  }

  if (records.length > PLAFOND_LIGNES + 1) {
    erreursStructure.push({
      ligne: PLAFOND_LIGNES + 1,
      colonne: null,
      valeur: null,
      message: `Le fichier dépasse ${PLAFOND_LIGNES.toLocaleString('fr-FR')} lignes — seules les ${PLAFOND_LIGNES.toLocaleString('fr-FR')} premières sont traitées.`,
    });
  }

  return {
    lignes,
    headersMappesAuto,
    headersNonReconnus,
    ligneEnTeteDetectee: 1,
    erreursStructure,
  };
}
