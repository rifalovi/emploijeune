'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';

/**
 * Server Actions CRUD — tranches d'âge précises.
 * Réservé super_admin (la table est protégée par RLS is_super_admin()).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type TrancheAgePrecise = {
  id: string;
  libelle: string;
  borne_min: number | null;
  borne_max: number | null;
  categorie_oif: 'Jeune' | 'Adulte';
  ordre: number;
  actif: boolean;
  created_at: string;
};

type Resultat = { status: 'succes' } | { status: 'erreur'; message: string };

// ── Guard ────────────────────────────────────────────────────────────────────

async function exigerSuperAdmin(): Promise<
  | { utilisateur: NonNullable<Awaited<ReturnType<typeof getCurrentUtilisateur>>> }
  | { erreur: string }
> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur) return { erreur: 'non_authentifie' };
  if (utilisateur.role !== 'super_admin') return { erreur: 'reserve_super_admin' };
  return { utilisateur };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listerTranchesAge(): Promise<TrancheAgePrecise[]> {
  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)('tranches_age_precises')
    .select('id, libelle, borne_min, borne_max, categorie_oif, ordre, actif, created_at')
    .order('ordre');
  return (data ?? []) as TrancheAgePrecise[];
}

// ── Mutations ────────────────────────────────────────────────────────────────

const creerSchema = z.object({
  libelle: z.string().trim().min(1).max(50),
  borne_min: z.number().int().min(0).max(120).nullable(),
  borne_max: z.number().int().min(0).max(120).nullable(),
  categorie_oif: z.enum(['Jeune', 'Adulte']),
  ordre: z.number().int().min(0).max(100),
});

export async function creerTrancheAge(
  payload: z.infer<typeof creerSchema>,
): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = creerSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'Payload invalide.' };

  if (parsed.data.borne_min !== null && parsed.data.borne_max !== null
    && parsed.data.borne_min > parsed.data.borne_max) {
    return { status: 'erreur', message: 'La borne min doit être inférieure à la borne max.' };
  }

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('tranches_age_precises').insert({
    ...parsed.data,
    created_by: garde.utilisateur.user_id,
  });

  if (error) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return { status: 'erreur', message: `Le libellé "${parsed.data.libelle}" existe déjà.` };
    }
    return { status: 'erreur', message: error.message };
  }

  revalidatePath('/super-admin/referentiels/tranches-age');
  return { status: 'succes' };
}

const modifierSchema = z.object({
  id: z.string().uuid(),
  libelle: z.string().trim().min(1).max(50),
  borne_min: z.number().int().min(0).max(120).nullable(),
  borne_max: z.number().int().min(0).max(120).nullable(),
  categorie_oif: z.enum(['Jeune', 'Adulte']),
  ordre: z.number().int().min(0).max(100),
});

export async function modifierTrancheAge(
  payload: z.infer<typeof modifierSchema>,
): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = modifierSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'Payload invalide.' };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('tranches_age_precises')
    .update({
      libelle: parsed.data.libelle,
      borne_min: parsed.data.borne_min,
      borne_max: parsed.data.borne_max,
      categorie_oif: parsed.data.categorie_oif,
      ordre: parsed.data.ordre,
    })
    .eq('id', parsed.data.id);

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/referentiels/tranches-age');
  return { status: 'succes' };
}

export async function toggleActifTrancheAge(
  id: string,
  actif: boolean,
): Promise<Resultat> {
  const garde = await exigerSuperAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('tranches_age_precises')
    .update({ actif })
    .eq('id', id);

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/referentiels/tranches-age');
  return { status: 'succes' };
}
