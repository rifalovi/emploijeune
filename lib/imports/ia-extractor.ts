import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { extractText, getDocumentProxy } from 'unpdf';
import { importIaActifPourCourant } from './ia-mapper';
import {
  normaliserCodePays,
  normaliserCodeProjet,
  normaliserDomaineFormation,
  normaliserSexe,
} from './smart-mapper';
import { resoudreTrancheAge } from './tranche-age-resolver';

/**
 * Phase 2 du sprint Import IA — extraction de bénéficiaires depuis des
 * documents non-structurés (PDF, DOCX, TXT).
 *
 * Cible : les coordinateurs de projet qui envoient parfois des listes au
 * format Word ou des rapports PDF au lieu du Template Excel officiel.
 * L'IA tente d'extraire les bénéficiaires mentionnés et de les structurer
 * pour pouvoir les passer dans le pipeline d'import classique.
 *
 * Modèle : Claude Haiku 4.5 — la tâche est extraction structurée, pas
 * raisonnement complexe.
 *
 * Limites :
 *   - Pas d'OCR sur les images scannées (PDF avec scans = texte vide).
 *   - Max 100 lignes extraites par appel (sinon erreur explicite).
 *   - Max 50 KB de texte source envoyé à Claude (évite les coûts massifs).
 *   - Timeout 30s.
 *   - Le module `import_ia` doit être actif pour le rôle de l'utilisateur.
 *
 * Sécurité PII :
 *   Cette fonction envoie OBLIGATOIREMENT le texte source à Claude — le
 *   document peut contenir des PII (noms, courriels). C'est l'usage cible
 *   du module. Le DPA Anthropic couvre ces transmissions. Aucun stockage
 *   local du texte source au-delà de la durée de l'appel. À documenter
 *   dans la CGU de la plateforme.
 */

const TIMEOUT_MS = 30_000;
const MAX_TEXTE_SOURCE = 50_000; // ~12k tokens, raisonnable pour Haiku
const MAX_LIGNES_EXTRAITES = 100;

export type FormatFichier = 'pdf' | 'docx' | 'txt' | 'xlsx';

export type LigneExtraite = {
  /** Données déjà passées dans le smart-mapper (codes normalisés). */
  donnees: Record<string, unknown>;
  /** Score de confiance par ligne 0..100. */
  confiance: number;
};

export type ExtraireResult =
  | { status: 'desactive'; message: string }
  | { status: 'erreur'; message: string }
  | {
      status: 'succes';
      lignesExtraites: LigneExtraite[];
      /** Score de confiance global agrégé (0..100). */
      confiance: number;
      /** Note explicative de ce que l'IA a fait. */
      notes: string;
      /** Nombre total de tokens consommés (audit). */
      tokens_utilises: number;
    };

/**
 * Extrait les bénéficiaires d'un document non-structuré.
 */
export async function extraireAvecIA(
  fichierBuffer: Buffer | ArrayBuffer,
  fichierNom: string,
  fichierType: FormatFichier,
): Promise<ExtraireResult> {
  // 0. Garde feature flag
  if (!(await importIaActifPourCourant())) {
    return {
      status: 'desactive',
      message:
        "Module Import IA désactivé pour votre rôle. Demandez au super_admin de l'activer dans /super-admin/modules.",
    };
  }

  // 1. Convertir le buffer en texte selon le format
  let texteSource: string;
  try {
    texteSource = await extraireTexteFichier(fichierBuffer, fichierType);
  } catch (err) {
    return {
      status: 'erreur',
      message: `Impossible d'extraire le texte du fichier : ${err instanceof Error ? err.message : 'erreur inconnue'}`,
    };
  }

  texteSource = texteSource.trim();
  if (texteSource.length === 0) {
    return {
      status: 'erreur',
      message:
        'Aucun texte exploitable dans le fichier. Pour les PDF scannés, fournissez une version texte ou utilisez un OCR au préalable.',
    };
  }

  if (texteSource.length > MAX_TEXTE_SOURCE) {
    return {
      status: 'erreur',
      message: `Texte source trop volumineux (${texteSource.length} car. > ${MAX_TEXTE_SOURCE}). Scindez le document.`,
    };
  }

  // 2. Préparer l'appel Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: 'erreur', message: 'Clé API Anthropic non configurée.' };
  }

  const prompt = construirePrompt(texteSource, fichierNom);
  const client = new Anthropic({ apiKey });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Anthropic.Messages.Message;
  try {
    response = await client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 'erreur',
        message: 'Extraction IA expirée (>30s). Réessayez avec un document plus court.',
      };
    }
    return {
      status: 'erreur',
      message: `Erreur Claude API : ${err instanceof Error ? err.message : 'inconnue'}`,
    };
  }

  // 3. Parser la réponse
  const texteReponse = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n');

  const lignesBrutes = parserReponseClaude(texteReponse);
  if (lignesBrutes === null) {
    return {
      status: 'erreur',
      message: 'Réponse Claude inintelligible (JSON invalide ou structure inattendue).',
    };
  }

  if (lignesBrutes.length === 0) {
    return {
      status: 'succes',
      lignesExtraites: [],
      confiance: 0,
      notes: 'Aucun bénéficiaire détecté dans le document.',
      tokens_utilises: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  if (lignesBrutes.length > MAX_LIGNES_EXTRAITES) {
    return {
      status: 'erreur',
      message: `Trop de bénéficiaires détectés (${lignesBrutes.length} > ${MAX_LIGNES_EXTRAITES}). Scindez le document.`,
    };
  }

  // 4. Normaliser les valeurs via smart-mapper
  const lignesNormalisees = await Promise.all(lignesBrutes.map(normaliserLigneExtraite));

  // 5. Calculer le score de confiance global
  const confiance = calculerConfianceGlobale(lignesNormalisees);

  return {
    status: 'succes',
    lignesExtraites: lignesNormalisees,
    confiance,
    notes: construireNotes(lignesNormalisees, fichierType),
    tokens_utilises: response.usage.input_tokens + response.usage.output_tokens,
  };
}

// =============================================================================
// Helpers internes
// =============================================================================

async function extraireTexteFichier(
  fichierBuffer: Buffer | ArrayBuffer,
  fichierType: FormatFichier,
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
      // unpdf : extraction texte sans OCR (PDFs scannés non supportés)
      const uint8 = new Uint8Array(buf);
      const pdf = await getDocumentProxy(uint8);
      const { text } = await extractText(pdf, { mergePages: true });
      return Array.isArray(text) ? text.join('\n') : text;
    }

    case 'xlsx': {
      // ExcelJS : conversion en texte tabulaire lisible par Claude.
      // Chaque feuille est rendue avec les en-têtes en première ligne,
      // puis les données séparées par des tabulations.
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buf as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      const lignes: string[] = [];
      workbook.eachSheet((worksheet) => {
        lignes.push(`=== Feuille : ${worksheet.name} ===`);
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          const valeurs = (row.values as (ExcelJS.CellValue | null)[])
            .slice(1) // ExcelJS commence à l'index 1
            .map((v) => {
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
  return `Tu es un expert en extraction de données de bénéficiaires pour l'OIF (Organisation Internationale de la Francophonie).

Analyse le document ci-dessous et extrais les données de chaque bénéficiaire mentionné.

Pour chaque bénéficiaire, retourne un objet JSON avec ces champs (utilise null si une information est absente, ne devine pas) :
  - "projet"       : code ou nom du projet OIF (ex. "P14", "PROJ_A14", "La Francophonie avec Elles")
  - "pays"         : pays de provenance (libellé français ou code ISO-3)
  - "prenom"       : prénom (string, conservé tel que dans le document)
  - "nom"          : nom de famille
  - "sexe"         : "M", "F" ou "Autre"
  - "tranche_age"  : "Jeune" (18-34 ans) ou "Adulte" (35+)
  - "domaine_formation" : domaine ou type de formation suivi (ex. "Numérique", "Agriculture")
  - "annee_formation"   : année (nombre entier)
  - "courriel"     : adresse email si présente
  - "telephone"    : numéro téléphone avec indicatif
  - "organisation" : structure d'accompagnement

Règles strictes :
  - Réponds UNIQUEMENT par un tableau JSON valide, sans préambule, sans markdown, sans commentaires.
  - Si AUCUN bénéficiaire n'est détecté, retourne [] (tableau vide).
  - Ne devine pas : si une info n'est pas explicite, mets null.
  - Maximum ${MAX_LIGNES_EXTRAITES} bénéficiaires par réponse.

Document source (fichier : ${fichierNom}) :
---
${texteSource}
---`;
}

type LigneBrute = {
  projet?: string | null;
  pays?: string | null;
  prenom?: string | null;
  nom?: string | null;
  sexe?: string | null;
  tranche_age?: string | null;
  domaine_formation?: string | null;
  annee_formation?: number | null;
  courriel?: string | null;
  telephone?: string | null;
  organisation?: string | null;
};

function parserReponseClaude(texte: string): LigneBrute[] | null {
  const matchJson = texte.match(/\[[\s\S]*\]/);
  if (!matchJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(matchJson[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.filter((item) => item && typeof item === 'object') as LigneBrute[];
}

async function normaliserLigneExtraite(brute: LigneBrute): Promise<LigneExtraite> {
  // Normalisation via smart-mapper réutilisé (Phase 1)
  const projet = normaliserCodeProjet(brute.projet);
  const pays = normaliserCodePays(brute.pays);
  const sexe = normaliserSexe(brute.sexe);
  const trancheResult = await resoudreTrancheAge(brute.tranche_age);
  const tranche = trancheResult?.categorie ?? null;
  const domaine = normaliserDomaineFormation(brute.domaine_formation);

  // Mapping vers les en-têtes du Template (pour passage direct au pipeline
  // d'import classique sans transformation supplémentaire)
  const donnees: Record<string, unknown> = {
    'Code projet *': projet ?? brute.projet ?? null,
    'Code pays bénéficiaire *': pays ?? brute.pays ?? null,
    'Prénom *': brute.prenom ?? null,
    'Nom *': brute.nom ?? null,
    'Sexe *': sexe ?? brute.sexe ?? null,
    "Tranche d'âge déclarée": tranche,
    'Domaine de formation *': domaine ?? null,
    'Année de la formation *': brute.annee_formation ?? null,
    Courriel: brute.courriel ?? null,
    'Téléphone (avec indicatif)': brute.telephone ?? null,
    "Partenaire d'accompagnement": brute.organisation ?? null,
  };

  // Confiance par ligne : compte des champs cruciaux bien normalisés
  let score = 0;
  let total = 0;
  if (projet) score += 25;
  total += 25;
  if (pays) score += 25;
  total += 25;
  if (brute.prenom) score += 10;
  total += 10;
  if (brute.nom) score += 10;
  total += 10;
  if (sexe) score += 10;
  total += 10;
  if (domaine || tranche) score += 10;
  total += 10;
  if (brute.annee_formation) score += 10;
  total += 10;

  return {
    donnees,
    confiance: total > 0 ? Math.round((score / total) * 100) : 0,
  };
}

function calculerConfianceGlobale(lignes: LigneExtraite[]): number {
  if (lignes.length === 0) return 0;
  const moyenne = lignes.reduce((acc, l) => acc + l.confiance, 0) / lignes.length;
  return Math.round(moyenne);
}

function construireNotes(lignes: LigneExtraite[], format: FormatFichier): string {
  const formatLabel =
    format === 'pdf'
      ? 'PDF'
      : format === 'docx'
        ? 'Word (DOCX)'
        : format === 'xlsx'
          ? 'Excel (analyse IA)'
          : 'texte brut';
  const nbProjetsReconnus = lignes.filter((l) => l.donnees['Code projet *']).length;
  const nbPaysReconnus = lignes.filter((l) => l.donnees['Code pays bénéficiaire *']).length;

  return `Extrait ${lignes.length} bénéficiaire(s) depuis le fichier ${formatLabel}. Codes projets reconnus : ${nbProjetsReconnus}/${lignes.length}. Pays reconnus : ${nbPaysReconnus}/${lignes.length}. Les valeurs non reconnues restent en texte libre — l'utilisateur peut les corriger avant insertion.`;
}
