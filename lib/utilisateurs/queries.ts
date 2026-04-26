import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Item de la liste utilisateurs (admin_scs uniquement).
 * On joint l'organisation pour afficher le libellé directement.
 */
export type UtilisateurListItem = {
  id: string;
  user_id: string;
  email: string | null;
  nom_complet: string;
  role: string;
  organisation_id: string | null;
  organisation_nom: string | null;
  projets_geres: string[];
  actif: boolean;
  statut_validation: 'en_attente' | 'valide' | 'rejete';
  created_at: string;
  derniere_connexion: string | null;
};

/**
 * Liste tous les utilisateurs (admin_scs only via RLS).
 * Limité à 200 lignes en V1 — pagination/filtres en V1.5 si volume.
 */
export async function listUtilisateurs(): Promise<UtilisateurListItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('utilisateurs')
    .select(
      `
      id, user_id, nom_complet, role, organisation_id,
      actif, statut_validation, created_at,
      organisation:organisations!organisation_id ( nom, projets_geres )
      `,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(`Impossible de charger les utilisateurs : ${error.message}`);

  type RawRow = {
    id: string;
    user_id: string;
    nom_complet: string;
    role: string;
    organisation_id: string | null;
    actif: boolean;
    statut_validation: 'en_attente' | 'valide' | 'rejete';
    created_at: string;
    organisation:
      | { nom: string; projets_geres: string[] | null }
      | { nom: string; projets_geres: string[] | null }[]
      | null;
  };

  return ((data ?? []) as RawRow[]).map((r) => {
    const orga = Array.isArray(r.organisation) ? r.organisation[0] : r.organisation;
    return {
      id: r.id,
      user_id: r.user_id,
      email: null, // L'email vit dans auth.users, accessible uniquement via service_role.
      nom_complet: r.nom_complet,
      role: r.role,
      organisation_id: r.organisation_id,
      organisation_nom: orga?.nom ?? null,
      projets_geres: orga?.projets_geres ?? [],
      actif: r.actif,
      statut_validation: r.statut_validation,
      created_at: r.created_at,
      derniere_connexion: null, // accessible via service_role auth.users — V1.5
    };
  });
}
