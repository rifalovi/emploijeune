/**
 * Module partagé de détection et sélection de feuille Excel.
 *
 * Utilisé par les 4 pipelines d'import :
 *   - Classique bénéficiaires (parser-excel-flexible.ts)
 *   - Classique structures (parser-excel-flexible.ts)
 *   - IA bénéficiaires (ia-extractor.ts)
 *   - IA structures (ia-extractor-structures.ts)
 *
 * Un seul algorithme de scoring partagé garantit que le même onglet
 * est sélectionné quel que soit le pipeline.
 */

import type ExcelJS from 'exceljs';
import { normaliserPourComparaison } from './smart-mapper';

// ── Types ────────────────────────────────────────────────────────────────────

export type TypeImport = 'beneficiaires' | 'structures';

export type DetectionFeuille = {
  nom: string;
  lignesDonnees: number;
  score: number;
  colonnesReconnues: string[];
};

// ── Constantes ───────────────────────────────────────────────────────────────

/** Mots-clés recherchés dans les en-têtes pour scorer la pertinence. */
const MOTS_CLES_HEADERS: Record<TypeImport, string[]> = {
  beneficiaires: ['prenom', 'nom', 'sexe', 'projet', 'pays', 'formation', 'domaine', 'tranche'],
  structures: ['nom structure', 'projet', 'type', 'secteur', 'porteur', 'appui', 'montant', 'emplois'],
};

/** Mots-clés dans le nom de la feuille (bonus). */
const MOTS_CLES_NOM: Record<TypeImport, string[]> = {
  beneficiaires: ['beneficiaire', 'individu', 'sondage', 'jeune', 'personne'],
  structures: ['entreprise', 'structure', 'micro', 'organisation'],
};

const HORIZON_LIGNE_ENTETE = 15;

// ── Fonctions ────────────────────────────────────────────────────────────────

/** Extrait la valeur texte d'une cellule ExcelJS (gère richText, formulas, etc.). */
function celluleVersTexte(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('text' in v) return String((v as { text: unknown }).text).trim();
    if ('result' in v) return String((v as { result: unknown }).result ?? '').trim();
    if ('richText' in v) {
      return ((v as { richText: Array<{ text: string }> }).richText)
        .map((r) => r.text)
        .join('')
        .trim();
    }
  }
  return String(v).trim();
}

/**
 * Analyse toutes les feuilles d'un workbook et retourne un score de pertinence
 * pour chaque feuille, trié du meilleur au pire.
 */
export function detecterFeuilles(
  workbook: ExcelJS.Workbook,
  type: TypeImport,
): DetectionFeuille[] {
  const motsClesHeaders = MOTS_CLES_HEADERS[type];
  const motsClesNom = MOTS_CLES_NOM[type];
  const resultats: DetectionFeuille[] = [];

  for (const ws of workbook.worksheets) {
    // 1. Détecter la ligne d'en-tête (celle avec le plus de cellules non-vides,
    //    en excluant les lignes fusionnées)
    const horizonMax = Math.min(HORIZON_LIGNE_ENTETE, ws.rowCount);
    let ligneTete = 0;
    let meilleurScoreLigne = 0;

    for (let r = 1; r <= horizonMax; r++) {
      const row = ws.getRow(r);
      let nonVides = 0;
      const vals = new Set<string>();
      row.eachCell({ includeEmpty: false }, (cell) => {
        const s = celluleVersTexte(cell.value);
        if (s) { nonVides++; vals.add(s); }
      });
      // Exclure les lignes fusionnées (toutes les cellules = même valeur)
      if (nonVides > 1 && vals.size === 1) continue;
      if (nonVides > meilleurScoreLigne) {
        meilleurScoreLigne = nonVides;
        ligneTete = r;
      }
    }

    if (ligneTete === 0) {
      resultats.push({ nom: ws.name, lignesDonnees: 0, score: -100, colonnesReconnues: [] });
      continue;
    }

    // 2. Lire les en-têtes et chercher les mots-clés
    const headerRow = ws.getRow(ligneTete);
    const headersNorm: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      headersNorm.push(normaliserPourComparaison(celluleVersTexte(cell.value)));
    });

    const colonnesReconnues = motsClesHeaders.filter((mc) =>
      headersNorm.some((h) => h.includes(normaliserPourComparaison(mc))),
    );

    // 3. Nombre de lignes de données
    const lignesDonnees = Math.max(0, ws.rowCount - ligneTete);

    // 4. Score
    let score = colonnesReconnues.length * 10;

    // Bonus nom de feuille
    const nomNorm = normaliserPourComparaison(ws.name);
    for (const mc of motsClesNom) {
      if (nomNorm.includes(normaliserPourComparaison(mc))) { score += 5; break; }
    }

    // Pénalité si < 10 lignes de données
    if (lignesDonnees < 10) score -= 20;

    resultats.push({ nom: ws.name, lignesDonnees, score, colonnesReconnues });
  }

  return resultats.sort((a, b) => b.score - a.score);
}

/**
 * Choisit la meilleure feuille pour un type d'import donné.
 * Retourne null si aucune feuille n'atteint le seuil minimum (score >= 30, >= 3 colonnes).
 */
export function choisirMeilleureFeuille(
  workbook: ExcelJS.Workbook,
  type: TypeImport,
): { ws: ExcelJS.Worksheet | null; detections: DetectionFeuille[] } {
  const detections = detecterFeuilles(workbook, type);
  const top = detections[0];

  if (!top || top.score < 30 || top.colonnesReconnues.length < 3) {
    return { ws: null, detections };
  }

  const ws = workbook.worksheets.find((s) => s.name === top.nom) ?? null;
  return { ws, detections };
}

/**
 * Formate un message d'erreur lisible listant les feuilles analysées.
 */
export function formaterErreurFeuilles(
  type: TypeImport,
  detections: DetectionFeuille[],
): string {
  const typeLabel = type === 'beneficiaires' ? 'bénéficiaires' : 'structures';
  const liste = detections
    .map((d) => `${d.nom} : ${d.lignesDonnees} lignes, score ${d.score}${d.score === Math.max(...detections.map((x) => x.score)) && d.score > 0 ? ' (suggéré)' : ''}`)
    .join(' ; ');
  return `Aucune feuille ${typeLabel} reconnue. Feuilles analysées : ${liste}. Choisissez manuellement l'onglet dans le formulaire d'import.`;
}
