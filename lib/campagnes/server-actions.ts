'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { genererTokenEnquete } from '@/lib/enquetes/tokens-publics';
import {
  creerCampagneSchema,
  type CompterStrateResult,
  type CreerCampagneResult,
  type LancerCampagneResult,
} from '@/lib/schemas/campagne';

/**
 * Server Actions des campagnes de collecte ciblées (V1.2.5).
 *
 * Ce fichier ne doit exporter QUE des fonctions async (Next 14 'use server').
 * Schéma Zod et types vivent dans `lib/schemas/campagne.ts`.
 *
 * Sécurité :
 *   - Garde rôle (admin_scs / editeur_projet / contributeur_partenaire) sur
 *     toutes les actions.
 *   - getCurrentUtilisateur() throw automatiquement en mode view-as
 *     (cf. v1.1.5) → impossible de créer/lancer une campagne en visualisation.
 *   - Filtres reproduits côté SQL via les fonctions compter_strate /
 *     lister_strate qui appliquent la garde rôle SECURITY DEFINER.
 */

// =============================================================================
// 1. compterStrate
// =============================================================================

export async function compterStrate(
  questionnaire: 'A' | 'B',
  filtres: Record<string, unknown>,
): Promise<CompterStrateResult> {
  const courant = await getCurrentUtilisateur();
  if (
    !courant ||
    !['admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(courant.role)
  ) {
    return { status: 'erreur', message: 'Réservé aux rôles autorisés.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('compter_strate', {
    p_questionnaire: questionnaire,
    p_filtres: filtres as never,
  });

  if (error) {
    return { status: 'erreur', message: error.message };
  }

  const payload = data as {
    erreur?: string;
    total?: number;
    avec_email?: number;
    sans_email?: number;
    sans_consentement?: number;
  };
  if (payload?.erreur) {
    return { status: 'erreur', message: payload.erreur };
  }

  return {
    status: 'succes',
    total: payload?.total ?? 0,
    avec_email: payload?.avec_email ?? 0,
    sans_email: payload?.sans_email ?? 0,
    sans_consentement: payload?.sans_consentement ?? 0,
  };
}

// =============================================================================
// 2. listerStrate (pagination mode manuel)
// =============================================================================

export type ListerStrateLigne = {
  id: string;
  libelle: string;
  email: string | null;
  pays_code: string;
  projet_code: string;
  annee: number;
  consentement: boolean;
};

export async function listerStrate(
  questionnaire: 'A' | 'B',
  filtres: Record<string, unknown>,
  recherche: string,
  limit = 50,
  offset = 0,
): Promise<
  | { status: 'succes'; lignes: ListerStrateLigne[]; total: number }
  | { status: 'erreur'; message: string }
> {
  const courant = await getCurrentUtilisateur();
  if (
    !courant ||
    !['admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(courant.role)
  ) {
    return { status: 'erreur', message: 'Réservé aux rôles autorisés.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('lister_strate', {
    p_questionnaire: questionnaire,
    p_filtres: filtres as never,
    p_recherche: recherche || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    return { status: 'erreur', message: error.message };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    libelle: string;
    email: string | null;
    pays_code: string;
    projet_code: string;
    annee: number;
    consentement: boolean;
    total_count: number;
  }>;

  const total = rows[0]?.total_count ?? 0;
  return {
    status: 'succes',
    total: Number(total),
    lignes: rows.map((r) => ({
      id: r.id,
      libelle: r.libelle,
      email: r.email,
      pays_code: r.pays_code,
      projet_code: r.projet_code,
      annee: r.annee,
      consentement: r.consentement,
    })),
  };
}

// =============================================================================
// 2.bis listerStrateIds (V1.5.1) — pré-cocher tous les éligibles d'un filtre
// =============================================================================

export async function listerStrateIds(
  questionnaire: 'A' | 'B',
  filtres: Record<string, unknown>,
): Promise<{ status: 'succes'; ids: string[] } | { status: 'erreur'; message: string }> {
  const courant = await getCurrentUtilisateur();
  if (
    !courant ||
    !['admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(courant.role)
  ) {
    return { status: 'erreur', message: 'Réservé aux rôles autorisés.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('lister_strate_ids', {
    p_questionnaire: questionnaire,
    p_filtres: filtres as never,
  });

  if (error) {
    return { status: 'erreur', message: error.message };
  }
  return { status: 'succes', ids: (data ?? []) as string[] };
}

// =============================================================================
// 3. creerCampagneBrouillon
// =============================================================================

export async function creerCampagneBrouillon(raw: unknown): Promise<CreerCampagneResult> {
  const courant = await getCurrentUtilisateur();
  if (
    !courant ||
    !['admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(courant.role)
  ) {
    return { status: 'erreur_droits', message: 'Réservé aux rôles autorisés.' };
  }

  const parse = creerCampagneSchema.safeParse(raw);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      issues: parse.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const data = parse.data;

  const supabase = await createSupabaseServerClient();
  const { data: insertedRows, error } = await supabase
    .from('campagnes_collecte')
    .insert({
      nom: data.nom,
      description: data.description ?? null,
      questionnaire: data.questionnaire,
      type_vague: data.type_vague,
      mode_selection: data.mode_selection as 'toutes' | 'filtres' | 'manuelle',
      filtres: (data.filtres ?? {}) as never,
      cibles_manuelles: data.cibles_manuelles ?? null,
      plafond: data.plafond,
      email_test_override: data.email_test_override ?? null,
      date_envoi_prevue: data.date_envoi_prevue ?? null,
      statut: 'brouillon',
      created_by: courant.user_id,
    })
    .select('id')
    .single();

  if (error || !insertedRows) {
    return {
      status: 'erreur_inconnue',
      message: `INSERT échoué : ${error?.message ?? 'erreur inconnue'}`,
    };
  }

  revalidatePath('/enquetes');
  return { status: 'succes', campagneId: insertedRows.id };
}

// =============================================================================
// 4. lancerCampagne
// =============================================================================

export async function lancerCampagne(campagneId: string): Promise<LancerCampagneResult> {
  const courant = await getCurrentUtilisateur();
  if (
    !courant ||
    !['admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(courant.role)
  ) {
    return { status: 'erreur_droits', message: 'Réservé aux rôles autorisés.' };
  }

  if (!/^[0-9a-fA-F-]{36}$/.test(campagneId)) {
    return { status: 'erreur_introuvable', message: 'Identifiant campagne invalide.' };
  }

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  // 1. Charge la campagne
  const { data: campagne, error: campErr } = await supabase
    .from('campagnes_collecte')
    .select(
      'id, nom, questionnaire, type_vague, mode_selection, filtres, cibles_manuelles, plafond, email_test_override, statut, created_by',
    )
    .eq('id', campagneId)
    .is('deleted_at', null)
    .maybeSingle();

  if (campErr || !campagne) {
    return { status: 'erreur_introuvable', message: 'Campagne introuvable.' };
  }

  // 2. Vérifie que le statut autorise le lancement
  if (campagne.statut !== 'brouillon' && campagne.statut !== 'programmee') {
    return {
      status: 'erreur_etat',
      message: `Campagne dans le statut « ${campagne.statut} » — relance impossible. Créez une nouvelle campagne.`,
    };
  }

  // 3. Détermine la liste des cibles selon mode_selection
  type Cible = { id: string; libelle: string; email: string | null; consentement: boolean };
  let cibles: Cible[] = [];

  if (campagne.mode_selection === 'manuelle') {
    const ids = (campagne.cibles_manuelles ?? []) as string[];
    if (ids.length === 0) {
      return {
        status: 'erreur_etat',
        message: 'Mode manuel mais aucune cible sélectionnée.',
      };
    }
    cibles = await chargerCiblesParIds(supabase, campagne.questionnaire as 'A' | 'B', ids);
  } else {
    cibles = await chargerCiblesParStrate(
      supabase,
      campagne.questionnaire as 'A' | 'B',
      (campagne.filtres ?? {}) as Record<string, unknown>,
      campagne.plafond + 1,
    );
  }

  // 4. Plafond
  if (cibles.length > campagne.plafond) {
    return {
      status: 'plafond_depasse',
      message: `${cibles.length} cibles trouvées dépassent le plafond de ${campagne.plafond}. Affinez les filtres ou augmentez le plafond.`,
      total_cibles: cibles.length,
      plafond: campagne.plafond,
    };
  }

  // 5. Génération tokens + envoi emails
  const envoyesArr: Array<{ id: string; libelle: string; url: string }> = [];
  const sansEmail: Array<{ id: string; libelle: string }> = [];
  const echecs: Array<{ id: string; libelle: string; message: string }> = [];

  for (const cible of cibles) {
    const emailDestinataire =
      campagne.email_test_override ?? (cible.consentement ? cible.email : null);

    if (!emailDestinataire) {
      sansEmail.push({ id: cible.id, libelle: cible.libelle });
      continue;
    }

    const result = await genererTokenEnquete({
      cibleType: campagne.questionnaire === 'A' ? 'beneficiaire' : 'structure',
      cibleId: cible.id,
      vagueEnquete: campagne.type_vague as never,
      emailDestinataire,
    });

    if (result.status === 'succes') {
      envoyesArr.push({ id: cible.id, libelle: cible.libelle, url: result.url });
      // Lier le token à cette campagne (best-effort, pas bloquant si échec)
      await adminClient
        .from('tokens_enquete_publique')
        .update({ campagne_id: campagne.id })
        .eq('token', result.token);
    } else {
      echecs.push({ id: cible.id, libelle: cible.libelle, message: result.message });
    }
  }

  // 6. Mise à jour campagne (statut + compteurs)
  await supabase
    .from('campagnes_collecte')
    .update({
      statut: 'envoyee',
      total_cibles: cibles.length,
      total_envoyes: envoyesArr.length,
      envoyee_at: new Date().toISOString(),
    })
    .eq('id', campagne.id);

  revalidatePath('/enquetes');
  return {
    status: 'succes',
    total_cibles: cibles.length,
    envoyes: envoyesArr.length,
    sans_email: sansEmail,
    echecs,
  };
}

// =============================================================================
// Helpers internes
// =============================================================================

async function chargerCiblesParIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  questionnaire: 'A' | 'B',
  ids: string[],
): Promise<Array<{ id: string; libelle: string; email: string | null; consentement: boolean }>> {
  if (questionnaire === 'A') {
    const { data } = await supabase
      .from('beneficiaires')
      .select('id, prenom, nom, courriel, consentement_recueilli')
      .in('id', ids)
      .is('deleted_at', null);
    return (data ?? []).map((r) => ({
      id: r.id,
      libelle: `${r.prenom} ${r.nom}`,
      email: r.courriel ?? null,
      consentement: r.consentement_recueilli,
    }));
  }
  const { data } = await supabase
    .from('structures')
    .select('id, nom_structure, courriel_porteur, consentement_recueilli')
    .in('id', ids)
    .is('deleted_at', null);
  return (data ?? []).map((r) => ({
    id: r.id,
    libelle: r.nom_structure,
    email: r.courriel_porteur ?? null,
    consentement: r.consentement_recueilli,
  }));
}

async function chargerCiblesParStrate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  questionnaire: 'A' | 'B',
  filtres: Record<string, unknown>,
  limit: number,
): Promise<Array<{ id: string; libelle: string; email: string | null; consentement: boolean }>> {
  const { data } = await supabase.rpc('lister_strate', {
    p_questionnaire: questionnaire,
    p_filtres: filtres as never,
    p_recherche: null,
    p_limit: limit,
    p_offset: 0,
  });
  return (
    (data ?? []) as Array<{
      id: string;
      libelle: string;
      email: string | null;
      consentement: boolean;
    }>
  ).map((r) => ({
    id: r.id,
    libelle: r.libelle,
    email: r.email,
    consentement: r.consentement,
  }));
}
