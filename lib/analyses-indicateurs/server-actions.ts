'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { indicateurParCode } from '@/lib/referentiels/indicateurs';

/**
 * Server Actions — Analyses IA par indicateur CMR.
 *
 * Accès strictement limité au rôle super_admin.
 *
 * Pattern pédagogique :
 *   Ces actions retournent `void` (standard Next.js form actions).
 *   Les erreurs sont levées via `throw` — Next.js les intercepte et affiche
 *   la page d'erreur. Pour un retour d'état côté client (toast, feedback),
 *   on utiliserait `useFormState` avec un return type `Resultat<T>`.
 *
 * Trois actions principales :
 *   1. genererAnalyseIndicateur  — appelle Claude API + sauvegarde brouillon
 *   2. publierAnalyse            — passe brouillon → publiee
 *   3. modifierAnalyse           — édition manuelle du contenu
 *   4. supprimerAnalyse          — suppression d'un brouillon
 */

// ─── Guard super_admin ────────────────────────────────────────────────────────

async function exigerSuperAdmin() {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    throw new Error('Accès refusé — rôle super_admin requis.');
  }
  return utilisateur;
}

// ─── Prompt système ───────────────────────────────────────────────────────────

function construirePrompt(indicateurCode: string): string {
  const ind = indicateurParCode(indicateurCode);
  if (!ind) return '';

  return `Tu es un expert en suivi-évaluation de projets d'emploi pour les jeunes dans l'espace francophone (OIF — Organisation Internationale de la Francophonie).

Tu dois rédiger une **analyse synthétique** de l'indicateur CMR "${ind.code} — ${ind.intitule}" pour le tableau de bord public de la plateforme OIF Emploi Jeunes.

## Contexte de l'indicateur
- **Code** : ${ind.code}
- **Intitulé** : ${ind.intitule}
- **Définition** : ${ind.definition}
- **Méthode de calcul** : ${ind.calcul}
- **Collecte** : ${ind.collecte}
- **Projets concernés** : ${ind.projetsConcernes.join(', ')}
- **Précautions méthodologiques** : ${ind.precautions.join(' | ')}

## Instructions de rédaction
Rédige une analyse en **3 à 4 paragraphes** (environ 200 à 300 mots) en Markdown, structurée ainsi :

1. **Signification et importance** — Pourquoi cet indicateur est-il stratégique pour mesurer l'impact des projets emploi jeunes OIF ?
2. **Interprétation des données** — Comment lire et interpréter les valeurs de cet indicateur ? Quels seuils ou tendances sont significatifs ?
3. **Facteurs d'influence** — Quels facteurs contextuels (économiques, institutionnels, sociaux) peuvent expliquer les variations observées ?
4. **Recommandations** — Quelles actions ou améliorations permettraient d'améliorer cet indicateur dans les pays francophones en développement ?

## Contraintes
- Ton professionnel et pédagogique, accessible à des coordinateurs de projets
- Ne cite pas de chiffres spécifiques de la base de données (données fictives)
- Utilise le format Markdown avec des **titres de niveau 3** (###) pour chaque section
- Maximum 350 mots
- Langue : français`;
}

// ─── 1. Générer une analyse IA ────────────────────────────────────────────────

const genererSchema = z.object({
  indicateur_code: z.string().min(1).max(4),
});

export async function genererAnalyseIndicateur(formData: FormData): Promise<void> {
  const utilisateur = await exigerSuperAdmin();

  const parsed = genererSchema.safeParse({
    indicateur_code: (formData.get('indicateur_code') as string | null)?.toUpperCase(),
  });
  if (!parsed.success) throw new Error('Code indicateur invalide.');

  const { indicateur_code } = parsed.data;
  const ind = indicateurParCode(indicateur_code);
  if (!ind) throw new Error(`Indicateur ${indicateur_code} introuvable.`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Clé API Anthropic non configurée.');

  const prompt = construirePrompt(indicateur_code);

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const contenuBrut = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n');

  const tokens = response.usage.input_tokens + response.usage.output_tokens;

  // Extraire un résumé (première ligne de texte non vide, entre 20 et 150 car.)
  const resume =
    contenuBrut
      .split('\n')
      .map((l) => l.replace(/^#+\s*/, '').trim())
      .find((l) => l.length > 20 && l.length < 150) ?? null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('analyses_indicateurs').insert({
    indicateur_code,
    statut: 'brouillon',
    contenu: contenuBrut,
    resume,
    genere_par_ia: true,
    modifie_par_sa: false,
    prompt_utilise: prompt,
    tokens_utilises: tokens,
    created_by: utilisateur.id,
  });

  if (error) throw new Error(`Erreur de sauvegarde : ${error.message}`);

  revalidatePath('/super-admin/analyses-indicateurs');
}

// ─── 2. Publier une analyse ───────────────────────────────────────────────────

const publierSchema = z.object({
  analyse_id: z.string().uuid(),
});

export async function publierAnalyse(formData: FormData): Promise<void> {
  const utilisateur = await exigerSuperAdmin();

  const parsed = publierSchema.safeParse({ analyse_id: formData.get('analyse_id') });
  if (!parsed.success) throw new Error('ID invalide.');

  const supabase = await createSupabaseServerClient();

  // Récupérer l'indicateur_code pour dépublier les anciennes
  const { data: analyse } = await supabase
    .from('analyses_indicateurs')
    .select('indicateur_code')
    .eq('id', parsed.data.analyse_id)
    .single();

  if (!analyse) throw new Error('Analyse introuvable.');

  // Dépublier les analyses déjà publiées du même indicateur
  await supabase
    .from('analyses_indicateurs')
    .update({ statut: 'brouillon' })
    .eq('indicateur_code', analyse.indicateur_code)
    .eq('statut', 'publiee');

  // Publier la nouvelle
  const { error } = await supabase
    .from('analyses_indicateurs')
    .update({
      statut: 'publiee',
      published_at: new Date().toISOString(),
      published_by: utilisateur.id,
    })
    .eq('id', parsed.data.analyse_id);

  if (error) throw new Error(error.message);

  revalidatePath('/super-admin/analyses-indicateurs');
  revalidatePath('/realisations');
}

// ─── 3. Modifier le contenu ───────────────────────────────────────────────────

const modifierSchema = z.object({
  analyse_id: z.string().uuid(),
  contenu: z.string().min(50).max(5000),
  resume: z.string().max(150).optional(),
});

export async function modifierAnalyse(formData: FormData): Promise<void> {
  await exigerSuperAdmin();

  const parsed = modifierSchema.safeParse({
    analyse_id: formData.get('analyse_id'),
    contenu: formData.get('contenu'),
    resume: formData.get('resume') || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Données invalides.');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('analyses_indicateurs')
    .update({
      contenu: parsed.data.contenu,
      resume: parsed.data.resume ?? null,
      modifie_par_sa: true,
    })
    .eq('id', parsed.data.analyse_id);

  if (error) throw new Error(error.message);

  revalidatePath('/super-admin/analyses-indicateurs');
  revalidatePath('/realisations');
}

// ─── 4. Supprimer un brouillon ────────────────────────────────────────────────

const supprimerSchema = z.object({
  analyse_id: z.string().uuid(),
});

export async function supprimerAnalyse(formData: FormData): Promise<void> {
  await exigerSuperAdmin();

  const parsed = supprimerSchema.safeParse({ analyse_id: formData.get('analyse_id') });
  if (!parsed.success) throw new Error('ID invalide.');

  const supabase = await createSupabaseServerClient();

  // Sécurité : on ne supprime que les brouillons, jamais les publiées
  const { error } = await supabase
    .from('analyses_indicateurs')
    .delete()
    .eq('id', parsed.data.analyse_id)
    .eq('statut', 'brouillon');

  if (error) throw new Error(error.message);

  revalidatePath('/super-admin/analyses-indicateurs');
}
