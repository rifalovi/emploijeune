'use server';

/**
 * Server Actions — Liens de collecte publique
 * ============================================
 * Gestion des liens réutilisables (Type A / B) permettant l'enregistrement
 * public sans authentification ni token email.
 *
 * Workflow complet :
 *   creerLienCollecte()          — admin génère un lien
 *   validerLienSlug()            — côté public, vérifie que le slug est actif
 *   soumettreCollectePublique()  — soumet une fiche (sans auth)
 *   listerSoumissions()          — admin consulte les soumissions en attente
 *   validerSoumission()          — admin intègre en DB (bénéficiaire ou structure)
 *   rejeterSoumission()          — admin rejette avec motif
 *   listerLiensCollecte()        — admin liste ses liens + stats
 *   basculerStatutLien()         — admin active / désactive un lien
 */

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { z } from 'zod';

// =============================================================================
// Types publics
// =============================================================================

export type TypeCollecte = '0' | 'A' | 'B' | 'C' | 'D';

export type LienCollecte = {
  id: string;
  slug: string;
  type: TypeCollecte;
  label: string;
  projet_code: string | null;
  statut: 'actif' | 'inactif' | 'expire';
  expire_at: string | null;
  created_at: string;
  nb_total: number;
  nb_en_attente: number;
  nb_valide: number;
  nb_rejete: number;
  derniere_soumission_at: string | null;
  url: string;
};

export type SoumissionCollecte = {
  id: string;
  lien_id: string;
  lien_slug: string;
  lien_label: string;
  type: TypeCollecte;
  donnees: Record<string, unknown>;
  statut: 'en_attente' | 'valide' | 'rejete';
  motif_rejet: string | null;
  created_at: string;
  entite_creee_id: string | null;
};

export type InfoLienPublic = {
  slug: string;
  type: TypeCollecte;
  label: string;
  projet_code: string | null;
};

export type ValiderSlugResult =
  | { status: 'valide'; lien: InfoLienPublic }
  | { status: 'introuvable' }
  | { status: 'inactif' }
  | { status: 'expire' };

// =============================================================================
// Helpers
// =============================================================================

const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function genererSlug(longueur = 10): string {
  const bytes = randomBytes(longueur);
  return Array.from(bytes)
    .map((b) => SLUG_CHARS[b % SLUG_CHARS.length])
    .join('');
}

function baseUrl(): string {
  // 1. Domaine explicitement configuré (variable custom — priorité max)
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // 2. URL automatique injectée par Vercel (preview + production)
  //    VERCEL_URL est de la forme "myapp-git-main-xxx.vercel.app" (sans https://)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // 3. Développement local
  return 'http://localhost:3000';
}

function urlLien(slug: string): string {
  return `${baseUrl()}/collecte/public/${slug}`;
}

// =============================================================================
// 1. Créer un lien de collecte
// =============================================================================

const creerLienSchema = z.object({
  type: z.enum(['0', 'A', 'B', 'C', 'D']),
  label: z.string().trim().min(1, 'Le libellé est obligatoire').max(200),
  projet_code: z.string().nullable().optional(),
  expire_dans_jours: z.coerce.number().int().min(1).max(365).nullable().optional(),
});

export type CreerLienInput = z.infer<typeof creerLienSchema>;

export type CreerLienResult =
  | { status: 'succes'; lien: LienCollecte }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_validation'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function creerLienCollecte(input: CreerLienInput): Promise<CreerLienResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (
    !utilisateur ||
    !['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(
      utilisateur.role,
    )
  ) {
    return { status: 'erreur_droits', message: 'Droits insuffisants pour créer un lien.' };
  }

  const parsed = creerLienSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'erreur_validation',
      message: parsed.error.issues.map((e) => e.message).join(', '),
    };
  }

  const { type, label, projet_code, expire_dans_jours } = parsed.data;

  // Générer un slug unique (max 5 tentatives)
  const admin = createSupabaseAdminClient();
  let slug: string | null = null;
  for (let i = 0; i < 5; i++) {
    const candidate = genererSlug(10);
    const { data: existing } = await admin
      .from('liens_collecte_publique')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!existing) {
      slug = candidate;
      break;
    }
  }
  if (!slug) {
    return { status: 'erreur_inconnue', message: 'Impossible de générer un slug unique.' };
  }

  const expire_at = expire_dans_jours
    ? new Date(Date.now() + expire_dans_jours * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await admin
    .from('liens_collecte_publique')
    .insert({
      slug,
      type,
      label,
      projet_code: projet_code ?? null,
      expire_at,
      created_by: utilisateur.user_id,
    })
    .select('*')
    .single();

  if (error || !data) {
    return {
      status: 'erreur_inconnue',
      message: error?.message ?? 'Erreur lors de la création du lien.',
    };
  }

  revalidatePath('/collecte-publique');

  return {
    status: 'succes',
    lien: {
      ...data,
      type: data.type as TypeCollecte,
      statut: data.statut as LienCollecte['statut'],
      nb_total: 0,
      nb_en_attente: 0,
      nb_valide: 0,
      nb_rejete: 0,
      derniere_soumission_at: null,
      url: urlLien(slug),
    },
  };
}

// =============================================================================
// 2. Valider un slug côté public (sans authentification)
// =============================================================================

export async function validerLienSlug(slug: string): Promise<ValiderSlugResult> {
  if (!/^[a-zA-Z0-9_-]{6,32}$/.test(slug)) return { status: 'introuvable' };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('liens_collecte_publique')
    .select('slug, type, label, projet_code, statut, expire_at')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return { status: 'introuvable' };

  if (data.statut === 'inactif') return { status: 'inactif' };

  if (data.expire_at && new Date(data.expire_at).getTime() < Date.now()) {
    // Auto-marquer comme expiré
    await admin.from('liens_collecte_publique').update({ statut: 'expire' }).eq('slug', slug);
    return { status: 'expire' };
  }

  if (data.statut === 'expire') return { status: 'expire' };

  return {
    status: 'valide',
    lien: {
      slug: data.slug,
      type: data.type as TypeCollecte,
      label: data.label,
      projet_code: data.projet_code ?? null,
    },
  };
}

// =============================================================================
// 3. Soumettre une fiche (sans authentification)
// =============================================================================

const soumettreSchema = z.object({
  slug: z.string().min(6).max(32),
  donnees: z.record(z.string(), z.unknown()),
});

export type SoumettreResult =
  | { status: 'succes'; soumission_id: string }
  | { status: 'lien_invalide'; message: string }
  | { status: 'erreur_validation'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function soumettreCollectePublique(
  slug: string,
  donnees: Record<string, unknown>,
  ipAddress?: string,
): Promise<SoumettreResult> {
  const parsed = soumettreSchema.safeParse({ slug, donnees });
  if (!parsed.success) {
    return {
      status: 'erreur_validation',
      message: parsed.error.issues.map((e) => e.message).join(', '),
    };
  }

  // Valider le lien
  const validationResult = await validerLienSlug(slug);
  if (validationResult.status !== 'valide') {
    const messages: Record<string, string> = {
      introuvable: 'Ce lien est introuvable.',
      inactif: 'Ce lien de collecte est actuellement inactif.',
      expire: 'Ce lien de collecte a expiré.',
    };
    return {
      status: 'lien_invalide',
      message: messages[validationResult.status] ?? 'Lien invalide.',
    };
  }

  const { lien } = validationResult;
  const admin = createSupabaseAdminClient();

  // Récupérer l'ID du lien
  const { data: lienData } = await admin
    .from('liens_collecte_publique')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!lienData) {
    return { status: 'lien_invalide', message: 'Lien introuvable.' };
  }

  // Enrichir les données avec le projet si non fourni
  const donneesEnrichies = {
    ...donnees,
    _projet_code: lien.projet_code,
    _type: lien.type,
  };

  const { data: soumission, error } = await admin
    .from('soumissions_collecte')
    .insert({
      lien_id: lienData.id,
      type: lien.type,
      // donnees est typé JSONB côté DB ; cast `as never` pour autoriser
      // un Record<string, unknown> où le type généré attend Json.
      donnees: donneesEnrichies as never,
      ip_address: ipAddress ?? null,
    } as never)
    .select('id')
    .single();

  if (error || !soumission) {
    return {
      status: 'erreur_inconnue',
      message: error?.message ?? 'Erreur lors de la soumission.',
    };
  }

  return { status: 'succes', soumission_id: soumission.id };
}

// =============================================================================
// 4. Lister les liens (admin)
// =============================================================================

export type ListerLiensResult =
  | { status: 'succes'; liens: LienCollecte[] }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function listerLiensCollecte(): Promise<ListerLiensResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur) {
    return { status: 'erreur_droits', message: 'Non authentifié.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('v_liens_collecte_stats')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { status: 'erreur_inconnue', message: error.message };
  }

  const liens: LienCollecte[] = (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    type: row.type as TypeCollecte,
    label: row.label as string,
    projet_code: (row.projet_code as string | null) ?? null,
    statut: (row.statut as LienCollecte['statut']) ?? 'actif',
    expire_at: (row.expire_at as string | null) ?? null,
    created_at: row.created_at as string,
    nb_total: Number(row.nb_total ?? 0),
    nb_en_attente: Number(row.nb_en_attente ?? 0),
    nb_valide: Number(row.nb_valide ?? 0),
    nb_rejete: Number(row.nb_rejete ?? 0),
    derniere_soumission_at: (row.derniere_soumission_at as string | null) ?? null,
    url: urlLien(row.slug as string),
  }));

  return { status: 'succes', liens };
}

// =============================================================================
// 5. Lister les soumissions (admin, filtrable par lien ou statut)
// =============================================================================

export type ListerSoumissionsResult =
  | { status: 'succes'; soumissions: SoumissionCollecte[] }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function listerSoumissions(opts?: {
  lien_id?: string;
  statut?: 'en_attente' | 'valide' | 'rejete';
  limit?: number;
}): Promise<ListerSoumissionsResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (
    !utilisateur ||
    !['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(
      utilisateur.role,
    )
  ) {
    return { status: 'erreur_droits', message: 'Droits insuffisants.' };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('soumissions_collecte')
    .select(
      `
      id, lien_id, type, donnees, statut, motif_rejet, created_at, entite_creee_id,
      lien:liens_collecte_publique!lien_id ( slug, label )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.lien_id) query = query.eq('lien_id', opts.lien_id);
  if (opts?.statut) query = query.eq('statut', opts.statut);

  const { data, error } = await query;

  if (error) {
    return { status: 'erreur_inconnue', message: error.message };
  }

  const soumissions: SoumissionCollecte[] = (data ?? []).map((row) => {
    const lienRaw = Array.isArray(row.lien) ? row.lien[0] : row.lien;
    return {
      id: row.id,
      lien_id: row.lien_id,
      lien_slug: (lienRaw as { slug: string } | null)?.slug ?? '',
      lien_label: (lienRaw as { label: string } | null)?.label ?? '',
      type: row.type as TypeCollecte,
      donnees: (row.donnees as Record<string, unknown>) ?? {},
      statut: row.statut as SoumissionCollecte['statut'],
      motif_rejet: row.motif_rejet ?? null,
      created_at: row.created_at,
      entite_creee_id: row.entite_creee_id ?? null,
    };
  });

  return { status: 'succes', soumissions };
}

// =============================================================================
// 6. Valider une soumission → insertion en base
// =============================================================================

export type ValiderSoumissionResult =
  | { status: 'succes'; entite_id: string; type: TypeCollecte }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_inconnue'; message: string }
  | { status: 'deja_traitee'; message: string };

export async function validerSoumission(soumissionId: string): Promise<ValiderSoumissionResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    return { status: 'erreur_droits', message: 'Réservé aux admins.' };
  }

  const admin = createSupabaseAdminClient();

  // Récupérer la soumission
  const { data: soumission, error: fetchError } = await admin
    .from('soumissions_collecte')
    .select('*, lien:liens_collecte_publique!lien_id ( projet_code )')
    .eq('id', soumissionId)
    .maybeSingle();

  if (fetchError || !soumission) {
    return { status: 'erreur_inconnue', message: 'Soumission introuvable.' };
  }

  if (soumission.statut !== 'en_attente') {
    return { status: 'deja_traitee', message: `Soumission déjà ${soumission.statut}.` };
  }

  const donnees = soumission.donnees as Record<string, unknown>;
  const lienRaw = Array.isArray(soumission.lien) ? soumission.lien[0] : soumission.lien;
  const projetCode =
    (lienRaw as { projet_code: string | null } | null)?.projet_code ??
    (donnees['_projet_code'] as string | null) ??
    null;

  // Insertion selon le type
  let entiteId: string | null = null;

  if (soumission.type === '0') {
    // Type 0 — formulaire unifié. Le routing dépend de meta.categorie.
    const meta = (donnees['meta'] ?? {}) as Record<string, unknown>;
    const cat = (meta['categorie'] as string) ?? 'beneficiaire';

    // Stocker la catégorie dans la colonne dédiée
    await admin
      .from('soumissions_collecte')
      .update({ categorie_repondant: cat } as never)
      .eq('id', soumission.id);

    if (cat === 'beneficiaire') {
      const payload = {
        prenom: (donnees['prenom'] as string) ?? '',
        nom: (donnees['nom'] as string) ?? '',
        sexe: (donnees['sexe'] as 'F' | 'M' | 'Autre') ?? 'M',
        projet_code: projetCode ?? (donnees['projet_code'] as string) ?? '',
        pays_code: (donnees['pays_code'] as string) || 'ZZZ',
        domaine_formation_code: 'AUTRE',
        annee_formation: new Date().getFullYear(),
        statut_code: 'INSCRIT',
        consentement_recueilli: Boolean(donnees['consentement']),
        source_import: 'formulaire_web' as const,
        tranche_age_declaree: (donnees['tranche_age_declaree'] as string | null) ?? null,
      };
      const { data: ben, error: benError } = await admin
        .from('beneficiaires')
        .insert(payload as never)
        .select('id')
        .single();
      if (benError || !ben) {
        return { status: 'erreur_inconnue', message: benError?.message ?? 'Erreur insertion bénéficiaire.' };
      }
      entiteId = ben.id;
    } else if (cat === 'structure') {
      const payload = {
        nom_structure: (donnees['nom_structure'] as string) ?? '',
        projet_code: projetCode ?? (donnees['projet_code'] as string) ?? '',
        pays_code: (donnees['pays_code'] as string) || 'ZZZ',
        type_structure_code: 'AUTRE',
        secteur_activite_code: 'AUTRE',
        statut_creation_code: 'CREATION',
        nature_appui_code: 'FORMATION',
        annee_appui: new Date().getFullYear(),
        porteur_nom: (donnees['porteur_nom'] as string) ?? '',
        porteur_sexe: (donnees['porteur_sexe'] as string) ?? 'M',
        consentement_recueilli: Boolean(donnees['consentement']),
        source_import: 'formulaire_web' as const,
      };
      const { data: str, error: strError } = await admin
        .from('structures')
        .insert(payload as never)
        .select('id')
        .single();
      if (strError || !str) {
        return { status: 'erreur_inconnue', message: strError?.message ?? 'Erreur insertion structure.' };
      }
      entiteId = str.id;
    }
  } else if (soumission.type === 'A') {
    // Bénéficiaire — colonnes alignées sur le schéma initial (migrations 20260422 + 20260511).
    // `source_import` est un enum public.source_import qui n'inclut PAS
    // 'collecte_publique_v1' → on utilise 'formulaire_web' (sémantique adjacente).
    const payload = {
      prenom: (donnees['prenom'] as string) ?? '',
      nom: (donnees['nom'] as string) ?? '',
      sexe: (donnees['sexe'] as 'F' | 'M' | 'Autre') ?? 'M',
      projet_code: projetCode ?? (donnees['projet_code'] as string) ?? '',
      pays_code: (donnees['pays_code'] as string) ?? '',
      domaine_formation_code: (donnees['domaine_formation_code'] as string) ?? 'AUTRE',
      annee_formation: Number(donnees['annee_formation'] ?? new Date().getFullYear()),
      statut_code: 'INSCRIT',
      consentement_recueilli: false,
      telephone: (donnees['telephone'] as string | null) ?? null,
      courriel: (donnees['courriel'] as string | null) ?? null,
      source_import: 'formulaire_web' as const,
      tranche_age_declaree: (donnees['tranche_age_declaree'] as string | null) ?? null,
    };

    const { data: ben, error: benError } = await admin
      .from('beneficiaires')
      .insert(payload as never)
      .select('id')
      .single();

    if (benError || !ben) {
      return {
        status: 'erreur_inconnue',
        message: benError?.message ?? 'Erreur insertion bénéficiaire.',
      };
    }
    entiteId = ben.id;
  } else if (soumission.type === 'C') {
    // Type C — bénéficiaire + lignes questionnaire intermédiation (C1/C2/C4/C5).
    // Étape 1 : créer le bénéficiaire (identique à A).
    const payloadBen = {
      prenom: (donnees['prenom'] as string) ?? '',
      nom: (donnees['nom'] as string) ?? '',
      sexe: (donnees['sexe'] as 'F' | 'M' | 'Autre') ?? 'M',
      projet_code: projetCode ?? (donnees['projet_code'] as string) ?? '',
      pays_code: (donnees['pays_code'] as string) ?? '',
      domaine_formation_code: (donnees['domaine_formation_code'] as string) ?? 'AUTRE',
      annee_formation: Number(donnees['annee_formation'] ?? new Date().getFullYear()),
      statut_code: 'INSCRIT',
      consentement_recueilli: false,
      telephone: (donnees['telephone'] as string | null) ?? null,
      courriel: (donnees['courriel'] as string | null) ?? null,
      source_import: 'formulaire_web' as const,
      tranche_age_declaree: (donnees['tranche_age_declaree'] as string | null) ?? null,
    };

    const { data: ben, error: benError } = await admin
      .from('beneficiaires')
      .insert(payloadBen as never)
      .select('id')
      .single();

    if (benError || !ben) {
      return {
        status: 'erreur_inconnue',
        message: benError?.message ?? 'Erreur insertion bénéficiaire (C).',
      };
    }
    entiteId = ben.id;

    // Étape 2 : créer les 4 lignes du questionnaire C dans reponses_enquetes.
    const sessionId = crypto.randomUUID();
    const dateCollecte = new Date().toISOString().slice(0, 10);
    const projetFinal = projetCode ?? (donnees['projet_code'] as string) ?? null;

    const c1Data = {
      a_beneficie: donnees['c1_a_beneficie'] ?? false,
      type_intermediation: donnees['c1_type_intermediation'] ?? null,
      type_intermediation_autre: donnees['c1_type_intermediation_autre'] ?? null,
    };
    const c2Data = {
      a_ete_place: donnees['c2_a_ete_place'] ?? null,
      annee_placement: donnees['c2_annee_placement'] ?? null,
      nature_emploi: donnees['c2_nature_emploi'] ?? null,
    };
    const c4Data = {
      delai_placement: donnees['c4_delai_placement'] ?? null,
    };
    const c5Data = {
      source_questionnaire: 'C',
      satisfaction: donnees['c5_satisfaction'] ?? null,
      observations: donnees['c5_observations'] ?? null,
    };

    const lignesC = [
      { indicateur_code: 'C1', donnees: c1Data },
      { indicateur_code: 'C2', donnees: c2Data },
      { indicateur_code: 'C4', donnees: c4Data },
      { indicateur_code: 'C5', donnees: c5Data },
    ].map((l) => ({
      indicateur_code: l.indicateur_code,
      beneficiaire_id: ben.id,
      structure_id: null,
      projet_code: projetFinal,
      donnees: l.donnees as never,
      date_collecte: dateCollecte,
      vague_enquete: 'ponctuelle' as const,
      canal_collecte: 'formulaire_web' as const,
      session_enquete_id: sessionId,
      questionnaire_code: 'C',
      lien_public_token: null,
    }));

    await admin.from('reponses_enquetes').insert(lignesC as never);
  } else if (soumission.type === 'D') {
    // Type D — structure (acteur institutionnel) + 3 lignes questionnaire écosystèmes
    // (D1, D2, D3). Création de la structure identique à B (champs minimaux),
    // puis insertion des 3 indicateurs dans reponses_enquetes.
    const payloadStructure = {
      nom_structure: (donnees['nom_structure'] as string) ?? '',
      type_structure_code: (donnees['type_structure_code'] as string) ?? 'AUTRE',
      secteur_activite_code: (donnees['secteur_activite_code'] as string) ?? 'AUTRE',
      statut_creation: 'creation' as const,
      annee_appui: Number(donnees['annee_appui'] ?? new Date().getFullYear()),
      nature_appui_code: 'AUTRE',
      projet_code: projetCode ?? (donnees['projet_code'] as string) ?? '',
      pays_code: (donnees['pays_code'] as string) ?? '',
      porteur_nom: (donnees['porteur_nom'] as string) ?? '',
      porteur_prenom: (donnees['porteur_prenom'] as string | null) ?? null,
      porteur_sexe: (donnees['porteur_sexe'] as 'F' | 'M' | 'Autre') ?? 'M',
      telephone_porteur: (donnees['telephone'] as string | null) ?? null,
      courriel_porteur: (donnees['courriel'] as string | null) ?? null,
      intitule_initiative: null,
      consentement_recueilli: false,
      source_import: 'formulaire_web' as const,
    };

    const { data: str, error: strError } = await admin
      .from('structures')
      .insert(payloadStructure as never)
      .select('id')
      .single();

    if (strError || !str) {
      return {
        status: 'erreur_inconnue',
        message: strError?.message ?? 'Erreur insertion structure (D).',
      };
    }
    entiteId = str.id;

    // Étape 2 : créer les 3 lignes du questionnaire D dans reponses_enquetes.
    const sessionId = crypto.randomUUID();
    const dateCollecte = new Date().toISOString().slice(0, 10);
    const projetFinal = projetCode ?? (donnees['projet_code'] as string) ?? null;

    const d1Data = {
      a_appuye: donnees['d1_a_appuye'] ?? false,
      type_dispositif: donnees['d1_type_dispositif'] ?? null,
      type_dispositif_autre: donnees['d1_type_dispositif_autre'] ?? null,
      intitule_dispositif: donnees['d1_intitule_dispositif'] ?? null,
      niveau_adoption: donnees['d1_niveau_adoption'] ?? null,
    };
    const d2Data = {
      a_ete_forme: donnees['d2_a_ete_forme'] ?? false,
      type_acteur: donnees['d2_type_acteur'] ?? null,
      nb_formes: donnees['d2_nb_formes'] ?? null,
      nb_femmes_formees: donnees['d2_nb_femmes_formees'] ?? null,
      amelioration_declaree: donnees['d2_amelioration_declaree'] ?? null,
    };
    const d3Data = {
      effets_observes: donnees['d3_effets_observes'] ?? null,
      niveau_observation: donnees['d3_niveau_observation'] ?? null,
      elements_preuve: donnees['d3_elements_preuve'] ?? null,
      observations: donnees['observations_libres'] ?? null,
    };

    const lignesD = [
      { indicateur_code: 'D1', donnees: d1Data },
      { indicateur_code: 'D2', donnees: d2Data },
      { indicateur_code: 'D3', donnees: d3Data },
    ].map((l) => ({
      indicateur_code: l.indicateur_code,
      beneficiaire_id: null,
      structure_id: str.id,
      projet_code: projetFinal,
      donnees: l.donnees as never,
      date_collecte: dateCollecte,
      vague_enquete: 'ponctuelle' as const,
      canal_collecte: 'formulaire_web' as const,
      session_enquete_id: sessionId,
      questionnaire_code: 'D',
      lien_public_token: null,
    }));

    await admin.from('reponses_enquetes').insert(lignesD as never);
  } else {
    // Structure B — colonnes `*_code` pour les enums alignées sur le schéma
    // initial (migration 20260422, lignes 320-340).
    const payload = {
      nom_structure: (donnees['nom_structure'] as string) ?? '',
      type_structure_code: (donnees['type_structure_code'] as string) ?? 'AUTRE',
      secteur_activite_code: (donnees['secteur_activite_code'] as string) ?? 'AUTRE',
      statut_creation:
        (donnees['statut_creation'] as 'creation' | 'renforcement' | 'relance') ?? 'creation',
      annee_appui: Number(donnees['annee_appui'] ?? new Date().getFullYear()),
      nature_appui_code: (donnees['nature_appui_code'] as string) ?? 'AUTRE',
      projet_code: projetCode ?? (donnees['projet_code'] as string) ?? '',
      pays_code: (donnees['pays_code'] as string) ?? '',
      porteur_nom: (donnees['porteur_nom'] as string) ?? '',
      porteur_prenom: (donnees['porteur_prenom'] as string | null) ?? null,
      porteur_sexe: (donnees['porteur_sexe'] as 'F' | 'M' | 'Autre') ?? 'M',
      telephone_porteur: (donnees['telephone'] as string | null) ?? null,
      courriel_porteur: (donnees['courriel'] as string | null) ?? null,
      intitule_initiative: (donnees['intitule_initiative'] as string | null) ?? null,
      consentement_recueilli: false,
      source_import: 'formulaire_web' as const,
    };

    const { data: str, error: strError } = await admin
      .from('structures')
      .insert(payload as never)
      .select('id')
      .single();

    if (strError || !str) {
      return {
        status: 'erreur_inconnue',
        message: strError?.message ?? 'Erreur insertion structure.',
      };
    }
    entiteId = str.id;
  }

  // Marquer la soumission comme validée
  await admin
    .from('soumissions_collecte')
    .update({
      statut: 'valide',
      valide_par: utilisateur.user_id,
      valide_at: new Date().toISOString(),
      entite_creee_id: entiteId,
    })
    .eq('id', soumissionId);

  revalidatePath('/collecte-publique');
  revalidatePath('/beneficiaires');
  revalidatePath('/structures');

  return { status: 'succes', entite_id: entiteId!, type: soumission.type as TypeCollecte };
}

// =============================================================================
// 7. Rejeter une soumission
// =============================================================================

export type RejeterSoumissionResult =
  | { status: 'succes' }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_inconnue'; message: string }
  | { status: 'deja_traitee'; message: string };

export async function rejeterSoumission(
  soumissionId: string,
  motif: string,
): Promise<RejeterSoumissionResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    return { status: 'erreur_droits', message: 'Réservé aux admins.' };
  }

  const admin = createSupabaseAdminClient();

  const { data: soumission } = await admin
    .from('soumissions_collecte')
    .select('statut')
    .eq('id', soumissionId)
    .maybeSingle();

  if (!soumission) {
    return { status: 'erreur_inconnue', message: 'Soumission introuvable.' };
  }

  if (soumission.statut !== 'en_attente') {
    return { status: 'deja_traitee', message: `Soumission déjà ${soumission.statut}.` };
  }

  const { error } = await admin
    .from('soumissions_collecte')
    .update({
      statut: 'rejete',
      motif_rejet: motif.trim() || 'Non conforme',
      valide_par: utilisateur.user_id,
      valide_at: new Date().toISOString(),
    })
    .eq('id', soumissionId);

  if (error) {
    return { status: 'erreur_inconnue', message: error.message };
  }

  revalidatePath('/collecte-publique');
  return { status: 'succes' };
}

// =============================================================================
// 8. Basculer le statut d'un lien (actif ↔ inactif)
// =============================================================================

export type BasculerStatutResult =
  | { status: 'succes'; nouveau_statut: 'actif' | 'inactif' }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function basculerStatutLien(
  lienId: string,
  nouveauStatut: 'actif' | 'inactif',
): Promise<BasculerStatutResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    return { status: 'erreur_droits', message: 'Réservé aux admins.' };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('liens_collecte_publique')
    .update({ statut: nouveauStatut })
    .eq('id', lienId);

  if (error) {
    return { status: 'erreur_inconnue', message: error.message };
  }

  revalidatePath('/collecte-publique');
  return { status: 'succes', nouveau_statut: nouveauStatut };
}

// =============================================================================
// 8. Supprimer un lien (soft delete — réservé aux admins)
// =============================================================================

export type SupprimerLienResult =
  | { status: 'succes' }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function supprimerLienCollecte(lienId: string): Promise<SupprimerLienResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    return { status: 'erreur_droits', message: 'Réservé aux admins.' };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('liens_collecte_publique')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', lienId)
    .is('deleted_at', null);

  if (error) {
    return { status: 'erreur_inconnue', message: error.message };
  }

  revalidatePath('/collecte-publique');
  return { status: 'succes' };
}
