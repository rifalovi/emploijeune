'use server';

import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { anonymiserTexte, SYSTEM_PROMPT_INSTITUTIONNEL } from '@/lib/ia/anonymisation';
import { chargerContexteDonnees, formaterContexteDonnees } from '@/lib/ia/contexte-donnees';
import { chargerBaseConnaissancePertinente } from '@/lib/ia/base-connaissance-loader';

/**
 * Server Actions du module Assistant IA — V2.0.0.
 *
 * Pré-conditions strictes :
 *   1. Utilisateur authentifié (via getCurrentUtilisateur).
 *   2. Module assistant_ia activé pour le rôle de l'utilisateur (RPC
 *      module_ia_actif_pour_courant). Sinon retourne erreur — la même
 *      réponse que si la route n'existait pas, vu côté UX.
 *   3. Variable d'environnement ANTHROPIC_API_KEY présente.
 *
 * Anonymisation : `anonymiserTexte` est appliqué à TOUS les messages
 * utilisateur AVANT envoi à Claude. Aucune donnée nominative ne quitte
 * la plateforme.
 */

/**
 * Pièce jointe au message — V2.2.1.
 * - 'image' : envoyée à Claude Vision en base64
 * - 'texte' : injectée comme bloc de texte dans le message user
 */
const piecesJointesSchema = z.object({
  type: z.enum(['image', 'texte']),
  nom: z.string().min(1).max(255),
  // Pour les images : base64 brut + mime ; pour le texte : contenu directement
  base64: z.string().optional(),
  mime: z.string().optional(),
  contenu_text: z.string().max(50000).optional(),
});

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(10000),
  pieces_jointes: z.array(piecesJointesSchema).max(5).optional(),
});

const analyserSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
});

export type ResultatAnalyse =
  | { status: 'succes'; reponse: string; tokens_utilises?: number }
  | {
      status: 'erreur';
      code:
        | 'non_authentifie'
        | 'module_desactive'
        | 'config_manquante'
        | 'limite_atteinte'
        | 'erreur_ia'
        | 'payload_invalide';
      message: string;
    };

export async function analyser(payload: z.infer<typeof analyserSchema>): Promise<ResultatAnalyse> {
  // 1. Auth
  let utilisateur;
  try {
    utilisateur = await getCurrentUtilisateur({ allowViewAs: true });
  } catch {
    utilisateur = null;
  }
  if (!utilisateur) {
    return { status: 'erreur', code: 'non_authentifie', message: 'Connexion requise.' };
  }

  // 2. Module activé pour le rôle ?
  const supabase = await createSupabaseServerClient();
  const { data: actif } = await supabase.rpc('module_ia_actif_pour_courant');
  if (!actif) {
    return {
      status: 'erreur',
      code: 'module_desactive',
      message: 'Module non disponible pour votre rôle.',
    };
  }

  // 3. Validation payload
  const parsed = analyserSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', code: 'payload_invalide', message: 'Format de requête invalide.' };
  }

  // 4. Config Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      status: 'erreur',
      code: 'config_manquante',
      message: 'ANTHROPIC_API_KEY absente du serveur. Contactez le super_admin.',
    };
  }

  // 5. Anonymisation systématique + intégration des pièces jointes (V2.2.1)
  type ContentBlock =
    | { type: 'text'; text: string }
    | {
        type: 'image';
        source: { type: 'base64'; media_type: string; data: string };
      };
  type MessageMultimodal = {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
  };

  const messagesAnonymises: MessageMultimodal[] = parsed.data.messages.map((m) => {
    const texteAnonymise = anonymiserTexte(m.content);

    // Si pas de pièces jointes : on garde le format simple string.
    if (!m.pieces_jointes || m.pieces_jointes.length === 0) {
      return { role: m.role, content: texteAnonymise };
    }

    // Sinon : on construit un array de content blocks (multimodal Claude).
    const blocks: ContentBlock[] = [];

    // 5a. Images Claude Vision en premier (recommandation Anthropic).
    for (const pj of m.pieces_jointes) {
      if (pj.type === 'image' && pj.base64 && pj.mime) {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: pj.mime, data: pj.base64 },
        });
      }
    }

    // 5b. Textes des fichiers attachés en bloc préfixé.
    const blocsTexte: string[] = [];
    for (const pj of m.pieces_jointes) {
      if (pj.type === 'texte' && pj.contenu_text) {
        blocsTexte.push(`### Pièce jointe : ${pj.nom}\n\n${anonymiserTexte(pj.contenu_text)}`);
      }
    }
    if (blocsTexte.length > 0) {
      blocks.push({ type: 'text', text: blocsTexte.join('\n\n---\n\n') });
    }

    // 5c. Le message user lui-même
    blocks.push({ type: 'text', text: texteAnonymise });
    return { role: m.role, content: blocks };
  });

  // 6. Enrichissement du contexte avec les données live (V2.2.0)
  //    + base de connaissance super_admin pertinente.
  const [contexteDonnees, contexteConnaissance] = await Promise.all([
    chargerContexteDonnees(),
    chargerBaseConnaissancePertinente(parsed.data.messages.map((m) => m.content).join('\n')),
  ]);

  const blocsContexte: string[] = [SYSTEM_PROMPT_INSTITUTIONNEL];
  if (contexteDonnees) {
    blocsContexte.push('---');
    blocsContexte.push(formaterContexteDonnees(contexteDonnees));
  }
  if (contexteConnaissance && contexteConnaissance.length > 0) {
    blocsContexte.push('---');
    blocsContexte.push('## Base de connaissance institutionnelle (super_admin)');
    blocsContexte.push(
      'Les notes ci-dessous ont été ajoutées par le SCS comme références faisant autorité. ' +
        'Cite-les explicitement quand elles sont pertinentes.',
    );
    blocsContexte.push('');
    for (const note of contexteConnaissance) {
      blocsContexte.push(`### ${note.titre}`);
      blocsContexte.push(note.contenu);
      blocsContexte.push('');
    }
  }
  const systemPromptEnrichi = blocsContexte.join('\n');

  // 7. Appel Claude API (avec support multimodal)
  const client = new Anthropic({ apiKey });
  try {
    const reponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: systemPromptEnrichi,
      // Le SDK Anthropic accepte string ou array de blocks pour content.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messagesAnonymises as any,
    });

    // Extraction du texte (Claude renvoie un array de blocks de différents types)
    const texte = reponse.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');

    return {
      status: 'succes',
      reponse: texte || '(Réponse vide.)',
      tokens_utilises: reponse.usage?.input_tokens ?? undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return { status: 'erreur', code: 'erreur_ia', message: msg };
  }
}
