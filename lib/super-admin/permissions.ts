import 'server-only';
import { notFound } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// ── Catalogue des modules délégables ─────────────────────────────────────────

export const MODULES_DELEGABLES = {
  contenu_pages:        { label: 'Contenu pages',       href: '/super-admin/contenu-pages' },
  affichage_public:     { label: 'Affichage public',    href: '/super-admin/affichage-public' },
  analyses_indicateurs: { label: 'Analyses IA',         href: '/super-admin/analyses-indicateurs' },
  base_connaissance:    { label: 'Base de connaissance',href: '/super-admin/base-connaissance' },
  tracking:             { label: 'Tracking & Logs',     href: '/super-admin/tracking' },
  import_sessions:      { label: "Sessions d'import",  href: '/super-admin/import-sessions' },
  doublons:             { label: 'Doublons',            href: '/super-admin/doublons' },
  nettoyage_donnees:    { label: 'Pays inconnus',       href: '/super-admin/nettoyage-donnees/pays-inconnus' },
  referentiels:         { label: "Tranches d'âge",      href: '/super-admin/referentiels/tranches-age' },
} as const;

export type ModuleKey = keyof typeof MODULES_DELEGABLES;

// ── Vérifier qu'un utilisateur a accès à un module ───────────────────────────

export async function hasPermission(userId: string, module: ModuleKey): Promise<boolean> {
  const db = createSupabaseAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from('permissions_delegues')
    .select('actif')
    .eq('utilisateur_id', userId)
    .eq('module_key', module)
    .single();
  return (data as { actif: boolean } | null)?.actif === true;
}

// ── Guard de page : super_admin OU admin_scs avec permission ─────────────────

export async function exigerAccesModule(module: ModuleKey): Promise<void> {
  const u = await requireUtilisateurValide();
  if (u.role === 'super_admin') return;
  if (u.role === 'admin_scs') {
    const ok = await hasPermission(u.id, module);
    if (ok) return;
  }
  notFound();
}

// ── Lire toutes les permissions pour un utilisateur ──────────────────────────

export async function getPermissionsUtilisateur(userId: string): Promise<Set<ModuleKey>> {
  const db = createSupabaseAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from('permissions_delegues')
    .select('module_key, actif')
    .eq('utilisateur_id', userId)
    .eq('actif', true);
  const set = new Set<ModuleKey>();
  for (const row of (data ?? []) as { module_key: string }[]) {
    if (row.module_key in MODULES_DELEGABLES) {
      set.add(row.module_key as ModuleKey);
    }
  }
  return set;
}

// ── Lire toutes les permissions (pour l'UI super-admin) ──────────────────────

export type AdminScsAvecPermissions = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  organisation: string | null;
  permissions: Record<ModuleKey, boolean>;
};

export async function getAdminScsAvecPermissions(): Promise<AdminScsAvecPermissions[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createSupabaseAdminClient() as any;

  const { data: utilisateurs } = await db
    .from('utilisateurs')
    .select('id, nom, prenom, email, organisation')
    .eq('role', 'admin_scs')
    .is('deleted_at', null)
    .order('nom');

  if (!utilisateurs?.length) return [];

  const userIds = (utilisateurs as { id: string }[]).map((u) => u.id);

  const adminDb = createSupabaseAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perms } = await (adminDb as any)
    .from('permissions_delegues')
    .select('utilisateur_id, module_key, actif')
    .in('utilisateur_id', userIds);

  const permMap = new Map<string, Record<string, boolean>>();
  for (const p of (perms ?? []) as { utilisateur_id: string; module_key: string; actif: boolean }[]) {
    if (!permMap.has(p.utilisateur_id)) permMap.set(p.utilisateur_id, {});
    permMap.get(p.utilisateur_id)![p.module_key] = p.actif;
  }

  const moduleKeys = Object.keys(MODULES_DELEGABLES) as ModuleKey[];

  return (utilisateurs as { id: string; nom: string; prenom: string; email: string; organisation: string | null }[]).map((u) => ({
    ...u,
    permissions: Object.fromEntries(
      moduleKeys.map((k) => [k, permMap.get(u.id)?.[k] === true])
    ) as Record<ModuleKey, boolean>,
  }));
}
