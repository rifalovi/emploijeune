import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DOMAINES_FORMATION_CODES, type DomaineFormationCode } from '@/lib/schemas/nomenclatures';

/**
 * Couche IA optionnelle pour le moteur d'import — Phase 3 du sprint Import IA.
 *
 * Cible : les valeurs **non reconnaissables** par le smart-mapper classique
 * (texte libre type "Compétences techniques avancées en réseau", "Formation
 * digitale et bureautique", "Gestion de coopérative agricole pour jeunes"…).
 *
 * Sécurité PII : on n'envoie JAMAIS prénoms, noms, courriels ou téléphones
 * à Claude. Uniquement les libellés de domaine en texte libre + la liste
 * cible des codes. Les valeurs sont dédupliquées avant envoi pour limiter
 * la facture tokens.
 *
 * Modèle : Claude Haiku 4.5 (claude-haiku-4-5-20251001) — rapide, peu coûteux,
 * la tâche est mapping/classification, pas raisonnement complexe.
 *
 * Gating : la fonction vérifie l'activation `import_ia` pour le rôle de
 * l'utilisateur courant via la RPC `module_actif_pour_courant`. Si désactivé,
 * retourne un map vide silencieusement (l'appelant doit le traiter comme
 * "aucune suggestion disponible").
 */

const TIMEOUT_MS = 30_000;

export type SuggestionMapping = {
  /** Valeur originale lue dans le fichier (libellé texte libre). */
  valeurOriginale: string;
  /** Code mappé par l'IA (ou 'AUTRE' si vraiment rien ne colle). */
  codeSuggere: DomaineFormationCode;
  /** Confiance estimée 0..100 (sur le modèle déclaratif). */
  confiance: number;
};

export type SuggererMappageResult =
  | { status: 'desactive'; message: string }
  | { status: 'erreur'; message: string }
  | { status: 'succes'; suggestions: SuggestionMapping[] };

/**
 * Vérifie l'activation du module `import_ia` pour le rôle courant.
 * Retourne TRUE si le super_admin a activé le module pour le rôle de
 * l'utilisateur, FALSE sinon (toujours FALSE en absence d'auth).
 */
export async function importIaActifPourCourant(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('module_actif_pour_courant', {
      p_module: 'import_ia',
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Demande à Claude de mapper une liste de valeurs texte libre vers les
 * codes officiels `DOMAINES_FORMATION_CODES`.
 *
 * Conditions :
 *   - Le module `import_ia` doit être actif pour le rôle de l'utilisateur
 *     (sinon retour 'desactive')
 *   - ANTHROPIC_API_KEY doit être configurée (sinon retour 'erreur')
 *   - max 50 valeurs par appel (sinon retour 'erreur' — sécurité tokens)
 *   - timeout 30s, sinon fallback erreur
 */
export async function suggererMappageDomaines(
  valeursNonReconnues: ReadonlyArray<string>,
): Promise<SuggererMappageResult> {
  // 0. Garde feature flag — silencieux si désactivé
  if (!(await importIaActifPourCourant())) {
    return {
      status: 'desactive',
      message:
        'Module Import IA désactivé pour votre rôle. Demandez au super_admin de l\'activer dans /super-admin/modules.',
    };
  }

  const valeursUniques = Array.from(new Set(valeursNonReconnues.map((v) => v.trim()).filter((v) => v.length > 0)));
  if (valeursUniques.length === 0) {
    return { status: 'succes', suggestions: [] };
  }
  if (valeursUniques.length > 50) {
    return {
      status: 'erreur',
      message: `Trop de valeurs à mapper en un appel (${valeursUniques.length} > 50). Réduisez le batch.`,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: 'erreur', message: 'Clé API Anthropic non configurée.' };
  }

  const prompt = construirePrompt(valeursUniques);

  const client = new Anthropic({ apiKey });

  // Timeout 30s manuel via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);

    const texte = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n');

    return parserReponseClaude(texte, valeursUniques);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 'erreur',
        message: 'Analyse IA expirée (>30s). L\'import classique reste disponible.',
      };
    }
    return {
      status: 'erreur',
      message: `Erreur Claude API : ${err instanceof Error ? err.message : 'inconnue'}`,
    };
  }
}

// =============================================================================
// Helpers internes
// =============================================================================

function construirePrompt(valeurs: ReadonlyArray<string>): string {
  const codesDispo = DOMAINES_FORMATION_CODES.join(', ');
  const valeursLignes = valeurs.map((v) => `- ${JSON.stringify(v)}`).join('\n');

  return `Tu es un expert en formation professionnelle francophone (OIF — Organisation Internationale de la Francophonie).

Tâche : pour chaque valeur de domaine de formation en texte libre ci-dessous, indique le code le plus proche parmi cette liste :
${codesDispo}

Liste des codes (sémantique) :
- AGR_ELV_PCH : Agriculture, élevage, pêche
- AGROALIM : Agro-alimentaire et transformation
- ARTISANAT : Artisanat, métiers d'art
- COMMERCE : Commerce, vente
- DEV_PERS : Développement personnel, soft skills
- ENTREPR_GEST : Entrepreneuriat, gestion d'entreprise
- ENV_ECO_VERTE : Environnement, économie verte
- FP_TECH : Formation professionnelle technique
- GEST_FIN_COMPTA : Gestion financière, comptabilité
- LANGUES_COM : Langues, communication, marketing
- NUM_INFO : Numérique, informatique, TIC
- SANTE_SERV_PERS : Santé, services à la personne
- SERV_FIN_INCLUSION : Services financiers, inclusion bancaire
- TOURISME : Tourisme, hôtellerie
- TRANSPORT : Transport, logistique
- AUTRE : Aucun des codes ci-dessus ne convient

Valeurs à mapper :
${valeursLignes}

Pour chaque valeur, retourne un objet JSON avec :
  - "valeur" : la valeur originale (string exactement comme fournie)
  - "code" : le code parmi la liste (string)
  - "confiance" : un nombre 0..100 (ta certitude)

Si vraiment aucun code ne convient, utilise "AUTRE" avec une confiance basse.

Réponds UNIQUEMENT par un tableau JSON valide, sans texte avant ni après, sans markdown :
[{"valeur": "...", "code": "...", "confiance": 85}, ...]`;
}

function parserReponseClaude(
  texte: string,
  valeursAttendues: ReadonlyArray<string>,
): SuggererMappageResult {
  // Tolérer du markdown autour (extraire le bloc JSON)
  const matchJson = texte.match(/\[[\s\S]*\]/);
  if (!matchJson) {
    return {
      status: 'erreur',
      message: 'Réponse Claude inintelligible (pas de tableau JSON détecté).',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(matchJson[0]);
  } catch {
    return { status: 'erreur', message: 'Réponse Claude : JSON invalide.' };
  }

  if (!Array.isArray(parsed)) {
    return { status: 'erreur', message: 'Réponse Claude : tableau attendu.' };
  }

  const valeursAttenduesSet = new Set(valeursAttendues);
  const codesValides = new Set<string>(DOMAINES_FORMATION_CODES);
  const suggestions: SuggestionMapping[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const valeur = typeof obj.valeur === 'string' ? obj.valeur : null;
    const code = typeof obj.code === 'string' ? obj.code : null;
    const confiance = typeof obj.confiance === 'number' ? obj.confiance : 0;
    if (!valeur || !code) continue;
    if (!valeursAttenduesSet.has(valeur)) continue; // Claude a inventé une valeur
    if (!codesValides.has(code)) continue; // Claude a inventé un code
    suggestions.push({
      valeurOriginale: valeur,
      codeSuggere: code as DomaineFormationCode,
      confiance: Math.max(0, Math.min(100, Math.round(confiance))),
    });
  }

  return { status: 'succes', suggestions };
}
