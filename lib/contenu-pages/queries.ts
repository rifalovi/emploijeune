import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function db() { return (await createSupabaseServerClient()) as any; }

export type ContenuBloc = {
  id: string;
  page_key: string;
  section_key: string;
  bloc_key: string;
  type_contenu: string;
  valeur: string;
  ordre: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Map flat : "section_key.bloc_key" → valeur.
 * null = bloc existe en base mais est masqué (actif = false).
 * Clé absente = bloc n'existe pas → utiliser le fallback hardcodé.
 */
export type ContenuMap = Map<string, string | null>;

export async function getContenuPage(pageKey: string): Promise<ContenuMap> {
  try {
    const supabase = await db();
    const { data } = await supabase
      .from('contenu_pages')
      .select('section_key, bloc_key, valeur, actif')
      .eq('page_key', pageKey)
      .order('ordre');

    const map = new Map<string, string | null>();
    for (const row of data ?? []) {
      // null si masqué, valeur si actif
      map.set(`${row.section_key}.${row.bloc_key}`, row.actif ? (row.valeur as string) : null);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Lecture complète pour l'interface admin (inclus inactifs, toutes métadonnées) */
export async function getContenuPageAdmin(pageKey: string): Promise<ContenuBloc[]> {
  const supabase = await db();
  const { data } = await supabase
    .from('contenu_pages')
    .select('*')
    .eq('page_key', pageKey)
    .order('section_key')
    .order('ordre');
  return (data ?? []) as ContenuBloc[];
}

/** Liste des page_key distinctes existantes en base */
export async function getPagesCms(): Promise<string[]> {
  const supabase = await db();
  const { data } = await supabase
    .from('contenu_pages')
    .select('page_key');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [...new Set(((data ?? []) as any[]).map((r) => r.page_key as string))].sort();
}

/** Toutes les pages et leurs sections — pour l'UI de configuration des permissions */
export async function getCmsPagesSections(): Promise<Record<string, string[]>> {
  const supabase = await db();
  const { data } = await supabase.from('contenu_pages').select('page_key, section_key');
  const map: Record<string, Set<string>> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    if (!map[row.page_key]) map[row.page_key] = new Set<string>();
    (map[row.page_key] as Set<string>).add(row.section_key as string);
  }
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, [...(v as Set<string>)].sort()])
  );
}
