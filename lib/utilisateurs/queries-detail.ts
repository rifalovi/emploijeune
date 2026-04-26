import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type UtilisateurDetail = {
  id: string;
  user_id: string;
  email: string | null;
  nom_complet: string;
  role: string;
  organisation_id: string | null;
  organisation_nom: string | null;
  organisation_projets: string[];
  actif: boolean;
  statut_validation: 'en_attente' | 'valide' | 'rejete';
  created_at: string;
  updated_at: string;
};

export type LigneAudit = {
  id: number;
  action: string;
  diff: Record<string, unknown> | null;
  user_id: string | null;
  user_email: string | null;
  horodatage: string;
};

/**
 * Charge le détail complet d'un utilisateur (Étape 8 enrichie) :
 * profil + organisation rattachée + email auth.users + 5 dernières
 * lignes d'audit `journaux_audit`.
 */
export async function getUtilisateurDetail(
  utilisateurId: string,
): Promise<UtilisateurDetail | null> {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('utilisateurs')
    .select(
      `
      id, user_id, nom_complet, role, organisation_id,
      actif, statut_validation, created_at, updated_at,
      organisation:organisations!organisation_id ( nom, projets_geres )
      `,
    )
    .eq('id', utilisateurId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;

  const orga = Array.isArray(data.organisation) ? data.organisation[0] : data.organisation;

  // Email vit dans auth.users (admin_scs only)
  const { data: authUser } = await adminClient.auth.admin.getUserById(data.user_id);

  return {
    id: data.id,
    user_id: data.user_id,
    email: authUser?.user?.email ?? null,
    nom_complet: data.nom_complet,
    role: data.role,
    organisation_id: data.organisation_id,
    organisation_nom: orga?.nom ?? null,
    organisation_projets: orga?.projets_geres ?? [],
    actif: data.actif,
    statut_validation: data.statut_validation as 'en_attente' | 'valide' | 'rejete',
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Lit les 10 dernières lignes d'audit pour un utilisateur (Étape 8 enrichie).
 * Lecture admin (service_role) car journaux_audit n'a pas de RLS lisible.
 */
export async function getAuditUtilisateur(
  utilisateurId: string,
  limit = 10,
): Promise<LigneAudit[]> {
  const adminClient = createSupabaseAdminClient();
  const { data } = await adminClient
    .from('journaux_audit' as never)
    .select('id, action, diff, user_id, user_email, horodatage')
    .eq('table_affectee', 'utilisateurs')
    .eq('ligne_id', utilisateurId)
    .order('horodatage', { ascending: false })
    .limit(limit);

  return (
    (data ?? []) as Array<{
      id: number;
      action: string;
      diff: Record<string, unknown> | null;
      user_id: string | null;
      user_email: string | null;
      horodatage: string;
    }>
  ).map((r) => ({
    id: r.id,
    action: r.action,
    diff: r.diff,
    user_id: r.user_id,
    user_email: r.user_email,
    horodatage: r.horodatage,
  }));
}

/** Liste légère des organisations pour le Select (admin_scs only). */
export async function listOrganisationsLegeres(): Promise<
  Array<{ id: string; nom: string; projets_geres: string[] }>
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('organisations')
    .select('id, nom, projets_geres')
    .is('deleted_at', null)
    .order('nom', { ascending: true })
    .limit(500);
  return (data ?? []).map((o) => ({
    id: o.id,
    nom: o.nom,
    projets_geres: o.projets_geres ?? [],
  }));
}
