'use server';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ModuleKey } from './permissions';

type Ok = { ok: true };
type Err = { ok: false; message: string };

async function exigerSuperAdmin() {
  const u = await requireUtilisateurValide();
  if (u.role !== 'super_admin') throw new Error('Accès réservé au super administrateur.');
  return u;
}

function err(e: unknown): Err {
  return { ok: false, message: e instanceof Error ? e.message : 'Erreur inconnue' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseAdminClient() as any; }

// ── Activer ou désactiver une permission ──────────────────────────────────────

export async function togglePermission(
  utilisateur_id: string,
  module_key: ModuleKey,
  actif: boolean
): Promise<Ok | Err> {
  try {
    const granted_by = (await exigerSuperAdmin()).id;
    const { error } = await db()
      .from('permissions_delegues')
      .upsert(
        { utilisateur_id, module_key, actif, granted_by },
        { onConflict: 'utilisateur_id,module_key' }
      );
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ── Définir toutes les permissions d'un utilisateur en une fois ───────────────

export async function setPermissions(
  utilisateur_id: string,
  modules: Partial<Record<ModuleKey, boolean>>
): Promise<Ok | Err> {
  try {
    const granted_by = (await exigerSuperAdmin()).id;
    const rows = Object.entries(modules).map(([module_key, actif]) => ({
      utilisateur_id,
      module_key,
      actif: actif ?? false,
      granted_by,
    }));
    if (!rows.length) return { ok: true };
    const { error } = await db()
      .from('permissions_delegues')
      .upsert(rows, { onConflict: 'utilisateur_id,module_key' });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}
