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

export type TypeCollecte = 'A' | 'B';

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
  type: z.enum(['A', 'B']),
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
    await admin
      .from('liens_collecte_publique')
      .update({ statut: 'expire' })
      .eq('slug', slug);
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

export async function validerSoumission(
  soumissionId: string,
): Promise<ValiderSoumissionResult> {
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
  const projetCode = (lienRaw as { projet_code: string | null } | null)?.projet_code
    ?? (donnees['_projet_code'] as string | null)
    ?? null;

  // Insertion selon le type
  let entiteId: string | null = null;

  if (soumission.type === 'A') {
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
  } else {
    // Structure B — colonnes `*_code` pour les enums alignées sur le schéma
    // initial (migration 20260422, lignes 320-340).
    const payload = {
      nom_structure: (donnees['nom_structure'] as string) ?? '',
      type_structure_code: (donnees['type_structure_code'] as string) ?? 'AUTRE',
      secteur_activite_code: (donnees['secteur_activite_code'] as string) ?? 'AUTRE',
      statut_creation: (donnees['statut_creation'] as 'creation' | 'renforcement' | 'relance') ?? 'creation',
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
