import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { getAdminScsAvecPermissions, MODULES_DELEGABLES } from '@/lib/super-admin/permissions';
import { PermissionsDeleguesClient } from './permissions-delegues-client';

export const metadata: Metadata = { title: 'Permissions déléguées — Super Admin' };
export const dynamic = 'force-dynamic';

export default async function PermissionsDeleguesPage() {
  const u = await requireUtilisateurValide();
  if (u.role !== 'super_admin') notFound();

  const admins = await getAdminScsAvecPermissions();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Permissions déléguées</h2>
        <p className="text-muted-foreground text-sm">
          Autorisez des administrateurs SCS à accéder à certains modules de super-administration.
          Les modules sensibles (utilisateurs, partenaires, maintenance) restent réservés au super_admin.
        </p>
      </div>
      <PermissionsDeleguesClient
        admins={admins}
        modules={MODULES_DELEGABLES}
      />
    </div>
  );
}
