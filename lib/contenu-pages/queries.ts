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

/** Map flat : "section_key.bloc_key" → valeur, pour usage dans les pages publiques */
export type ContenuMap = Map<string, string>;

export async function getContenuPage(pageKey: string): Promise<ContenuMap> {
  try {
    const supabase = await db();
    const { data } = await supabase
      .from('contenu_pages')
      .select('section_key, bloc_key, valeur')
      .eq('page_key', pageKey)
      .eq('actif', true)
      .order('ordre');

    const map = new Map<string, string>();
    for (const row of data ?? []) {
      map.set(`${row.section_key}.${row.bloc_key}`, row.valeur as string);
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
