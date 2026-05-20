'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';

const anneeCourante = new Date().getFullYear();

/**
 * Toggle l'activation de la visualisation graphique pour un indicateur donné.
 * Réservé super_admin (vérifié par la RPC `toggle_indicateur_visu` côté BDD
 * + par cette Server Action en double garde).
 */

const togglePayloadSchema = z.object({
  code: z.string().min(1).max(4),
  visu_forcee: z.boolean(),
  valeur: z.boolean(),
});

export type ToggleVisuResult =
  | { status: 'succes'; code: string; visu_activee: boolean }
  | { status: 'erreur'; message: string };

export async function toggleIndicateurVisu(
  payload: z.infer<typeof togglePayloadSchema>,
): Promise<ToggleVisuResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    return { status: 'erreur', message: 'Réservé au super_admin.' };
  }

  const parsed = togglePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', message: 'Payload invalide.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('toggle_indicateur_visu', {
    p_code: parsed.data.code,
    p_visu_forcee: parsed.data.visu_forcee,
    p_valeur: parsed.data.valeur,
  });

  if (error) return { status: 'erreur', message: error.message };
  const result = data as { erreur?: string; succes?: boolean; visu_activee?: boolean };
  if (result?.erreur) return { status: 'erreur', message: result.erreur };

  revalidatePath('/indicateurs');
  revalidatePath(`/indicateurs/${parsed.data.code.toLowerCase()}`);

  return {
    status: 'succes',
    code: parsed.data.code,
    visu_activee: result.visu_activee ?? parsed.data.valeur,
  };
}

// ─── Saisie manuelle de valeurs d'indicateur ─────────────────────────────────

const saisieSchema = z.object({
  code: z.string().min(1).max(4),
  annee: z.coerce
    .number()
    .int()
    .min(2020)
    .max(anneeCourante + 1),
  numerateur: z.coerce.number().int().nullable().optional(),
  denominateur: z.coerce.number().int().positive().nullable().optional(),
  valeur_directe: z.coerce.number().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export type SaisieValeurResult =
  | { status: 'succes'; code: string; annee: number }
  | { status: 'erreur'; message: string };

/**
 * Enregistre ou met à jour une valeur saisie manuellement.
 * Réservé super_admin uniquement (double-gardé en Server Action + RPC).
 */
export async function enregistrerSaisieValeur(
  payload: z.infer<typeof saisieSchema>,
): Promise<SaisieValeurResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    return { status: 'erreur', message: 'Réservé au super_admin.' };
  }

  const parsed = saisieSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', message: parsed.error.issues[0]?.message ?? 'Payload invalide.' };
  }

  // Au moins une des 3 valeurs doit être renseignée
  if (parsed.data.numerateur === null || parsed.data.numerateur === undefined) {
    if (parsed.data.denominateur === null || parsed.data.denominateur === undefined) {
      if (parsed.data.valeur_directe === null || parsed.data.valeur_directe === undefined) {
        return {
          status: 'erreur',
          message:
            'Au moins une valeur (numérateur, dénominateur ou valeur directe) est obligatoire.',
        };
      }
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('enregistrer_valeur_indicateur_saisie', {
    p_code: parsed.data.code,
    p_annee: parsed.data.annee,
    p_numerateur: parsed.data.numerateur ?? null,
    p_denominateur: parsed.data.denominateur ?? null,
    p_valeur_directe: parsed.data.valeur_directe ?? null,
    p_note: parsed.data.note ?? null,
  });

  if (error) return { status: 'erreur', message: error.message };
  const result = data as { erreur?: string; succes?: boolean };
  if (result?.erreur) return { status: 'erreur', message: result.erreur };

  revalidatePath('/indicateurs');
  revalidatePath(`/indicateurs/${parsed.data.code.toLowerCase()}`);

  return { status: 'succes', code: parsed.data.code, annee: parsed.data.annee };
}

const suppressionSchema = z.object({
  code: z.string().min(1).max(4),
  annee: z.coerce.number().int(),
});

export async function supprimerSaisieValeur(
  payload: z.infer<typeof suppressionSchema>,
): Promise<SaisieValeurResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    return { status: 'erreur', message: 'Réservé au super_admin.' };
  }

  const parsed = suppressionSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'Payload invalide.' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('supprimer_valeur_indicateur_saisie', {
    p_code: parsed.data.code,
    p_annee: parsed.data.annee,
  });

  if (error) return { status: 'erreur', message: error.message };
  const result = data as { erreur?: string };
  if (result?.erreur) return { status: 'erreur', message: result.erreur };

  revalidatePath('/indicateurs');
  revalidatePath(`/indicateurs/${parsed.data.code.toLowerCase()}`);

  return { status: 'succes', code: parsed.data.code, annee: parsed.data.annee };
}

const publicationSchema = z.object({
  code: z.string().min(1).max(4),
  annee: z.coerce.number().int(),
  publie: z.boolean(),
});

/**
 * Bascule l'état brouillon ↔ publié d'une saisie.
 * Réservé super_admin uniquement (double-gardé en Server Action + RPC).
 */
export async function basculerPubliSaisieValeur(
  payload: z.infer<typeof publicationSchema>,
): Promise<SaisieValeurResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    return { status: 'erreur', message: 'Réservé au super_admin.' };
  }

  const parsed = publicationSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'Payload invalide.' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('basculer_publi_saisie_valeur', {
    p_code: parsed.data.code,
    p_annee: parsed.data.annee,
    p_publie: parsed.data.publie,
  });

  if (error) return { status: 'erreur', message: error.message };
  const result = data as { erreur?: string };
  if (result?.erreur) return { status: 'erreur', message: result.erreur };

  revalidatePath('/indicateurs');
  revalidatePath(`/indicateurs/${parsed.data.code.toLowerCase()}`);

  return { status: 'succes', code: parsed.data.code, annee: parsed.data.annee };
}

// ─── KPIs contextuels (champs secondaires pour la page publique Réalisations) ─

const kpisContexteSchema = z.object({
  code: z.string().min(1).max(4),
  pays_count: z.coerce.number().int().min(0).nullable().optional(),
  femmes_count: z.coerce.number().int().min(0).nullable().optional(),
  nb_jeunes: z.coerce.number().int().min(0).nullable().optional(),
  nb_adultes: z.coerce.number().int().min(0).nullable().optional(),
  participants_count: z.coerce.number().int().min(0).nullable().optional(),
  ayant_progresse: z.coerce.number().int().min(0).nullable().optional(),
  gain_moyen: z.coerce.number().int().min(0).nullable().optional(),
  sources_public_pct: z.coerce.number().int().min(0).max(100).nullable().optional(),
  sources_prive_pct: z.coerce.number().int().min(0).max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export type KpisContexteResult =
  | { status: 'succes'; code: string }
  | { status: 'erreur'; message: string };

/**
 * Crée ou met à jour les KPIs contextuels d'un indicateur.
 * Réservé super_admin uniquement.
 */
export async function enregistrerKpisContexte(
  payload: z.infer<typeof kpisContexteSchema>,
): Promise<KpisContexteResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    return { status: 'erreur', message: 'Réservé au super_admin.' };
  }

  const parsed = kpisContexteSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', message: parsed.error.issues[0]?.message ?? 'Payload invalide.' };
  }

  const { code, ...champs } = parsed.data;
  // Utilise le client admin pour contourner le RLS — l'autorisation est
  // déjà vérifiée ci-dessus (role super_admin uniquement).
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('kpis_contexte_indicateurs').upsert(
    {
      indicateur_code: code,
      ...champs,
      updated_at: new Date().toISOString(),
      updated_by: utilisateur.user_id,
    },
    { onConflict: 'indicateur_code' },
  );

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath(`/indicateurs/${code.toLowerCase()}`);
  revalidatePath(`/realisations/${code[0]?.toLowerCase() ?? 'a'}/${code.toLowerCase()}`);

  return { status: 'succes', code };
}

// ─────────────────────────────────────────────────────────────────────────────
// Masquage d'années auto-BDD (A1 / B1 / B4)
// ─────────────────────────────────────────────────────────────────────────────

const masquageAnneeSchema = z.object({
  code: z.enum(['A1', 'B1', 'B4']),
  annee: z.number().int().min(2020).max(2040),
  masquer: z.boolean(),
});

export type MasquageAnneeResult =
  | { status: 'succes'; code: string; annee: number; masque: boolean }
  | { status: 'erreur'; message: string };

/**
 * Masque ou démasque une année auto-BDD (A1/B1/B4) de la page publique.
 *
 * - Les admins voient toujours toutes les années (avec badge "masqué").
 * - Le public ne reçoit pas les années masquées dans la RPC.
 *
 * Cas d'usage : masquer une année partielle (ex. 2026 avec seulement
 * 2 bénéficiaires en cours d'année) pour éviter un chiffre trompeur.
 *
 * 🟡 Risque modéré : invalide le cache de la page publique (revalidatePath).
 */
export async function basculerMasquageAnnee(
  payload: z.infer<typeof masquageAnneeSchema>,
): Promise<MasquageAnneeResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    return { status: 'erreur', message: 'Réservé au super_admin.' };
  }

  const parsed = masquageAnneeSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', message: parsed.error.issues[0]?.message ?? 'Payload invalide.' };
  }

  const { code, annee, masquer } = parsed.data;
  // Utilise le client SERVEUR (pas admin) : la RPC SECURITY DEFINER vérifie
  // auth.uid() — le client admin (service_role) ne transmet pas le token
  // utilisateur, ce qui ferait retourner 'non_authentifie' par la RPC.
  // L'autorisation est déjà vérifiée ci-dessus (getCurrentUtilisateur).
  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('masquer_annee_indicateur', {
    p_code: code,
    p_annee: annee,
    p_masquer: masquer,
  });

  if (error) return { status: 'erreur', message: (error as { message: string }).message };

  const res = (data ?? null) as { erreur?: string; succes?: boolean } | null;
  if (res?.erreur) return { status: 'erreur', message: res.erreur };

  // Invalider le cache de la page publique ET de l'admin
  const pilier = code[0]?.toLowerCase() ?? 'a';
  revalidatePath(`/realisations/${pilier}/${code.toLowerCase()}`);
  revalidatePath('/realisations');
  revalidatePath('/');

  return { status: 'succes', code, annee, masque: masquer };
}
