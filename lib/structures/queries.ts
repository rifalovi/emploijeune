import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { StructureFilters } from '@/lib/schemas/structure';

/**
 * Lignes listées dans la table structures. Projection serveur des seules
 * colonnes affichées (limite la charge réseau).
 */
export type StructureListItem = {
  id: string;
  nom_structure: string;
  type_structure_code: string;
  secteur_activite_code: string;
  pays_code: string;
  projet_code: string;
  porteur_nom: string;
  porteur_prenom: string | null;
  annee_appui: number;
  nature_appui_code: string;
  montant_appui: number | null;
  devise_code: string | null;
  statut_creation: 'creation' | 'renforcement' | 'relance';
  consentement_recueilli: boolean;
  created_by: string | null;
  organisation_id: string | null;
  updated_at: string;
};

export type ListStructuresResult = {
  rows: StructureListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Récupère une page de structures selon les filtres. RLS appliquée
 * automatiquement (chaque rôle ne voit que son périmètre).
 *
 * Si `filters.q` est fourni, on passe d'abord par la fonction SQL
 * `rechercher_structures` (pg_trgm similarity) pour obtenir les IDs triés
 * par pertinence, puis on charge les colonnes en respectant cet ordre.
 *
 * Si `filters.ps` est fourni (PS1/PS2/PS3), on filtre via résolution des
 * codes projet du PS (≤ 23 projets, coût négligeable).
 */
export async function listStructures(
  filters: StructureFilters,
  pageSize: number = 25,
): Promise<ListStructuresResult> {
  const supabase = await createSupabaseServerClient();
  const page = filters.page ?? 1;
  const offset = (page - 1) * pageSize;

  // -- Étape 1 : recherche textuelle (si q) → IDs ordonnés par pertinence
  let idsParPertinence: string[] | null = null;
  if (filters.q) {
    const { data: hits, error: searchErr } = await supabase.rpc('rechercher_structures', {
      search_text: filters.q,
    });
    if (searchErr) {
      throw new Error(`Recherche indisponible : ${searchErr.message}`);
    }
    idsParPertinence = (hits ?? []).map((h: { id: string }) => h.id);
    if (idsParPertinence.length === 0) {
      return { rows: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }

  // -- Étape 2 : résolution PS → liste de codes projet
  let codesProjetsPS: string[] | null = null;
  if (filters.ps) {
    const { data: projetsPS } = await supabase
      .from('projets')
      .select('code')
      .eq('programme_strategique', filters.ps);
    codesProjetsPS = (projetsPS ?? []).map((p) => p.code);
    if (codesProjetsPS.length === 0) {
      return { rows: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }

  // -- Étape 3 : requête principale
  let query = supabase
    .from('structures')
    .select(
      'id, nom_structure, type_structure_code, secteur_activite_code, pays_code, projet_code, porteur_nom, porteur_prenom, annee_appui, nature_appui_code, montant_appui, devise_code, statut_creation, consentement_recueilli, created_by, organisation_id, updated_at',
      { count: 'exact' },
    )
    .is('deleted_at', null);

  if (idsParPertinence) query = query.in('id', idsParPertinence);
  if (codesProjetsPS) query = query.in('projet_code', codesProjetsPS);
  if (filters.projet_code) query = query.eq('projet_code', filters.projet_code);
  if (filters.pays_code) query = query.eq('pays_code', filters.pays_code);
  if (filters.type_structure_code)
    query = query.eq('type_structure_code', filters.type_structure_code);
  if (filters.secteur_activite_code)
    query = query.eq('secteur_activite_code', filters.secteur_activite_code);
  if (filters.nature_appui_code) query = query.eq('nature_appui_code', filters.nature_appui_code);
  if (filters.statut_creation)
    query = query.eq(
      'statut_creation',
      filters.statut_creation as 'creation' | 'renforcement' | 'relance',
    );
  if (filters.annee_appui) query = query.eq('annee_appui', filters.annee_appui);
  if (filters.mien) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) query = query.eq('created_by', auth.user.id);
  }

  if (!idsParPertinence) {
    query = query.order('updated_at', { ascending: false });
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`Impossible de charger la liste : ${error.message}`);
  }

  let rows = (data ?? []) as StructureListItem[];

  if (idsParPertinence) {
    const rank = new Map(idsParPertinence.map((id, i) => [id, i]));
    rows = [...rows].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  }

  const total = count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { rows, total, page, pageSize, totalPages };
}
