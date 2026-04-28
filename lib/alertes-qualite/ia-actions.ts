'use server';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Server Action — analyse IA des alertes qualité — V2.2.0 MVP.
 *
 * Approche conservative pour la V1 : on demande à Claude une analyse
 * synthétique du type d'alerte sélectionné (causes probables, méthodes
 * de correction, ordre de priorité), SANS écriture en base.
 *
 * V2.3 (à venir) : extension avec propositions de corrections concrètes
 * par ligne (checkboxes individuelles, audit log, application en masse).
 */

const analyserSchema = z.object({
  type: z.string().min(1).max(100),
});

export type AnalyseAlertesResultat =
  | { status: 'succes'; analyse: string }
  | { status: 'erreur'; message: string };

export async function analyserAlertesIa(
  payload: z.infer<typeof analyserSchema>,
): Promise<AnalyseAlertesResultat> {
  // Auth + permission
  const utilisateur = await getCurrentUtilisateur({ allowViewAs: true });
  if (!utilisateur) return { status: 'erreur', message: 'Connexion requise.' };
  if (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin') {
    return { status: 'erreur', message: 'Réservé aux administrateurs.' };
  }

  // Module IA actif pour le rôle ?
  const supabase = await createSupabaseServerClient();
  const { data: actif } = await supabase.rpc('module_ia_actif_pour_courant');
  if (!actif) return { status: 'erreur', message: 'Module IA non activé pour votre rôle.' };

  const parsed = analyserSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'Type invalide.' };

  // Compteurs actuels via RPC dashboard
  const { data: kpis } = await supabase.rpc('get_kpis_dashboard');
  const compteurs =
    (kpis as { alertes_qualite?: Record<string, number> } | null)?.alertes_qualite ?? {};

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      status: 'erreur',
      message: 'ANTHROPIC_API_KEY absente — contactez le super_admin.',
    };
  }

  // Construction du prompt institutionnel
  const promptUser = [
    `Type d'alerte sélectionné : **${parsed.data.type}**`,
    '',
    'Compteurs actuels sur la plateforme :',
    ...Object.entries(compteurs).map(([k, v]) => `- ${k} : ${v}`),
    '',
    'Question : Pour ce type d\u2019alerte, propose en 4-6 points :',
    '1. Les causes probables côté terrain.',
    '2. La méthode de correction recommandée (ordre de priorité, scripts SQL ou actions UI).',
    '3. Les contre-mesures préventives à mettre en place pour éviter la récurrence.',
    '4. Le risque RGPD / méthodologique si on laisse l\u2019alerte non traitée.',
    '',
    'Réponds en français institutionnel, en Markdown structuré (titres ##, listes).',
  ].join('\n');

  try {
    const client = new Anthropic({ apiKey });
    const reponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system:
        "Tu es l'assistant qualité de la plateforme OIF Emploi Jeunes. Tu aides l'admin SCS à corriger des incohérences de saisie. Réponds avec rigueur et cite les bonnes pratiques OIF du Cadre commun de mesure V2.",
      messages: [{ role: 'user', content: promptUser }],
    });
    const texte = reponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n');

    return { status: 'succes', analyse: texte || '(Réponse vide.)' };
  } catch (e) {
    return {
      status: 'erreur',
      message: e instanceof Error ? e.message : 'Erreur IA inconnue.',
    };
  }
}
