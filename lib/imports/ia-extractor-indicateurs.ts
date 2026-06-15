import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { extractText, getDocumentProxy } from 'unpdf';
import { INDICATEURS, indicateurParCode } from '@/lib/referentiels/indicateurs';

/**
 * Extraction des VALEURS D'INDICATEURS (synthèse d'ensemble) depuis un rapport
 * d'étude/d'enquête non structuré (PDF, DOCX, TXT) ou un tableau Excel.
 *
 * Cible : les indicateurs NON auto-calculables (A2..A5, B2..B4, C*, D*, F1)
 * dont les valeurs proviennent d'enquêtes terrain consolidées dans un rapport
 * SCS. L'IA repère, pour chaque indicateur du cadre commun, la valeur
 * « Ensemble » (tous projets) et l'année de référence.
 *
 * Les indicateurs A1 et B1 (calculés automatiquement depuis la base) sont
 * marqués `auto = true` afin que l'UI les écarte par défaut.
 *
 * Modèle : Claude Sonnet 4.5 — extraction structurée fiable.
 */

const TIMEOUT_MS = 45_000;
const MAX_TEXTE_SOURCE = 1_000_000;
const anneeCourante = new Date().getFullYear();

export type FormatRapport = 'pdf' | 'docx' | 'txt' | 'xlsx';

export type ValeurIndicateurExtraite = {
  code: string;
  libelle: string;
  annee: number;
  /** Valeur d'ensemble : pour un taux, le pourcentage SANS le signe % (ex. 88.4). */
  valeur: number;
  /** True si l'indicateur s'exprime en pourcentage. */
  est_taux: boolean;
  /** True pour A1/B1 (calculés automatiquement) → à écarter par défaut. */
  auto: boolean;
  note: string;
  confiance: number;
};

export type ExtraireIndicateursResult =
  | { status: 'erreur'; message: string }
  | {
      status: 'succes';
      valeurs: ValeurIndicateurExtraite[];
      notes: string;
      tokens_utilises: number;
    };

const CODES_VALIDES = new Set(INDICATEURS.map((i) => i.code));
const CODES_AUTO = new Set(
  INDICATEURS.filter((i) => i.donneeLiveCle).map((i) => i.code), // A1, B1
);
/**
 * Indicateurs exprimés en pourcentage (le référentiel ne les marque pas tous
 * via unitePrincipale). On détecte aussi « taux » dans l'intitulé en complément.
 */
const CODES_POURCENTAGE = new Set(['A2', 'A3', 'A4', 'A5', 'B2', 'C2', 'F1']);

function estIndicateurTaux(code: string, intitule: string, uniteEstPourcent: boolean): boolean {
  return uniteEstPourcent || CODES_POURCENTAGE.has(code) || /\btaux\b/i.test(intitule);
}

export async function extraireIndicateursAvecIA(
  fichierBuffer: Buffer | ArrayBuffer,
  fichierNom: string,
  fichierType: FormatRapport,
): Promise<ExtraireIndicateursResult> {
  let texteSource: string;
  try {
    texteSource = (await extraireTexteFichier(fichierBuffer, fichierType)).trim();
  } catch (err) {
    return {
      status: 'erreur',
      message: `Impossible d'extraire le texte du fichier : ${err instanceof Error ? err.message : 'erreur inconnue'}`,
    };
  }

  if (texteSource.length === 0) {
    return {
      status: 'erreur',
      message:
        'Aucun texte exploitable dans le fichier. Pour un PDF scanné, fournissez une version texte (OCR) au préalable.',
    };
  }
  if (texteSource.length > MAX_TEXTE_SOURCE) {
    return {
      status: 'erreur',
      message: `Texte source trop volumineux (${texteSource.length} car.). Scindez le document.`,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: 'erreur', message: 'Clé API Anthropic non configurée.' };
  }

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Anthropic.Messages.Message;
  try {
    response = await client.messages.create(
      {
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content: construirePrompt(texteSource, fichierNom) }],
      },
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 'erreur',
        message: 'Extraction IA expirée (>45s). Réessayez avec un document plus court.',
      };
    }
    return {
      status: 'erreur',
      message: `Erreur Claude API : ${err instanceof Error ? err.message : 'inconnue'}`,
    };
  }

  const texteReponse = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n');

  const brutes = parserReponseClaude(texteReponse);
  if (brutes === null) {
    return { status: 'erreur', message: 'Réponse Claude inintelligible (JSON invalide).' };
  }

  const valeurs: ValeurIndicateurExtraite[] = [];
  for (const b of brutes) {
    const code = typeof b.code === 'string' ? b.code.trim().toUpperCase() : '';
    if (!CODES_VALIDES.has(code)) continue;
    const valeur =
      typeof b.valeur === 'number' ? b.valeur : Number(String(b.valeur).replace(',', '.'));
    if (!Number.isFinite(valeur)) continue;
    const annee = typeof b.annee === 'number' ? b.annee : Number(b.annee);
    const anneeValide = Number.isInteger(annee) && annee >= 2020 && annee <= anneeCourante + 1;
    const def = indicateurParCode(code);
    const estTaux = estIndicateurTaux(code, def?.intitule ?? '', def?.unitePrincipale === '%');
    // Dé-doublonnage : on garde la première occurrence par code.
    if (valeurs.some((v) => v.code === code)) continue;
    valeurs.push({
      code,
      libelle: def?.labelMetrique ?? def?.intitule ?? code,
      annee: anneeValide ? annee : anneeCourante,
      // On préserve les décimales (88,4 ≠ 88) ; les effectifs restent entiers
      // car leur valeur source l'est déjà.
      valeur: Math.round(valeur * 100) / 100,
      est_taux: estTaux,
      auto: CODES_AUTO.has(code),
      note: typeof b.note === 'string' ? b.note.slice(0, 400) : '',
      confiance: anneeValide ? 90 : 60,
    });
  }

  valeurs.sort((a, b) => a.code.localeCompare(b.code));

  return {
    status: 'succes',
    valeurs,
    notes: `Extrait ${valeurs.length} valeur(s) d'indicateur depuis ${fichierNom}. Les indicateurs A1/B1 (auto-calculés) sont signalés et écartés par défaut.`,
    tokens_utilises: response.usage.input_tokens + response.usage.output_tokens,
  };
}

// =============================================================================
// Helpers
// =============================================================================

async function extraireTexteFichier(
  fichierBuffer: Buffer | ArrayBuffer,
  fichierType: FormatRapport,
): Promise<string> {
  const buf =
    fichierBuffer instanceof Buffer ? fichierBuffer : Buffer.from(new Uint8Array(fichierBuffer));

  switch (fichierType) {
    case 'txt':
      return buf.toString('utf8');
    case 'docx': {
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value;
    }
    case 'pdf': {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      return Array.isArray(text) ? text.join('\n') : text;
    }
    case 'xlsx': {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      const lignes: string[] = [];
      workbook.eachSheet((worksheet) => {
        lignes.push(`=== Feuille : ${worksheet.name} ===`);
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          const valeurs = (row.values as (ExcelJS.CellValue | null)[]).slice(1).map((v) => {
            if (v === null || v === undefined) return '';
            if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text);
            if (typeof v === 'object' && 'result' in v)
              return String((v as { result: unknown }).result ?? '');
            return String(v);
          });
          lignes.push(valeurs.join('\t'));
        });
      });
      return lignes.join('\n');
    }
  }
}

function construirePrompt(texteSource: string, fichierNom: string): string {
  const catalogue = INDICATEURS.map(
    (i) => `  - ${i.code} : ${i.intitule}${i.unitePrincipale === '%' ? ' (TAUX en %)' : ''}`,
  ).join('\n');

  return `Tu es un expert en suivi-évaluation pour l'OIF. Analyse le rapport ci-dessous et extrais, pour chaque indicateur du cadre commun, la valeur « ENSEMBLE » (tous projets confondus) — PAS les valeurs par projet.

Catalogue des indicateurs valides (utilise EXACTEMENT ces codes) :
${catalogue}

Pour chaque indicateur dont une valeur d'ensemble est présente dans le rapport, retourne un objet JSON :
  - "code"   : le code exact (ex. "A3", "B2", "F1")
  - "annee"  : l'année de référence de l'enquête/rapport (nombre entier)
  - "valeur" : la valeur d'ENSEMBLE. Pour un TAUX, donne le nombre SANS le signe % (ex. 88.4 et non "88,4%"). Pour un effectif, le nombre entier (ex. 3574).
  - "note"   : courte mention de la source/contexte (ex. "ensemble, rapport intermédiaire 2026")

Règles strictes :
  - Réponds UNIQUEMENT par un tableau JSON valide, sans préambule, sans markdown.
  - Une seule ligne par code (la valeur d'ENSEMBLE uniquement).
  - N'invente aucune valeur : si l'ensemble n'est pas donné pour un indicateur, ne l'inclus pas.
  - Convertis les nombres français ("26 084", "88,4%") en nombres JSON (26084, 88.4).

Rapport source (fichier : ${fichierNom}) :
---
${texteSource}
---`;
}

type BruteIndic = { code?: unknown; annee?: unknown; valeur?: unknown; note?: unknown };

function parserReponseClaude(texte: string): BruteIndic[] | null {
  const match = texte.match(/\[[\s\S]*\]/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.filter((x) => x && typeof x === 'object') as BruteIndic[];
}
