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

/**
 * Indicateurs liés à chaque indicateur du CMR — pour guider Claude vers des
 * analyses transversales (un indicateur isolé n'a de sens qu'en relation
 * avec ses voisins thématiques).
 *
 * Source : Cadre commun de mesure du rendement OIF V2, regroupements pivot.
 *   - Pilier A (formation) : A1 effectifs → A2 achèvement → A3 certification
 *     → A4 progression compétences → A5 insertion (chaîne séquentielle)
 *   - Pilier B (économie)  : B1 entreprises créées → B2 emplois → B3 survie
 *     → B4 financement (chaîne entrepreneuriale)
 *   - Pilier C (intermédiation) : C1 demandes → C2 mises en relation → C3 partenariats
 *   - Pilier D (écosystèmes) : D1 politiques → D2 réformes → D3 adoption recommandations
 *   - Marqueur F1 (français) : transverse — relie A1/B1/C1
 */
const INDICATEURS_CONNEXES: Record<string, string[]> = {
  A1: ["A2 (taux d'achèvement)", 'A3 (taux de certification)', "A5 (insertion professionnelle)"],
  A2: ['A1 (nombre de bénéficiaires)', 'A3 (certification)', 'A4 (progression des compétences)'],
  A3: ['A2 (achèvement)', 'A5 (insertion post-formation)'],
  A4: ['A1', 'A2', 'A3'],
  A5: ['A1', 'A3', "B1 (création d'entreprise)", 'B3 (survie des entreprises)'],
  B1: ['B2 (emplois créés)', 'B3 (survie)', 'B4 (financement)', 'A5 (insertion)'],
  B2: ['B1', 'B3'],
  B3: ['B1', 'B2', 'B4'],
  B4: ['B1', 'B3'],
  C1: ['C2 (mise en relation)', 'A5 (insertion)'],
  C2: ['C1', 'C3 (partenariats)'],
  C3: ['C1', 'C2'],
  D1: ['D2 (réformes)', 'D3 (adoption recommandations)'],
  D2: ['D1', 'D3'],
  D3: ['D1', 'D2'],
  F1: ['A1', 'B1', 'C1'],
};

function construirePrompt(indicateurCode: string): string {
  const ind = indicateurParCode(indicateurCode);
  if (!ind) return '';

  const connexes = INDICATEURS_CONNEXES[indicateurCode] ?? [];
  const sectionConnexes =
    connexes.length > 0
      ? `\n## Indicateurs connexes à mentionner\nDans ton analyse, établis des liens explicites avec ces indicateurs du même cadre CMR :\n${connexes.join(', ')}\n\nPar exemple : "Un ${indicateurCode} élevé combiné à [indicateur connexe] élevé suggère…" ou "Si ${indicateurCode} est fort mais [indicateur connexe] faible, cela indique…"\n`
      : '';

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
${sectionConnexes}
## Instructions de rédaction
Rédige une analyse en **4 à 5 paragraphes** (environ 250 à 350 mots) en Markdown, structurée ainsi :

1. **Signification et importance** — Pourquoi cet indicateur est-il stratégique pour mesurer l'impact des projets emploi jeunes OIF ? Quel objectif stratégique francophone éclaire-t-il ?
2. **Interprétation des données** — Comment lire et interpréter les valeurs de cet indicateur ? Quels seuils ou tendances sont significatifs dans le contexte des pays francophones en développement ?
3. **Lecture transversale** — Quelles conclusions systémiques émergent quand on croise ${indicateurCode} avec ses indicateurs connexes ? Donne au moins **un exemple concret de combinaison** (ex : "fort ${indicateurCode} sans [connexe] élevé signale un problème de…").
4. **Facteurs d'influence** — Quels facteurs contextuels (économiques, institutionnels, sociaux, infrastructure, genre) peuvent expliquer les variations observées en Afrique francophone subsaharienne et dans les autres zones d'intervention OIF ?
5. **Recommandations actionnables et vision systémique** — Liste 3 recommandations concrètes adaptées au contexte francophone, puis termine par une lecture systémique : quelle combinaison d'indicateurs permettrait de conclure que le programme atteint son objectif global d'insertion durable des jeunes ?

## Contraintes
- Ton professionnel et pédagogique, accessible à des coordinateurs de projets en pays francophones du Sud
- Ne cite pas de chiffres spécifiques de la base de données (données fictives en V1)
- Utilise le format Markdown avec des **titres de niveau 3** (###) pour chaque section
- N'utilise PAS de lignes horizontales (---), de blockquotes (>) ni de listes imbriquées (sous-puces avec indentation) — le rendu plateforme est volontairement simplifié
- Maximum 400 mots
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
    // 1536 tokens ≈ 1150 mots — large marge pour ~400 mots de sortie
    // + overhead Markdown (titres, gras, listes). Évite la troncature
    // sur les indicateurs riches en variables (A1, B1) après ajout de
    // la section "Lecture transversale" (Task #3).
    max_tokens: 1536,
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
    // created_by référence auth.users(id) — donc on stocke l'auth UUID
    // (utilisateur.user_id), pas l'UUID de la ligne utilisateurs (utilisateur.id).
    created_by: utilisateur.user_id,
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
      // published_by référence auth.users(id) (cf. created_by ci-dessus).
      published_by: utilisateur.user_id,
    })
    .eq('id', parsed.data.analyse_id);

  if (error) throw new Error(error.message);

  // Invalide à la fois la page admin (rafraîchit la liste avec le nouveau
  // statut) ET la vitrine publique. Le `, 'layout'` propage à toute la
  // sous-arborescence /realisations/[pilier]/[indicateur]/* (sinon la page
  // dynamique cachée par ISR pourrait rester sur l'ancienne analyse).
  revalidatePath('/super-admin/analyses-indicateurs');
  revalidatePath('/realisations', 'layout');
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
  // Modification édite le contenu mais ne change pas le statut. La page
  // publique ne montre que les analyses publiées — la modif d'un brouillon
  // n'a donc d'impact public que si on (re)publie ensuite. On invalide
  // quand même par sécurité (cas où on édite directement une publiée).
  revalidatePath('/realisations', 'layout');
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
