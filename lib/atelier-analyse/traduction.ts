'use server';

import Anthropic from '@anthropic-ai/sdk';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { peutAccederDataStudio } from '@/lib/super-admin/permissions';

/**
 * Traduction assistée par IA d'une base importée en langue étrangère.
 *
 * On envoie à Claude UNIQUEMENT les termes à traduire (en-têtes de colonnes +
 * modalités des colonnes catégorielles, fournis par l'endpoint
 * `/translation-terms`), jamais toute la base. Claude détecte la langue source
 * et renvoie une table de traduction (renommage d'en-têtes + remplacement de
 * valeurs), appliquée ensuite par l'endpoint `/translate`. Objectif : que la
 * suite (traitement, apurement, croisement, rapport) se fasse dans la langue
 * cible (français par défaut) SANS déformer le sens d'origine.
 */

export type TraduireTermesInput = {
  /** En-têtes de colonnes à traduire. */
  columns: string[];
  /** Modalités distinctes par colonne catégorielle : { colonne: [valeurs] }. */
  values: Record<string, string[]>;
  /** Échantillon (en-têtes + valeurs) pour aider la détection de langue. */
  sample?: string;
  /** Langue cible (par défaut « Français »). */
  langueCible?: string;
};

export type TraduireTermesResult =
  | {
      status: 'succes';
      langueDetectee: string;
      langueCible: string;
      /** { en-tête d'origine -> en-tête traduit }. */
      columnMap: Record<string, string>;
      /** { en-tête d'origine -> { valeur d'origine -> valeur traduite } }. */
      valueMaps: Record<string, Record<string, string>>;
    }
  | { status: 'erreur'; message: string };

// Bornes de sécurité : on ne soumet jamais une charge démesurée à l'IA.
const MAX_COLONNES = 200;
const MAX_VALEURS_PAR_COLONNE = 80;
const MAX_VALEURS_TOTAL = 1200;

export async function traduireTermesAction(
  input: TraduireTermesInput,
): Promise<TraduireTermesResult> {
  const utilisateur = await requireUtilisateurValide();
  if (!(await peutAccederDataStudio(utilisateur.id, utilisateur.role))) {
    return { status: 'erreur', message: 'Accès non autorisé.' };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: 'erreur', message: 'ANTHROPIC_API_KEY absente du serveur.' };
  }

  const langueCible = (input.langueCible ?? 'Français').trim() || 'Français';
  const colonnes = (input.columns ?? []).map((c) => String(c)).slice(0, MAX_COLONNES);
  if (colonnes.length === 0) {
    return { status: 'erreur', message: 'Aucune colonne à traduire.' };
  }

  // Réduit les valeurs aux bornes de coût (les colonnes de texte libre ne sont
  // de toute façon pas fournies par /translation-terms).
  const values: Record<string, string[]> = {};
  let total = 0;
  for (const col of colonnes) {
    const vals = input.values?.[col];
    if (!Array.isArray(vals) || vals.length === 0) continue;
    const bornees = vals.map((v) => String(v)).slice(0, MAX_VALEURS_PAR_COLONNE);
    if (total + bornees.length > MAX_VALEURS_TOTAL) continue;
    values[col] = bornees;
    total += bornees.length;
  }

  const system =
    'Tu es traducteur professionnel spécialisé dans les données d’enquête ' +
    '(sciences sociales, suivi-évaluation). On te donne les EN-TÊTES de colonnes et, ' +
    'pour certaines colonnes, la liste de leurs MODALITÉS (valeurs catégorielles). ' +
    `Traduis-les fidèlement vers ${langueCible}. Règles STRICTES : ` +
    '1) Préserve EXACTEMENT le sens ; ne reformule pas, n’ajoute rien, ne commente pas. ' +
    '2) Reste concis : une modalité reste une modalité (pas de phrase). ' +
    '3) Ne traduis PAS les noms propres, noms de lieux, codes, identifiants, sigles, ' +
    'adresses e-mail, URL, dates et nombres : recopie-les à l’identique. ' +
    '4) Si un terme est déjà dans la langue cible, recopie-le tel quel. ' +
    '5) Conserve la casse et la ponctuation utile. ' +
    '6) N’invente aucune clé : ne renvoie que les termes fournis. ' +
    'Détecte d’abord la langue source (un seul nom de langue, en français). ' +
    'Réponds STRICTEMENT en JSON, sans aucun texte autour, au format : ' +
    '{"langue_source":"…","colonnes":{"<orig>":"<traduit>"},' +
    '"valeurs":{"<colonne orig>":{"<valeur orig>":"<valeur traduite>"}}}.';

  const lignesValeurs = Object.entries(values)
    .map(([col, vals]) => `- ${col} : ${vals.join(' | ')}`)
    .join('\n');

  const userMessage =
    `Langue cible : ${langueCible}\n\n` +
    `EN-TÊTES DE COLONNES à traduire :\n- ${colonnes.join('\n- ')}\n\n` +
    (lignesValeurs
      ? `MODALITÉS à traduire (par colonne) :\n${lignesValeurs}\n\n`
      : 'Aucune modalité catégorielle fournie (colonnes de texte libre ou numériques).\n\n') +
    (input.sample
      ? `Échantillon pour la détection de langue :\n${input.sample.slice(0, 2000)}\n`
      : '');

  const client = new Anthropic({ apiKey });
  try {
    const reponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
    const texte = reponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();

    let langueDetectee = '';
    const columnMap: Record<string, string> = {};
    const valueMaps: Record<string, Record<string, string>> = {};
    try {
      const m = /\{[\s\S]*\}/.exec(texte);
      const parsed = JSON.parse(m ? m[0] : texte) as {
        langue_source?: unknown;
        colonnes?: unknown;
        valeurs?: unknown;
      };
      langueDetectee = typeof parsed.langue_source === 'string' ? parsed.langue_source.trim() : '';
      if (parsed.colonnes && typeof parsed.colonnes === 'object') {
        for (const [orig, trad] of Object.entries(parsed.colonnes as Record<string, unknown>)) {
          const t = String(trad ?? '').trim();
          // On ne conserve que les traductions non vides et réellement différentes.
          if (t && colonnes.includes(orig)) columnMap[orig] = t;
        }
      }
      if (parsed.valeurs && typeof parsed.valeurs === 'object') {
        for (const [col, mapping] of Object.entries(parsed.valeurs as Record<string, unknown>)) {
          if (!mapping || typeof mapping !== 'object' || !values[col]) continue;
          const sousMap: Record<string, string> = {};
          for (const [ov, tv] of Object.entries(mapping as Record<string, unknown>)) {
            const t = String(tv ?? '').trim();
            if (t) sousMap[ov] = t;
          }
          if (Object.keys(sousMap).length > 0) valueMaps[col] = sousMap;
        }
      }
    } catch {
      return {
        status: 'erreur',
        message: "La traduction IA n'a pas pu être interprétée. Réessayez.",
      };
    }

    if (Object.keys(columnMap).length === 0 && Object.keys(valueMaps).length === 0) {
      return {
        status: 'erreur',
        message: 'Aucune traduction proposée (la base est peut-être déjà dans la langue cible).',
      };
    }

    return {
      status: 'succes',
      langueDetectee: langueDetectee || 'indéterminée',
      langueCible,
      columnMap,
      valueMaps,
    };
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    let message: string;
    if (status === 401) {
      message = 'Service IA indisponible : la configuration serveur doit être mise à jour.';
    } else if (status === 429) {
      message = "Limite d'usage de l'IA atteinte. Patientez quelques minutes.";
    } else if (status === 529) {
      message = "L'IA est surchargée pour le moment. Réessayez dans un instant.";
    } else if (status && status >= 500) {
      message = 'Service IA temporairement indisponible. Réessayez dans un instant.';
    } else {
      message = e instanceof Error ? e.message : 'Erreur inconnue.';
    }
    console.error('[atelier-analyse] Échec traduction Claude', { status });
    return { status: 'erreur', message };
  }
}

// ─── Réponses ouvertes (texte libre) : traduction par lots ────────────────────

export type TraduireTextesResult =
  | { status: 'succes'; langueDetectee: string; map: Record<string, string> }
  | { status: 'erreur'; message: string };

/** Taille de lot recommandée côté client (nombre de réponses par appel IA). */
export const TAILLE_LOT_TEXTES = 60;

/**
 * Traduit UN LOT de réponses ouvertes vers la langue cible. Le client découpe la
 * liste des valeurs distinctes en lots et appelle cette action successivement,
 * puis assemble la table {original -> traduit}. Traduction fidèle, sans
 * reformulation ni ajout — le sens d'origine est préservé.
 */
export async function traduireTextesLibresAction(input: {
  textes: string[];
  langueCible?: string;
}): Promise<TraduireTextesResult> {
  const utilisateur = await requireUtilisateurValide();
  if (!(await peutAccederDataStudio(utilisateur.id, utilisateur.role))) {
    return { status: 'erreur', message: 'Accès non autorisé.' };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: 'erreur', message: 'ANTHROPIC_API_KEY absente du serveur.' };
  }
  const langueCible = (input.langueCible ?? 'Français').trim() || 'Français';
  // On borne le lot (le client envoie déjà TAILLE_LOT_TEXTES, on sécurise à 120).
  const textes = (input.textes ?? []).map((t) => String(t)).slice(0, 120);
  if (textes.length === 0) {
    return { status: 'succes', langueDetectee: '', map: {} };
  }

  const system =
    'Tu es traducteur professionnel de données d’enquête (réponses ouvertes). ' +
    `On te donne un TABLEAU JSON de réponses libres. Traduis CHAQUE élément vers ${langueCible}. ` +
    'Règles STRICTES : 1) Préserve EXACTEMENT le sens ; ne reformule pas, ne résume pas, ' +
    'n’ajoute ni ne retire d’information, ne commente pas. 2) Ne traduis pas les noms propres, ' +
    'lieux, codes, sigles, e-mails, URL, dates et nombres : recopie-les. 3) Si une réponse est ' +
    'déjà dans la langue cible ou intraduisible (vide, « — »), recopie-la telle quelle. ' +
    'Réponds STRICTEMENT par un TABLEAU JSON de MÊME longueur et MÊME ordre que l’entrée, ' +
    'ne contenant que les traductions (chaînes), sans aucun texte autour. ' +
    'Indique la langue source détectée nulle part ailleurs que via l’ordre — ne renvoie que le tableau.';

  const userMessage = JSON.stringify(textes);

  const client = new Anthropic({ apiKey });
  try {
    const reponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
    const texte = reponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    let arr: unknown;
    try {
      const m = /\[[\s\S]*\]/.exec(texte);
      arr = JSON.parse(m ? m[0] : texte);
    } catch {
      return { status: 'erreur', message: "La traduction IA n'a pas pu être interprétée." };
    }
    if (!Array.isArray(arr) || arr.length !== textes.length) {
      // Longueur incohérente : on refuse plutôt que d’aligner des traductions au
      // mauvais texte (risque de déformation du sens).
      return {
        status: 'erreur',
        message: 'Réponse IA incohérente (nombre de traductions inattendu). Réessayez.',
      };
    }
    const map: Record<string, string> = {};
    for (let i = 0; i < textes.length; i++) {
      const trad = String(arr[i] ?? '').trim();
      if (trad) map[textes[i]!] = trad;
    }
    return { status: 'succes', langueDetectee: langueCible, map };
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    let message: string;
    if (status === 401) {
      message = 'Service IA indisponible : la configuration serveur doit être mise à jour.';
    } else if (status === 429) {
      message = "Limite d'usage de l'IA atteinte. Patientez quelques minutes.";
    } else if (status === 529) {
      message = "L'IA est surchargée pour le moment. Réessayez dans un instant.";
    } else if (status && status >= 500) {
      message = 'Service IA temporairement indisponible. Réessayez dans un instant.';
    } else {
      message = e instanceof Error ? e.message : 'Erreur inconnue.';
    }
    console.error('[atelier-analyse] Échec traduction textes libres', { status });
    return { status: 'erreur', message };
  }
}
