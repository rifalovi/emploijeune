'use server';

import Anthropic from '@anthropic-ai/sdk';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { peutAccederDataStudio } from '@/lib/super-admin/permissions';
import { enregistrerTraitementAction } from './actions';
import { extraireTexteDocuments } from './rag';
import {
  FORMATS_RAPPORT,
  type CrosstabResponse,
  type FormatRapport,
  type FrequencyResponse,
  type MultiResponse,
  type StatTestResponse,
} from './types';

// Formats longs (scientifiques / stratégiques) : on autorise davantage de sortie.
const FORMATS_LONGS: FormatRapport[] = [
  'note_thematique',
  'rapport_projet',
  'rapport_programme',
  'rapport_scientifique',
];

export type GenererRapportInput = {
  indicateur: string;
  indicateurLibelle?: string;
  format: FormatRapport;
  consignes?: string;
  frequences?: FrequencyResponse | null;
  croisement?: CrosstabResponse | null;
  multi?: MultiResponse | null;
  tests?: StatTestResponse | null;
  documentRefs?: string[];
  reload?: Record<string, unknown>;
};

function fmtPct(v: number | null): string {
  return v === null || v === undefined ? '' : ` (${(v * 100).toFixed(1)} %)`;
}

/** Met en forme les résultats déjà calculés en texte compact pour le prompt. */
function formaterDonnees(input: GenererRapportInput): string {
  const parts: string[] = [];
  if (input.frequences) {
    for (const [name, rows] of Object.entries(input.frequences.tables)) {
      const lignes = rows.map((r) => `  - ${r.Modalité} : ${r.Effectif}${fmtPct(r['%'])}`);
      parts.push(`Tri à plat « ${name} » :\n${lignes.join('\n')}`);
    }
  }
  if (input.croisement) {
    const c = input.croisement;
    for (const layer of c.layers) {
      const entete = `Croisement ${c.row} × ${c.col}${
        c.layer ? ` — couche « ${layer.layer_value} »` : ''
      } (base ${layer.base})`;
      const corps = layer.index
        .map(
          (idx, ri) =>
            `  ${idx} : ` +
            layer.columns.map((col, ci) => `${col}=${layer.counts[ri]?.[ci] ?? 0}`).join(', '),
        )
        .join('\n');
      parts.push(`${entete}\n${corps}`);
    }
  }
  if (input.multi) {
    for (const [prefix, table] of Object.entries(input.multi.tables)) {
      const lignes = table.rows.map(
        (r) =>
          `  - ${r.Option} : ${r.Effectif} (${(r['Pourcentage répondants'] * 100).toFixed(1)} %)`,
      );
      parts.push(`Réponses multiples « ${prefix} » (base ${table.base}) :\n${lignes.join('\n')}`);
    }
  }
  if (input.tests) {
    const chi = input.tests.chi_square;
    const w = input.tests.welch_ttest;
    const lignes: string[] = [];
    if (chi.applicable) {
      lignes.push(
        `  - Khi² : χ²=${chi.chi2.toFixed(3)}, ddl=${chi.dof}, p=${chi.p.toFixed(4)} → ${chi.significatif ? 'association significative' : 'association non significative'} (seuil 5 %).`,
      );
    }
    if (w.applicable) {
      lignes.push(
        `  - t-test de Welch : t=${w.t.toFixed(3)}, p=${w.p.toFixed(4)} → différence ${w.significatif ? 'significative' : 'non significative'} (seuil 5 %).`,
      );
    }
    if (lignes.length) parts.push(`Tests statistiques :\n${lignes.join('\n')}`);
  }
  return parts.join('\n\n');
}

/**
 * Génère un rapport structuré via l'API Claude à partir des résultats DÉJÀ
 * calculés (le modèle rédige et interprète ; il ne recalcule rien). Le rapport
 * est ensuite enregistré dans l'historique (type « report »).
 * Réservé SCS / super_admin.
 */
export async function genererRapportAction(
  input: GenererRapportInput,
): Promise<{ status: 'succes'; rapport: string } | { status: 'erreur'; message: string }> {
  const utilisateur = await requireUtilisateurValide();
  if (!(await peutAccederDataStudio(utilisateur.id, utilisateur.role))) {
    return { status: 'erreur', message: 'Accès non autorisé.' };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      status: 'erreur',
      message: 'ANTHROPIC_API_KEY absente du serveur. Contactez le super_admin.',
    };
  }

  const donnees = formaterDonnees(input);
  if (!donnees.trim()) {
    return { status: 'erreur', message: 'Produisez d’abord un tri à plat ou un croisement.' };
  }
  const preset = FORMATS_RAPPORT[input.format] ?? FORMATS_RAPPORT.synthese;

  // Contexte documentaire (RAG) : cadrage projet/programme, définitions, objectifs.
  const contexteDocs = await extraireTexteDocuments(input.documentRefs ?? []);

  const system =
    "Tu es analyste senior en suivi-évaluation et statistique sociale à l'Organisation " +
    'internationale de la Francophonie (OIF). Tu rédiges en français, dans un style clair, ' +
    'rigoureux et nuancé, à partir UNIQUEMENT des chiffres fournis : ne les invente pas, ne les ' +
    'recalcule pas, ne cite aucune donnée absente, et signale explicitement les effectifs faibles ' +
    'ou les limites. Distingue corrélation et causalité. ' +
    preset.instruction +
    ' Mets en forme en Markdown (titres de niveau ##/###, listes, tableaux si utile). ' +
    'Appuie chaque affirmation chiffrée sur un chiffre issu des résultats.' +
    (contexteDocs
      ? " Des « Documents de référence » sont fournis : sers-t'en UNIQUEMENT pour le cadrage " +
        "(contexte, objectifs du projet/programme, définitions, enjeux). N'en tire AUCUN chiffre " +
        'de résultat ; les seuls chiffres autorisés sont ceux des « Résultats calculés ».'
      : '');

  const userMessage =
    `Indicateur : ${input.indicateurLibelle ?? input.indicateur}\n\n` +
    `Résultats calculés :\n${donnees}\n\n` +
    (contexteDocs ? `Documents de référence (contexte de cadrage) :\n${contexteDocs}\n\n` : '') +
    (input.consignes ? `Consignes complémentaires : ${input.consignes}\n` : '');

  const client = new Anthropic({ apiKey });
  try {
    const reponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: FORMATS_LONGS.includes(input.format) ? 8000 : 4096,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
    const rapport =
      reponse.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('\n') || '(Rapport vide.)';

    // Enregistrement best-effort dans l'historique.
    await enregistrerTraitementAction({
      type: 'report',
      titre: `Rapport — ${preset.label}`,
      source: 'enquete',
      source_ref: input.indicateur,
      params: {
        format: input.format,
        consignes: input.consignes ?? null,
        documentRefs: input.documentRefs ?? [],
        _reload: input.reload ?? null,
      },
      payload: { rapport, format: input.format },
      apercu: preset.label,
    });

    return { status: 'succes', rapport };
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
    console.error('[atelier-analyse] Échec rapport Claude', { status });
    return { status: 'erreur', message };
  }
}
