'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { genererTokenEnquete } from './tokens-publics';
import { PROJETS_CODES, PAYS_CODES } from '@/lib/schemas/nomenclatures';
import { VAGUES_ENQUETE_VALUES } from '@/lib/schemas/enquetes/nomenclatures';

/**
 * Lancement d'une vague d'enquête (Étape 6.5e).
 *
 * Pipeline :
 *   1. Filtre les cibles (bénéficiaires si questionnaire A, structures si B)
 *      selon projet/pays/avec_consentement (RLS appliquée).
 *   2. Pour chaque cible : appelle `genererTokenEnquete` qui crée le token
 *      ET envoie l'email d'invitation (template Étape 6.5d).
 *   3. Agrège les résultats : envoyés / sans email / échecs.
 *
 * Limites V1 :
 *   - Plafond 200 cibles par lancement (Resend Free 100/jour — au-delà
 *     l'admin doit lancer plusieurs vagues étalées). À monitorer.
 *   - Pas de file d'attente persistante : échec réseau au milieu = on
 *     log les échecs et l'admin relance manuellement les concernés.
 *   - Pas de webhook delivery confirmation (V1.5-E).
 *
 * Sécurité : seuls admin_scs / chef_projet / contributeur_partenaire
 * peuvent lancer une vague. La RLS limite naturellement le périmètre.
 */

// =============================================================================
// Schéma d'entrée
// =============================================================================

export const lancerVagueSchema = z.object({
  questionnaire: z.enum(['A', 'B']),
  vague_enquete: z.enum([...VAGUES_ENQUETE_VALUES] as [string, ...string[]]).default('ponctuelle'),
  /** Filtre projet optionnel — si absent, prend toutes les cibles du périmètre. */
  projet_code: z.enum([...PROJETS_CODES] as [string, ...string[]]).optional(),
  /** Filtre pays optionnel. */
  pays_code: z.enum([...PAYS_CODES] as [string, ...string[]]).optional(),
  /**
   * Mode test : envoie tous les emails à `email_test_override` au lieu des
   * vraies adresses. Utile pour la validation avant le grand lancement.
   */
  email_test_override: z
    .union([z.string().email(), z.literal(''), z.undefined()])
    .transform((v) => (v === '' || v === undefined ? undefined : v))
    .optional(),
  /** Plafond de cibles par exécution (sécurité Resend). */
  plafond: z.number().int().min(1).max(200).default(50),
});

export type LancerVagueInput = z.input<typeof lancerVagueSchema>;

export type LancerVagueResult =
  | {
      status: 'succes';
      total_cibles: number;
      envoyes: number;
      sans_email: Array<{ id: string; libelle: string }>;
      echecs: Array<{ id: string; libelle: string; message: string }>;
      tokens_generes: Array<{ id: string; libelle: string; url: string }>;
    }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'plafond_depasse'; message: string; total_cibles: number; plafond: number }
  | { status: 'erreur_inconnue'; message: string };

// =============================================================================
// Aperçu (pour le dialogue de confirmation)
// =============================================================================

export type ApercuVagueResult =
  | {
      status: 'succes';
      total_cibles: number;
      avec_email: number;
      sans_email: number;
      consentement_recueilli: number;
    }
  | { status: 'erreur'; message: string };

/**
 * Compte les cibles éligibles AVANT de lancer (rendu dans le dialogue).
 * Filtre identique à `lancerVagueEnquete`.
 */
export async function apercuVagueEnquete(
  input: Pick<LancerVagueInput, 'questionnaire' | 'projet_code' | 'pays_code'>,
): Promise<ApercuVagueResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (
    !utilisateur ||
    !['admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(utilisateur.role)
  ) {
    return { status: 'erreur', message: 'Réservé aux rôles autorisés.' };
  }

  const supabase = await createSupabaseServerClient();

  if (input.questionnaire === 'A') {
    let q = supabase
      .from('beneficiaires')
      .select('id, courriel, consentement_recueilli', { count: 'exact' })
      .is('deleted_at', null);
    if (input.projet_code) q = q.eq('projet_code', input.projet_code);
    if (input.pays_code) q = q.eq('pays_code', input.pays_code);
    const { data, count } = await q.limit(1000);
    const rows = data ?? [];
    return {
      status: 'succes',
      total_cibles: count ?? rows.length,
      avec_email: rows.filter((r) => r.courriel && r.consentement_recueilli).length,
      sans_email: rows.filter((r) => !r.courriel || !r.consentement_recueilli).length,
      consentement_recueilli: rows.filter((r) => r.consentement_recueilli).length,
    };
  }

  let q = supabase
    .from('structures')
    .select('id, courriel_porteur, consentement_recueilli', { count: 'exact' })
    .is('deleted_at', null);
  if (input.projet_code) q = q.eq('projet_code', input.projet_code);
  if (input.pays_code) q = q.eq('pays_code', input.pays_code);
  const { data, count } = await q.limit(1000);
  const rows = data ?? [];
  return {
    status: 'succes',
    total_cibles: count ?? rows.length,
    avec_email: rows.filter((r) => r.courriel_porteur && r.consentement_recueilli).length,
    sans_email: rows.filter((r) => !r.courriel_porteur || !r.consentement_recueilli).length,
    consentement_recueilli: rows.filter((r) => r.consentement_recueilli).length,
  };
}

// =============================================================================
// Lancement effectif de la vague
// =============================================================================

export async function lancerVagueEnquete(raw: unknown): Promise<LancerVagueResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (
    !utilisateur ||
    !['admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(utilisateur.role)
  ) {
    return { status: 'erreur_droits', message: 'Réservé aux rôles autorisés.' };
  }

  const parse = lancerVagueSchema.safeParse(raw);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      issues: parse.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  const data = parse.data;
  const supabase = await createSupabaseServerClient();

  // Sélection des cibles (RLS-safe)
  type Cible = { id: string; libelle: string; email: string | null };
  let cibles: Cible[] = [];

  if (data.questionnaire === 'A') {
    let q = supabase
      .from('beneficiaires')
      .select('id, prenom, nom, courriel, consentement_recueilli')
      .is('deleted_at', null);
    if (data.projet_code) q = q.eq('projet_code', data.projet_code);
    if (data.pays_code) q = q.eq('pays_code', data.pays_code);
    const { data: rows, error } = await q.limit(data.plafond + 1);
    if (error) return { status: 'erreur_inconnue', message: error.message };
    cibles = (rows ?? []).map((r) => ({
      id: r.id,
      libelle: `${r.prenom} ${r.nom}`,
      email: r.consentement_recueilli ? (r.courriel ?? null) : null,
    }));
  } else {
    let q = supabase
      .from('structures')
      .select('id, nom_structure, courriel_porteur, consentement_recueilli')
      .is('deleted_at', null);
    if (data.projet_code) q = q.eq('projet_code', data.projet_code);
    if (data.pays_code) q = q.eq('pays_code', data.pays_code);
    const { data: rows, error } = await q.limit(data.plafond + 1);
    if (error) return { status: 'erreur_inconnue', message: error.message };
    cibles = (rows ?? []).map((r) => ({
      id: r.id,
      libelle: r.nom_structure,
      email: r.consentement_recueilli ? (r.courriel_porteur ?? null) : null,
    }));
  }

  if (cibles.length > data.plafond) {
    return {
      status: 'plafond_depasse',
      message: `${cibles.length} cibles trouvées dépassent le plafond de ${data.plafond} par lancement (sécurité Resend Free 100/jour). Affinez les filtres ou augmentez le plafond.`,
      total_cibles: cibles.length,
      plafond: data.plafond,
    };
  }

  // Génération de tokens + envoi emails
  const envoyes_arr: Array<{ id: string; libelle: string; url: string }> = [];
  const sans_email: Array<{ id: string; libelle: string }> = [];
  const echecs: Array<{ id: string; libelle: string; message: string }> = [];

  for (const cible of cibles) {
    const emailDestinataire = data.email_test_override ?? cible.email ?? undefined;

    if (!emailDestinataire) {
      sans_email.push({ id: cible.id, libelle: cible.libelle });
      continue;
    }

    const result = await genererTokenEnquete({
      cibleType: data.questionnaire === 'A' ? 'beneficiaire' : 'structure',
      cibleId: cible.id,
      vagueEnquete: data.vague_enquete,
      emailDestinataire,
    });

    if (result.status === 'succes') {
      envoyes_arr.push({ id: cible.id, libelle: cible.libelle, url: result.url });
    } else {
      echecs.push({ id: cible.id, libelle: cible.libelle, message: result.message });
    }
  }

  revalidatePath('/enquetes');

  return {
    status: 'succes',
    total_cibles: cibles.length,
    envoyes: envoyes_arr.length,
    sans_email,
    echecs,
    tokens_generes: envoyes_arr,
  };
}
