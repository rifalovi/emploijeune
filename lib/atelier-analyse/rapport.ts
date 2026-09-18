'use server';

import Anthropic from '@anthropic-ai/sdk';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { enregistrerTraitementAction } from './actions';
import {
  FORMATS_RAPPORT,
  type CrosstabResponse,
  type FormatRapport,
  type FrequencyResponse,
} from './types';

const ROLES_AUTORISES = ['super_admin', 'admin_scs'];

export type GenererRapportInput = {
  indicateur: string;
  indicateurLibelle?: string;
  format: FormatRapport;
  consignes?: string;
  frequences?: FrequencyResponse | null;
  croisement?: CrosstabResponse | null;
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
  if (!ROLES_AUTORISES.includes(utilisateur.role)) {
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

  const system =
    "Tu es analyste suivi-évaluation à l'Organisation internationale de la Francophonie (OIF). " +
    'Tu rédiges en français, à partir UNIQUEMENT des chiffres fournis : ne les invente pas, ne les ' +
    'recalcule pas, ne cite aucune donnée absente. ' +
    preset.instruction +
    ' Mets en forme en Markdown (titres, listes, tableaux si utile).';

  const userMessage =
    `Indicateur : ${input.indicateurLibelle ?? input.indicateur}\n\n` +
    `Résultats calculés :\n${donnees}\n\n` +
    (input.consignes ? `Consignes complémentaires : ${input.consignes}\n` : '');

  const client = new Anthropic({ apiKey });
  try {
    const reponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
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
      params: { format: input.format, consignes: input.consignes ?? null },
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
