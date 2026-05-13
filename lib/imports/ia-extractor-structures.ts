import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { extractText, getDocumentProxy } from 'unpdf';
import { importIaActifPourCourant } from './ia-mapper';
import {
  normaliserCodePays,
  normaliserCodeProjet,
  normaliserNatureAppui,
  normaliserSecteurActivite,
  normaliserSexe,
  normaliserStatutCreation,
  normaliserTypeStructure,
} from './smart-mapper';

/**
 * Extracteur IA B1 — structures depuis documents non-structurés (PDF/DOCX/TXT).
 *
 * Miroir exact de `ia-extractor.ts` (bénéficiaires A1), adapté aux champs
 * des structures partenaires B1 :
 *   nom_structure, type_structure, secteur_activite, statut_creation,
 *   annee_appui, nature_appui, montant_appui, devise, porteur_nom/prénom/sexe,
 *   projet, pays.
 *
 * Modèle : Claude Haiku 4.5 — extraction structurée, pas de raisonnement complexe.
 *
 * Limites identiques à l'extracteur A1 :
 *   - Pas d'OCR sur PDFs scannés.
 *   - Max 100 structures extraites par appel.
 *   - Max 50 KB de texte source.
 *   - Timeout 30s.
 *   - Feature flag `import_ia` requis.
 */

const TIMEOUT_MS = 30_000;
const MAX_TEXTE_SOURCE = 50_000;
const MAX_LIGNES_EXTRAITES = 100;

export type FormatFichier = 'pdf' | 'docx' | 'txt' | 'xlsx';

export type LigneExtraiteStructure = {
  /** Données normalisées prêtes pour le pipeline mapLigneVersStructure. */
  donnees: Record<string, unknown>;
  /** Score de confiance 0..100. */
  confiance: number;
};

export type ExtraireResultStructures =
  | { status: 'desactive'; message: string }
  | { status: 'erreur'; message: string }
  | {
      status: 'succes';
      lignesExtraites: LigneExtraiteStructure[];
      confiance: number;
      notes: string;
      tokens_utilises: number;
    };

/**
 * Extrait les structures partenaires d'un document non-structuré.
 */
export async function extraireStructuresAvecIA(
  fichierBuffer: Buffer | ArrayBuffer,
  fichierNom: string,
  fichierType: FormatFichier,
): Promise<ExtraireResultStructures> {
  // 0. Garde feature flag
  if (!(await importIaActifPourCourant())) {
    return {
      status: 'desactive',
      message:
        "Module Import IA désactivé pour votre rôle. Demandez au super_admin de l'activer dans /super-admin/modules.",
    };
  }

  // 1. Extraire le texte selon le format
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

  // 2. Appel Claude
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
      notes: 'Aucune structure partenaire détectée dans le document.',
      tokens_utilises: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  if (lignesBrutes.length > MAX_LIGNES_EXTRAITES) {
    return {
      status: 'erreur',
      message: `Trop de structures détectées (${lignesBrutes.length} > ${MAX_LIGNES_EXTRAITES}). Scindez le document.`,
    };
  }

  // 4. Normaliser les valeurs via smart-mapper
  const lignesNormalisees = lignesBrutes.map(normaliserLigneExtraite);

  // 5. Score de confiance global
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
      const uint8 = new Uint8Array(buf);
      const pdf = await getDocumentProxy(uint8);
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
  return `Tu es un expert en extraction de données de structures partenaires pour l'OIF (Organisation Internationale de la Francophonie).

Analyse le document ci-dessous et extrais les données de chaque structure partenaire ou bénéficiaire institutionnel mentionné.

Pour chaque structure, retourne un objet JSON avec ces champs (utilise null si une information est absente, ne devine pas) :
  - "projet"           : code ou nom du projet OIF (ex. "P19", "PROJ_A19", "La Francophonie avec Elles")
  - "pays"             : pays de la structure (libellé français ou code ISO-3)
  - "nom_structure"    : nom complet de la structure ou organisation
  - "type_structure"   : type parmi : Association, Coopérative, GIE, Micro-entreprise, Petite entreprise, Agriculture/Élevage/Pêche, Autre
  - "secteur_activite" : secteur d'activité principal (ex. "Agriculture", "Commerce", "Numérique", "Education", "Santé")
  - "statut_creation"  : "Création" (nouvelle structure), "Renforcement" (existante renforcée) ou "Relance" (relancée)
  - "annee_appui"      : année de l'appui (nombre entier, ex. 2026)
  - "nature_appui"     : type d'appui parmi : Subvention, Matériel, Formation, Mentorat, Mise en relation, Appui mixte, Autre
  - "montant_appui"    : montant numérique si mentionné (ex. 5000.00)
  - "devise"           : devise (ex. "EUR", "USD", "XOF") — null si non mentionné
  - "porteur_nom"      : nom de famille du porteur / responsable principal
  - "porteur_prenom"   : prénom du porteur
  - "porteur_sexe"     : "F", "M" ou "Autre"
  - "telephone"        : numéro téléphone avec indicatif (porteur)
  - "courriel"         : adresse email (porteur ou structure)
  - "intitule_initiative" : intitulé du projet ou de l'initiative portée par la structure

Règles strictes :
  - Réponds UNIQUEMENT par un tableau JSON valide, sans préambule, sans markdown, sans commentaires.
  - Si AUCUNE structure n'est détectée, retourne [] (tableau vide).
  - Ne devine pas : si une info n'est pas explicite dans le texte, mets null.
  - Maximum ${MAX_LIGNES_EXTRAITES} structures par réponse.
  - Les noms de colonnes dans le JSON doivent être exactement ceux listés ci-dessus.

Document source (fichier : ${fichierNom}) :
---
${texteSource}
---`;
}

type LigneBrute = {
  projet?: string | null;
  pays?: string | null;
  nom_structure?: string | null;
  type_structure?: string | null;
  secteur_activite?: string | null;
  statut_creation?: string | null;
  annee_appui?: number | null;
  nature_appui?: string | null;
  montant_appui?: number | null;
  devise?: string | null;
  porteur_nom?: string | null;
  porteur_prenom?: string | null;
  porteur_sexe?: string | null;
  telephone?: string | null;
  courriel?: string | null;
  intitule_initiative?: string | null;
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

function normaliserLigneExtraite(brute: LigneBrute): LigneExtraiteStructure {
  // Normalisation via smart-mapper
  const projet = normaliserCodeProjet(brute.projet);
  const pays = normaliserCodePays(brute.pays);
  const typeStructure = normaliserTypeStructure(brute.type_structure);
  const secteur = normaliserSecteurActivite(brute.secteur_activite);
  const statut = normaliserStatutCreation(brute.statut_creation);
  const nature = normaliserNatureAppui(brute.nature_appui);
  const sexePorteur = normaliserSexe(brute.porteur_sexe);

  // Mapping vers les en-têtes officiels du Template B1
  // (passés tels quels dans mapLigneVersStructure)
  const donnees: Record<string, unknown> = {
    'Code projet *': projet ?? brute.projet ?? null,
    'Code pays *': pays ?? brute.pays ?? null,
    'Nom structure *': brute.nom_structure ?? null,
    'Type structure *': typeStructure ?? brute.type_structure ?? null,
    'Secteur activité *': secteur ?? brute.secteur_activite ?? null,
    'Statut création *': statut ?? brute.statut_creation ?? null,
    'Année appui *': brute.annee_appui ?? null,
    'Nature appui *': nature ?? brute.nature_appui ?? null,
    'Montant appui': brute.montant_appui ?? null,
    Devise: brute.devise ?? null,
    'Porteur – nom *': brute.porteur_nom ?? null,
    'Porteur – prénom': brute.porteur_prenom ?? null,
    'Porteur – sexe *': sexePorteur ?? brute.porteur_sexe ?? null,
    'Téléphone (avec indicatif)': brute.telephone ?? null,
    'Courriel porteur': brute.courriel ?? null,
    'Intitulé initiative': brute.intitule_initiative ?? null,
    'Consentement *': null, // Non extractible depuis un document — à saisir manuellement
  };

  // Score de confiance : champs cruciaux du modèle B1
  let score = 0;
  if (projet) score += 20; // code projet reconnu
  if (pays) score += 20; // code pays reconnu
  if (brute.nom_structure) score += 20; // nom obligatoire
  if (typeStructure) score += 10; // type normalisé
  if (secteur) score += 10; // secteur normalisé
  if (brute.porteur_nom) score += 10; // porteur obligatoire
  if (sexePorteur) score += 10; // sexe porteur normalisé

  return { donnees, confiance: score };
}

function calculerConfianceGlobale(lignes: LigneExtraiteStructure[]): number {
  if (lignes.length === 0) return 0;
  const moyenne = lignes.reduce((acc, l) => acc + l.confiance, 0) / lignes.length;
  return Math.round(moyenne);
}

function construireNotes(lignes: LigneExtraiteStructure[], format: FormatFichier): string {
  const formatLabel =
    format === 'pdf'
      ? 'PDF'
      : format === 'docx'
        ? 'Word (DOCX)'
        : format === 'xlsx'
          ? 'Excel (analyse IA)'
          : 'texte brut';
  const nbProjetsReconnus = lignes.filter((l) => l.donnees['Code projet *']).length;
  const nbPaysReconnus = lignes.filter((l) => l.donnees['Code pays *']).length;
  const nbNomsReconnus = lignes.filter((l) => l.donnees['Nom structure *']).length;

  return (
    `Extrait ${lignes.length} structure(s) depuis le fichier ${formatLabel}. ` +
    `Codes projets reconnus : ${nbProjetsReconnus}/${lignes.length}. ` +
    `Pays reconnus : ${nbPaysReconnus}/${lignes.length}. ` +
    `Noms de structures : ${nbNomsReconnus}/${lignes.length}. ` +
    `Note : le champ Consentement n'est pas extractible automatiquement — les lignes apparaîtront comme "incomplètes" jusqu'à correction manuelle.`
  );
}
