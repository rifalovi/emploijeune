import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { StructureFilters } from '@/lib/schemas/structure';

/**
 * Détail complet d'une structure pour l'affichage fiche et l'édition.
 * Inclut toutes les colonnes métier + métadonnées techniques + libellés
 * résolus via JOIN pour projet (libellé + programme stratégique) et
 * organisation (nom). Cohérent avec `BeneficiaireDetail`.
 */
export type StructureDetail = {
  id: string;

  // Identité
  nom_structure: string;
  type_structure_code: string;
  secteur_activite_code: string;
  secteur_precis: string | null;
  intitule_initiative: string | null;
  date_creation: string | null;
  statut_creation: 'creation' | 'renforcement' | 'relance';

  // Rattachement
  projet_code: string;
  projet_libelle: string | null;
  programme_strategique: string | null;
  pays_code: string;
  organisation_id: string | null;
  organisation_nom: string | null;

  // Porteur
  porteur_prenom: string | null;
  porteur_nom: string;
  porteur_sexe: 'F' | 'M' | 'Autre';
  porteur_date_naissance: string | null;
  fonction_porteur: string | null;

  // Appui
  annee_appui: number;
  nature_appui_code: string;
  montant_appui: number | null;
  devise_code: string | null;

  // RGPD & contacts
  consentement_recueilli: boolean;
  consentement_date: string | null;
  telephone_porteur: string | null;
  courriel_porteur: string | null;
  adresse: string | null;
  ville: string | null;
  localite: string | null;
  latitude: number | null;
  longitude: number | null;

  // Indicateurs B
  chiffre_affaires: number | null;
  employes_permanents: number | null;
  employes_temporaires: number | null;
  emplois_crees: number | null;

  commentaire: string | null;

  // Traçabilité technique
  source_import: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
};

/**
 * Récupère une fiche structure par son ID. Retourne `null` si introuvable
 * (inexistante, hors périmètre RLS, ou soft-deleted). Pas de distinction
 * 404/403 — on ne veut pas fuiter l'existence de fiches hors périmètre.
 *
 * Note : contrairement à `listStructures`, on N'EXCLUT PAS les fiches
 * `deleted_at IS NOT NULL` au niveau de la query — la page détail filtre
 * elle-même (pour pouvoir afficher un bandeau « supprimée » à un admin
 * qui aurait l'URL en historique navigateur). Côté liste, le filtre
 * deleted reste actif.
 */
export async function getStructureById(id: string): Promise<StructureDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('structures')
    .select(
      `
      id,
      nom_structure, type_structure_code, secteur_activite_code, secteur_precis,
      intitule_initiative, date_creation, statut_creation,
      projet_code, pays_code, organisation_id,
      porteur_prenom, porteur_nom, porteur_sexe, porteur_date_naissance, fonction_porteur,
      annee_appui, nature_appui_code, montant_appui, devise_code,
      consentement_recueilli, consentement_date,
      telephone_porteur, courriel_porteur,
      adresse, ville, localite, latitude, longitude,
      chiffre_affaires, employes_permanents, employes_temporaires, emplois_crees,
      commentaire,
      source_import, created_at, created_by, updated_at,
      deleted_at, deleted_by, deleted_reason,
      projet:projets!projet_code ( libelle, programme_strategique ),
      organisation:organisations!organisation_id ( nom )
      `,
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const projet = Array.isArray(data.projet) ? data.projet[0] : data.projet;
  const organisation = Array.isArray(data.organisation) ? data.organisation[0] : data.organisation;

  return {
    id: data.id,
    nom_structure: data.nom_structure,
    type_structure_code: data.type_structure_code,
    secteur_activite_code: data.secteur_activite_code,
    secteur_precis: data.secteur_precis,
    intitule_initiative: data.intitule_initiative,
    date_creation: data.date_creation,
    statut_creation: data.statut_creation as 'creation' | 'renforcement' | 'relance',

    projet_code: data.projet_code,
    projet_libelle: projet?.libelle ?? null,
    programme_strategique: projet?.programme_strategique ?? null,
    pays_code: data.pays_code,
    organisation_id: data.organisation_id,
    organisation_nom: organisation?.nom ?? null,

    porteur_prenom: data.porteur_prenom,
    porteur_nom: data.porteur_nom,
    porteur_sexe: data.porteur_sexe as 'F' | 'M' | 'Autre',
    porteur_date_naissance: data.porteur_date_naissance,
    fonction_porteur: data.fonction_porteur,

    annee_appui: data.annee_appui,
    nature_appui_code: data.nature_appui_code,
    montant_appui: data.montant_appui,
    devise_code: data.devise_code,

    consentement_recueilli: data.consentement_recueilli,
    consentement_date: data.consentement_date,
    telephone_porteur: data.telephone_porteur,
    courriel_porteur: data.courriel_porteur,
    adresse: data.adresse,
    ville: data.ville,
    localite: data.localite,
    latitude: data.latitude,
    longitude: data.longitude,

    chiffre_affaires: data.chiffre_affaires,
    employes_permanents: data.employes_permanents,
    employes_temporaires: data.employes_temporaires,
    emplois_crees: data.emplois_crees,

    commentaire: data.commentaire,

    source_import: data.source_import,
    created_at: data.created_at,
    created_by: data.created_by,
    updated_at: data.updated_at,
    deleted_at: data.deleted_at,
    deleted_by: data.deleted_by,
    deleted_reason: data.deleted_reason,
  };
}

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
