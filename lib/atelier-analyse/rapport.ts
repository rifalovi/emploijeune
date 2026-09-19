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
  /** Structure / axes libres décrits par l'utilisateur (rapport sur mesure). */
  structureLibre?: string;
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
  const structure = (input.structureLibre ?? '').trim();
  const aDocuments = (input.documentRefs?.length ?? 0) > 0;
  // Le rapport « personnalisé » peut être produit à partir de la seule structure
  // libre (plan imposé) et/ou de documents de cadrage, sans résultat calculé.
  const personnaliseSansResultats =
    input.format === 'personnalise' && (structure.length > 0 || aDocuments);
  if (!donnees.trim() && !personnaliseSansResultats) {
    return {
      status: 'erreur',
      message:
        'Produisez d’abord un tri à plat ou un croisement — ou, en « Rapport personnalisé », ' +
        'renseignez la structure du rapport.',
    };
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
    // Rapport RÉDIGÉ + illustré : garder l'analyse complète ET l'accompagner de
    // tableaux et de graphiques (sans réduire le texte).
    ' Conserve une analyse rédigée complète, MAIS illustre-la systématiquement. ' +
    // Mise en forme INSTITUTIONNELLE, exploitable en document Word/PDF.
    'Structure institutionnelle OBLIGATOIRE, avec des titres ## et ### : ' +
    '(1) « ## Résumé exécutif » (5-8 lignes, constats chiffrés majeurs) ; ' +
    '(2) les sections d’analyse principales (une par thème/axe), chacune avec un TABLEAU Markdown ' +
    'propre des chiffres clés ET un GRAPHIQUE principal pertinent ; ' +
    '(3) en toute fin, une section « ## Annexes » regroupant les TABLEAUX SECONDAIRES et détaillés ' +
    '(ventilations fines, tableaux exhaustifs) — le corps du rapport ne garde que les tableaux de ' +
    'synthèse, les tableaux d’approfondissement vont en annexe. ' +
    'Pour chaque graphique, insère un bloc de code ```chart contenant un JSON ' +
    '{"type":"bar"|"pie"|"line","titre":"…","data":[{"label":"…","value":n}]} construit UNIQUEMENT à ' +
    'partir des chiffres fournis. CHOISIS le type selon la pertinence : « pie » (camembert) pour une ' +
    'répartition en parts d’un tout (ex. structure par sexe, par statut) ; « bar » (histogramme) pour ' +
    'comparer des modalités ou des effectifs ; « line » (courbe) pour une évolution ordonnée. ' +
    'Un même chiffre ne doit pas être à la fois en camembert et en barres. Alterne texte, tableaux et ' +
    'graphiques ; appuie chaque affirmation chiffrée sur un chiffre des résultats.' +
    (contexteDocs
      ? " Des « Documents de référence » sont fournis : sers-t'en UNIQUEMENT pour le cadrage " +
        "(contexte, objectifs du projet/programme, définitions, enjeux). N'en tire AUCUN chiffre " +
        'de résultat ; les seuls chiffres autorisés sont ceux des « Résultats calculés ».'
      : '') +
    (structure
      ? ' L’utilisateur impose une structure/des axes précis (fournis ci-après) : respecte-les ' +
        'fidèlement, dans l’ordre indiqué, comme plan du rapport.'
      : '');

  const userMessage =
    `Indicateur : ${input.indicateurLibelle ?? input.indicateur}\n\n` +
    (donnees.trim()
      ? `Résultats calculés :\n${donnees}\n\n`
      : 'Aucun résultat chiffré n’est fourni : construis le rapport à partir de la structure ' +
        'imposée et des documents de cadrage, sans inventer de chiffres.\n\n') +
    (contexteDocs ? `Documents de référence (contexte de cadrage) :\n${contexteDocs}\n\n` : '') +
    (structure ? `Structure / axes demandés (à respecter fidèlement) :\n${structure}\n\n` : '') +
    (input.consignes ? `Consignes complémentaires : ${input.consignes}\n` : '');

  const client = new Anthropic({ apiKey });
  const estLong = FORMATS_LONGS.includes(input.format);
  const maxTokens = estLong ? 16000 : 5000;
  try {
    // Génération avec CONTINUATION automatique : si le modèle atteint la limite
    // de tokens (rapport coupé), on relance en poursuivant le texte déjà produit
    // jusqu'à ce que le rapport soit complet (plafonné pour éviter les boucles).
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: userMessage },
    ];
    const morceaux: string[] = [];
    const maxTours = estLong ? 4 : 2;
    let complet = false;
    for (let tour = 0; tour < maxTours; tour += 1) {
      const reponse = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: maxTokens,
        system,
        messages,
      });
      const texte = reponse.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');
      morceaux.push(texte);
      if (reponse.stop_reason !== 'max_tokens') {
        complet = true;
        break;
      }
      // Rapport coupé : on demande la suite en reprenant exactement où il s'arrête.
      messages.push({ role: 'assistant', content: texte });
      messages.push({
        role: 'user',
        content:
          'Poursuis le rapport EXACTEMENT là où tu t’es arrêté, sans rien répéter ni ' +
          'réintroduire, en conservant la même structure et le même niveau de détail, ' +
          'jusqu’à la conclusion et les annexes.',
      });
    }
    // Recollage : les continuations reprennent la phrase en cours, on les joint bord à bord.
    const rapport = morceaux.join('').trim() || '(Rapport vide.)';
    if (!complet) {
      console.warn('[atelier-analyse] Rapport tronqué après continuation', {
        format: input.format,
      });
    }

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
