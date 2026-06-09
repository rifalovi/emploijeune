'use server';

import { revalidatePath } from 'next/cache';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { hasPermission, canAccessContenuSection } from '@/lib/super-admin/permissions';

async function exigerAccesCms() {
  const u = await requireUtilisateurValide();
  if (u.role === 'super_admin') return u;
  if (u.role === 'admin_scs' && await hasPermission(u.id, 'contenu_pages')) return u;
  throw new Error('Accès non autorisé.');
}

async function exigerAccesCmsSection(page_key: string, section_key: string) {
  const u = await requireUtilisateurValide();
  if (u.role === 'super_admin') return u;
  if (u.role !== 'admin_scs') throw new Error('Accès non autorisé.');
  if (!await hasPermission(u.id, 'contenu_pages')) throw new Error('Accès non autorisé.');
  if (!await canAccessContenuSection(u.id, page_key, section_key)) throw new Error('Accès non autorisé.');
  return u;
}

async function exigerAccesCmsBlocId(id: string) {
  const u = await requireUtilisateurValide();
  if (u.role === 'super_admin') return;
  if (u.role !== 'admin_scs') throw new Error('Accès non autorisé.');
  if (!await hasPermission(u.id, 'contenu_pages')) throw new Error('Accès non autorisé.');
  const { data } = await db()
    .from('contenu_pages')
    .select('page_key, section_key')
    .eq('id', id)
    .single();
  if (!data) throw new Error('Bloc introuvable.');
  const row = data as { page_key: string; section_key: string };
  if (!await canAccessContenuSection(u.id, row.page_key, row.section_key)) throw new Error('Accès non autorisé.');
}

export type TypeContenu = 'h1' | 'h2' | 'h3' | 'sous_titre' | 'texte' | 'badge' | 'citation' | 'lien';

type Ok = { ok: true };
type Err = { ok: false; message: string };

function err(e: unknown): Err {
  return { ok: false, message: e instanceof Error ? e.message : 'Erreur inconnue' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseAdminClient() as any; }

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
    await exigerAccesCmsSection(params.page_key, params.section_key);
    const supabase = db();
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
    await exigerAccesCmsBlocId(id);
    const supabase = db();
    const { data, error } = await supabase
      .from('contenu_pages')
      .update({ valeur })
      .eq('id', id)
      .select('page_key');
    if (error) return { ok: false, message: error.message };
    const row = (data as { page_key: string }[] | null)?.[0];
    if (!row) return { ok: false, message: 'Ligne introuvable ou accès refusé.' };
    revalidatePagesPubliques(row.page_key);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Mettre à jour le type d'un bloc ──────────────────────────────────────────

export async function mettreAJourType(id: string, type_contenu: TypeContenu): Promise<Ok | Err> {
  try {
    await exigerAccesCmsBlocId(id);
    const supabase = db();
    const { data, error } = await supabase
      .from('contenu_pages')
      .update({ type_contenu })
      .eq('id', id)
      .select('page_key');
    if (error) return { ok: false, message: error.message };
    const row = (data as { page_key: string }[] | null)?.[0];
    if (!row) return { ok: false, message: 'Ligne introuvable ou accès refusé.' };
    revalidatePagesPubliques(row.page_key);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Supprimer un bloc ─────────────────────────────────────────────────────────

export async function supprimerBloc(id: string): Promise<Ok | Err> {
  try {
    await exigerAccesCmsBlocId(id);
    const supabase = db();
    const { data } = await supabase
      .from('contenu_pages')
      .delete()
      .eq('id', id)
      .select('page_key');
    const row = (data as { page_key: string }[] | null)?.[0];
    revalidatePagesPubliques(row?.page_key ?? 'accueil');
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Supprimer toute une section ───────────────────────────────────────────────

export async function supprimerSection(page_key: string, section_key: string): Promise<Ok | Err> {
  try {
    await exigerAccesCmsSection(page_key, section_key);
    const supabase = db();
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
    await exigerAccesCmsSection(page_key, ancien_key);
    const supabase = db();
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
    await exigerAccesCms();
    const supabase = db();
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
    await exigerAccesCmsBlocId(id);
    const supabase = db();
    const { data, error } = await supabase
      .from('contenu_pages')
      .update({ actif })
      .eq('id', id)
      .select('page_key');
    if (error) return { ok: false, message: error.message };
    const row = (data as { page_key: string }[] | null)?.[0];
    if (!row) return { ok: false, message: 'Ligne introuvable ou accès refusé.' };
    revalidatePagesPubliques(row.page_key);
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
