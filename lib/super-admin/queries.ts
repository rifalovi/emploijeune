import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { RoleUtilisateur } from '@/lib/supabase/auth';

/**
 * Helpers de lecture pour les pages /super-admin/*. Toutes les requêtes
 * passent par le client server-side (RLS appliquée) sauf cas explicite où
 * l'on a besoin de l'admin client (lecture transversale auth.users notamment).
 */

export type ActivationModuleRow = {
  module: string;
  role_cible: RoleUtilisateur;
  active: boolean;
  activated_at: string | null;
  updated_at: string | null;
  activated_by: string | null;
};

export async function listerActivationsIa(): Promise<ActivationModuleRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('activation_modules')
    .select('module, role_cible, active, activated_at, updated_at, activated_by')
    .eq('module', 'assistant_ia');

  if (error) return [];
  return (data ?? []) as ActivationModuleRow[];
}

export type StatGlobales = {
  utilisateurs_total: number;
  utilisateurs_actifs: number;
  beneficiaires_total: number;
  structures_total: number;
  organisations_total: number;
  organisations_archivees: number;
  suspensions_actives: number;
  modules_actifs: number;
};

export async function getStatsGlobales(): Promise<StatGlobales> {
  const supabase = await createSupabaseServerClient();

  // Lecture en parallèle. Tout ceci passe par RLS — super_admin via
  // is_admin_scs() voit tout, en cohérence avec l'inheritance défini
  // dans la migration 20260428000003.
  const [
    utilisateursRes,
    beneficiairesRes,
    structuresRes,
    organisationsRes,
    archivesActivesRes,
    suspensionsActivesRes,
    modulesActifsRes,
  ] = await Promise.all([
    supabase.from('utilisateurs').select('id, actif', { count: 'exact', head: false }),
    supabase
      .from('beneficiaires')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase.from('structures').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('organisations').select('id', { count: 'exact', head: true }),
    supabase
      .from('archives_partenaires')
      .select('id', { count: 'exact', head: true })
      .is('desarchive_at', null),
    supabase
      .from('suspensions_utilisateurs')
      .select('id', { count: 'exact', head: true })
      .is('leve_at', null),
    supabase
      .from('activation_modules')
      .select('id', { count: 'exact', head: true })
      .eq('active', true),
  ]);

  const utilisateursTotal = utilisateursRes.count ?? 0;
  const utilisateursActifs = utilisateursRes.data?.filter((u) => u.actif).length ?? 0;

  return {
    utilisateurs_total: utilisateursTotal,
    utilisateurs_actifs: utilisateursActifs,
    beneficiaires_total: beneficiairesRes.count ?? 0,
    structures_total: structuresRes.count ?? 0,
    organisations_total: organisationsRes.count ?? 0,
    organisations_archivees: archivesActivesRes.count ?? 0,
    suspensions_actives: suspensionsActivesRes.count ?? 0,
    modules_actifs: modulesActifsRes.count ?? 0,
  };
}

export type EvenementAudit = {
  id: number;
  user_id: string | null;
  user_email: string | null;
  acteur_nom: string | null;
  action: string;
  table_affectee: string;
  ligne_id: string | null;
  diff: unknown;
  horodatage: string;
};

/**
 * Lecture des derniers évènements du journal d'audit avec jointure sur le
 * nom de l'acteur. Réservé à super_admin (via is_admin_scs RLS).
 *
 * Colonnes journaux_audit (cf. schema initial) : id (BIGINT), action (ENUM),
 * table_affectee, ligne_id, diff (JSONB), horodatage, user_id, user_email.
 */
export async function listerEvenementsAudit(limit = 100): Promise<EvenementAudit[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('journaux_audit')
    .select('id, user_id, user_email, action, table_affectee, ligne_id, diff, horodatage')
    .order('horodatage', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const userIds = Array.from(new Set(data.map((e) => e.user_id).filter(Boolean))) as string[];
  let map = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('utilisateurs')
      .select('user_id, nom_complet')
      .in('user_id', userIds);
    map = new Map((users ?? []).map((u) => [u.user_id, u.nom_complet]));
  }

  return data.map((e) => ({
    id: e.id,
    user_id: e.user_id,
    user_email: e.user_email,
    acteur_nom: e.user_id ? (map.get(e.user_id) ?? null) : null,
    action: e.action,
    table_affectee: e.table_affectee,
    ligne_id: e.ligne_id,
    diff: e.diff,
    horodatage: e.horodatage,
  }));
}

export type UtilisateurAvecSuspension = {
  id: string;
  user_id: string;
  nom_complet: string;
  role: RoleUtilisateur;
  actif: boolean;
  organisation_id: string | null;
  organisation_nom: string | null;
  created_at: string;
  derniere_connexion: string | null;
  suspendu: boolean;
  suspension_motif: string | null;
  suspension_date_fin: string | null;
};

export async function listerUtilisateursAvecSuspension(): Promise<UtilisateurAvecSuspension[]> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Liste utilisateurs avec organisation
  const { data: utilisateurs } = await supabase
    .from('utilisateurs')
    .select('id, user_id, nom_complet, role, actif, organisation_id, created_at')
    .is('deleted_at', null)
    .order('nom_complet', { ascending: true });

  if (!utilisateurs) return [];

  // Suspensions actives
  const { data: suspensions } = await supabase
    .from('suspensions_utilisateurs')
    .select('user_id, motif, date_fin')
    .is('leve_at', null);

  const suspensionMap = new Map(
    (suspensions ?? []).map((s) => [s.user_id, { motif: s.motif, date_fin: s.date_fin }]),
  );

  // Organisations
  const orgIds = Array.from(
    new Set(utilisateurs.map((u) => u.organisation_id).filter(Boolean)),
  ) as string[];
  const orgMap = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase.from('organisations').select('id, nom').in('id', orgIds);
    (orgs ?? []).forEach((o) => orgMap.set(o.id, o.nom));
  }

  // Dernière connexion via auth.users (admin client requis)
  const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const lastSignInMap = new Map<string, string | null>(
    (authUsers?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
  );

  return utilisateurs.map((u) => {
    const susp = suspensionMap.get(u.user_id);
    return {
      id: u.id,
      user_id: u.user_id,
      nom_complet: u.nom_complet,
      role: u.role,
      actif: u.actif,
      organisation_id: u.organisation_id,
      organisation_nom: u.organisation_id ? (orgMap.get(u.organisation_id) ?? null) : null,
      created_at: u.created_at,
      derniere_connexion: lastSignInMap.get(u.user_id) ?? null,
      suspendu: Boolean(susp),
      suspension_motif: susp?.motif ?? null,
      suspension_date_fin: susp?.date_fin ?? null,
    };
  });
}

export type PartenaireAvecArchive = {
  organisation_id: string;
  nom: string;
  type_organisation: string | null;
  pays_code: string | null;
  archive: boolean;
  archive_at: string | null;
  archive_motif: string | null;
  utilisateurs_count: number;
};

export async function listerPartenairesAvecArchive(): Promise<PartenaireAvecArchive[]> {
  const supabase = await createSupabaseServerClient();
  const { data: orgs } = await supabase
    .from('organisations')
    .select('id, nom, type, pays_code')
    .is('deleted_at', null)
    .order('nom', { ascending: true });

  if (!orgs) return [];

  const { data: archives } = await supabase
    .from('archives_partenaires')
    .select('organisation_id, archive_at, motif')
    .is('desarchive_at', null);

  const archiveMap = new Map(
    (archives ?? []).map((a) => [a.organisation_id, { archive_at: a.archive_at, motif: a.motif }]),
  );

  // Compte utilisateurs par organisation
  const { data: users } = await supabase
    .from('utilisateurs')
    .select('organisation_id')
    .is('deleted_at', null);
  const userCount = new Map<string, number>();
  (users ?? []).forEach((u) => {
    if (!u.organisation_id) return;
    userCount.set(u.organisation_id, (userCount.get(u.organisation_id) ?? 0) + 1);
  });

  return orgs.map((o) => {
    const arch = archiveMap.get(o.id);
    return {
      organisation_id: o.id,
      nom: o.nom,
      type_organisation: o.type ?? null,
      pays_code: o.pays_code ?? null,
      archive: Boolean(arch),
      archive_at: arch?.archive_at ?? null,
      archive_motif: arch?.motif ?? null,
      utilisateurs_count: userCount.get(o.id) ?? 0,
    };
  });
}
