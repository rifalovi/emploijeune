'use server';

import { revalidatePath } from 'next/cache';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function exigerSuperAdmin() {
  const u = await requireUtilisateurValide();
  if (u.role !== 'super_admin') throw new Error('Accès réservé au super administrateur.');
  return u;
}

export type TypeContenu = 'h1' | 'h2' | 'h3' | 'sous_titre' | 'texte' | 'badge' | 'citation' | 'lien';

type Ok = { ok: true };
type Err = { ok: false; message: string };

function err(e: unknown): Err {
  return { ok: false, message: e instanceof Error ? e.message : 'Erreur inconnue' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function db() { return (await createSupabaseServerClient()) as any; }

// ── Sauvegarder / créer un bloc (upsert) ─────────────────────────────────────

export async function sauvegarderBloc(params: {
  page_key: string;
  section_key: string;
  bloc_key: string;
  type_contenu: TypeContenu;
  valeur: string;
  ordre?: number;
  actif?: boolean;
}): Promise<Ok | Err> {
  try {
    await exigerSuperAdmin();
    const supabase = await db();
    const { error } = await supabase.from('contenu_pages').upsert(
      {
        page_key: params.page_key,
        section_key: params.section_key,
        bloc_key: params.bloc_key,
        type_contenu: params.type_contenu,
        valeur: params.valeur,
        ordre: params.ordre ?? 0,
        actif: params.actif ?? true,
      },
      { onConflict: 'page_key,section_key,bloc_key' }
    );
    if (error) return { ok: false, message: error.message };
    revalidatePagesPubliques(params.page_key);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Mettre à jour la valeur d'un bloc existant (par id) ──────────────────────

export async function mettreAJourValeur(id: string, valeur: string): Promise<Ok | Err> {
  try {
    await exigerSuperAdmin();
    const supabase = await db();
    const { data, error } = await supabase
      .from('contenu_pages')
      .update({ valeur })
      .eq('id', id)
      .select('page_key')
      .single();
    if (error) return { ok: false, message: error.message };
    revalidatePagesPubliques((data as { page_key: string }).page_key);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Mettre à jour le type d'un bloc ──────────────────────────────────────────

export async function mettreAJourType(id: string, type_contenu: TypeContenu): Promise<Ok | Err> {
  try {
    await exigerSuperAdmin();
    const supabase = await db();
    const { data, error } = await supabase
      .from('contenu_pages')
      .update({ type_contenu })
      .eq('id', id)
      .select('page_key')
      .single();
    if (error) return { ok: false, message: error.message };
    revalidatePagesPubliques((data as { page_key: string }).page_key);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Supprimer un bloc ─────────────────────────────────────────────────────────

export async function supprimerBloc(id: string): Promise<Ok | Err> {
  try {
    await exigerSuperAdmin();
    const supabase = await db();
    const { data } = await supabase
      .from('contenu_pages')
      .delete()
      .eq('id', id)
      .select('page_key')
      .single();
    revalidatePagesPubliques((data as { page_key: string } | null)?.page_key ?? 'accueil');
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Supprimer toute une section ───────────────────────────────────────────────

export async function supprimerSection(page_key: string, section_key: string): Promise<Ok | Err> {
  try {
    await exigerSuperAdmin();
    const supabase = await db();
    const { error } = await supabase
      .from('contenu_pages')
      .delete()
      .eq('page_key', page_key)
      .eq('section_key', section_key);
    if (error) return { ok: false, message: error.message };
    revalidatePagesPubliques(page_key);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Renommer une section ──────────────────────────────────────────────────────

export async function renommerSection(
  page_key: string,
  ancien_key: string,
  nouveau_key: string
): Promise<Ok | Err> {
  try {
    await exigerSuperAdmin();
    const supabase = await db();
    const { error } = await supabase
      .from('contenu_pages')
      .update({ section_key: nouveau_key })
      .eq('page_key', page_key)
      .eq('section_key', ancien_key);
    if (error) return { ok: false, message: error.message };
    revalidatePagesPubliques(page_key);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Réordonner les blocs ──────────────────────────────────────────────────────

export async function reordonnerBlocs(
  blocs: Array<{ id: string; ordre: number }>
): Promise<Ok | Err> {
  try {
    await exigerSuperAdmin();
    const supabase = await db();
    for (const b of blocs) {
      await supabase.from('contenu_pages').update({ ordre: b.ordre }).eq('id', b.id);
    }
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Basculer actif/inactif ────────────────────────────────────────────────────

export async function toggleActifBloc(id: string, actif: boolean): Promise<Ok | Err> {
  try {
    await exigerSuperAdmin();
    const supabase = await db();
    const { data, error } = await supabase
      .from('contenu_pages')
      .update({ actif })
      .eq('id', id)
      .select('page_key')
      .single();
    if (error) return { ok: false, message: error.message };
    revalidatePagesPubliques((data as { page_key: string }).page_key);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Utilitaire revalidate ─────────────────────────────────────────────────────

function revalidatePagesPubliques(pageKey: string) {
  if (pageKey === 'accueil') {
    revalidatePath('/');
    revalidatePath('/accueil');
  } else if (pageKey === 'realisations') {
    revalidatePath('/realisations');
    revalidatePath('/realisations/[pilier]', 'page');
  } else if (pageKey === 'referentiels') {
    revalidatePath('/referentiels');
    revalidatePath('/referentiels/[code]', 'page');
  } else {
    revalidatePath(`/${pageKey}`);
  }
}
