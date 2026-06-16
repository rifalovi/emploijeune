import 'server-only';
import { notFound } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// -- Catalogue des modules delegables -----------------------------------------

export const MODULES_DELEGABLES = {
  contenu_pages: { label: 'Contenu pages', href: '/super-admin/contenu-pages' },
  affichage_public: { label: 'Affichage public', href: '/super-admin/affichage-public' },
  analyses_indicateurs: { label: 'Analyses IA', href: '/super-admin/analyses-indicateurs' },
  base_connaissance: { label: 'Base de connaissance', href: '/super-admin/base-connaissance' },
  tracking: { label: 'Tracking & Logs', href: '/super-admin/tracking' },
  import_sessions: { label: "Sessions d\'import", href: '/super-admin/import-sessions' },
  doublons: { label: 'Doublons', href: '/super-admin/doublons' },
  nettoyage_donnees: {
    label: 'Pays inconnus',
    href: '/super-admin/nettoyage-donnees/pays-inconnus',
  },
  referentiels: { label: "Tranches d\'\u00e2ge", href: '/super-admin/referentiels/tranches-age' },
  // Modules \u00ab grand public admin \u00bb : accessibles par d\u00e9faut \u00e0 un admin_scs ;
  // la permission sert \u00e0 RETIRER l'acc\u00e8s (opt-out), pas \u00e0 l'ouvrir.
  analyses_tcd: { label: 'Analyses crois\u00e9es (TCD)', href: '/analyses/tcd' },
  realisations: { label: 'Indicateurs / R\u00e9alisations', href: '/indicateurs' },
} as const;

export type ModuleKey = keyof typeof MODULES_DELEGABLES;

/**
 * Modules dont l'acc\u00e8s est ACTIV\u00c9 par d\u00e9faut pour un admin_scs (opt-out) : il y
 * a acc\u00e8s tant qu'aucune permission explicite ne le retire (`actif = false`).
 * Les autres modules sont opt-in (pas d'acc\u00e8s tant que non coch\u00e9).
 */
export const MODULES_DEFAUT_ACTIF: ReadonlySet<ModuleKey> = new Set<ModuleKey>([
  'analyses_tcd',
  'realisations',
]);

// -- Verifier qu'un utilisateur a acces a un module ---------------------------

export async function hasPermission(userId: string, module: ModuleKey): Promise<boolean> {
  const db = createSupabaseAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from('permissions_delegues')
    .select('actif')
    .eq('utilisateur_id', userId)
    .eq('module_key', module)
    .maybeSingle();
  const row = data as { actif: boolean } | null;
  // Aucune permission explicite → défaut du module (opt-out = true, opt-in = false).
  if (row === null || row === undefined) return MODULES_DEFAUT_ACTIF.has(module);
  return row.actif === true;
}

// -- Guard de page : super_admin OU admin_scs avec permission -----------------

export async function exigerAccesModule(module: ModuleKey): Promise<void> {
  const u = await requireUtilisateurValide();
  if (u.role === 'super_admin') return;
  if (u.role === 'admin_scs') {
    const ok = await hasPermission(u.id, module);
    if (ok) return;
  }
  notFound();
}

// -- Guard server action (throw Error au lieu de notFound) --------------------

export async function exigerAccesModuleAction(module: ModuleKey): Promise<void> {
  const u = await requireUtilisateurValide();
  if (u.role === 'super_admin') return;
  if (u.role === 'admin_scs') {
    const ok = await hasPermission(u.id, module);
    if (ok) return;
  }
  throw new Error('Acces non autorise.');
}

// -- Lire toutes les permissions pour un utilisateur --------------------------

export async function getPermissionsUtilisateur(userId: string): Promise<Set<ModuleKey>> {
  const db = createSupabaseAdminClient();
  // On lit TOUTES les lignes (pas seulement actif=true) pour distinguer
  // « pas de ligne » (→ défaut du module) de « ligne actif=false » (→ retiré).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from('permissions_delegues')
    .select('module_key, actif')
    .eq('utilisateur_id', userId);
  const explicites = new Map<string, boolean>();
  for (const row of (data ?? []) as { module_key: string; actif: boolean }[]) {
    explicites.set(row.module_key, row.actif);
  }
  const set = new Set<ModuleKey>();
  for (const cle of Object.keys(MODULES_DELEGABLES) as ModuleKey[]) {
    const explicite = explicites.get(cle);
    const accessible = explicite === undefined ? MODULES_DEFAUT_ACTIF.has(cle) : explicite === true;
    if (accessible) set.add(cle);
  }
  return set;
}

// -- Permissions granulaires contenu_pages (par page/section) -----------------

export type ContenuSectionPerm = { page_key: string; section_key: string };

/**
 * null = accès complet (aucune restriction définie)
 * Record = whitelist : page_key → null (toutes sections) | string[] (sections spécifiques)
 */
export type ContenuAcces = null | Record<string, string[] | null>;

export async function getPermissionsContenuSections(userId: string): Promise<ContenuSectionPerm[]> {
  const db = createSupabaseAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await db
    .from('permissions_contenu_sections')
    .select('page_key, section_key')
    .eq('utilisateur_id', userId)
    .eq('actif', true);
  return (data ?? []) as ContenuSectionPerm[];
}

export async function getContenuAcces(userId: string): Promise<ContenuAcces> {
  const perms = await getPermissionsContenuSections(userId);
  if (perms.length === 0) return null;
  const map: Record<string, string[] | null> = {};
  for (const p of perms) {
    if (p.section_key === '') {
      map[p.page_key] = null;
    } else if (!(p.page_key in map)) {
      map[p.page_key] = [p.section_key];
    } else if (map[p.page_key] !== null) {
      map[p.page_key]!.push(p.section_key);
    }
  }
  return map;
}

export async function canAccessContenuSection(
  userId: string,
  page_key: string,
  section_key: string,
): Promise<boolean> {
  const acces = await getContenuAcces(userId);
  if (acces === null) return true;
  const pageAcces = acces[page_key];
  if (pageAcces === undefined) return false;
  if (pageAcces === null) return true;
  return pageAcces.includes(section_key);
}

// -- Lire toutes les permissions (pour l'UI super-admin) ----------------------

export type AdminScsAvecPermissions = {
  id: string;
  nom_complet: string;
  email: string;
  permissions: Record<ModuleKey, boolean>;
  contenu_sections: ContenuSectionPerm[];
};

export async function getAdminScsAvecPermissions(): Promise<AdminScsAvecPermissions[]> {
  const admin = createSupabaseAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: utilisateurs } = await db
    .from('utilisateurs')
    .select('id, nom_complet, user_id')
    .eq('role', 'admin_scs')
    .is('deleted_at', null)
    .order('nom_complet');

  if (!utilisateurs?.length) return [];

  // Recupere les emails depuis auth.users via l'API admin
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map<string, string>(
    (authData?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? '']),
  );

  const userIds = (utilisateurs as { id: string }[]).map((u) => u.id);

  const { data: perms } = await db
    .from('permissions_delegues')
    .select('utilisateur_id, module_key, actif')
    .in('utilisateur_id', userIds);

  const permMap = new Map<string, Record<string, boolean>>();
  for (const p of (perms ?? []) as {
    utilisateur_id: string;
    module_key: string;
    actif: boolean;
  }[]) {
    if (!permMap.has(p.utilisateur_id)) permMap.set(p.utilisateur_id, {});
    permMap.get(p.utilisateur_id)![p.module_key] = p.actif;
  }

  const { data: sectionPerms } = await db
    .from('permissions_contenu_sections')
    .select('utilisateur_id, page_key, section_key')
    .in('utilisateur_id', userIds)
    .eq('actif', true);

  const sectionPermMap = new Map<string, ContenuSectionPerm[]>();
  for (const p of (sectionPerms ?? []) as {
    utilisateur_id: string;
    page_key: string;
    section_key: string;
  }[]) {
    if (!sectionPermMap.has(p.utilisateur_id)) sectionPermMap.set(p.utilisateur_id, []);
    sectionPermMap
      .get(p.utilisateur_id)!
      .push({ page_key: p.page_key, section_key: p.section_key });
  }

  const moduleKeys = Object.keys(MODULES_DELEGABLES) as ModuleKey[];

  return (utilisateurs as { id: string; nom_complet: string; user_id: string }[]).map((u) => ({
    id: u.id,
    nom_complet: u.nom_complet,
    email: emailMap.get(u.user_id) ?? '',
    permissions: Object.fromEntries(
      moduleKeys.map((k) => {
        const stored = permMap.get(u.id)?.[k];
        // Pas de ligne explicite → défaut du module (opt-out = activé).
        const actif = stored === undefined ? MODULES_DEFAUT_ACTIF.has(k) : stored === true;
        return [k, actif];
      }),
    ) as Record<ModuleKey, boolean>,
    contenu_sections: sectionPermMap.get(u.id) ?? [],
  }));
}
