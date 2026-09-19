import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import {
  getAdminScsAvecPermissions,
  listerAccesDataStudio,
  MODULES_DELEGABLES,
} from '@/lib/super-admin/permissions';
import { getCmsPagesSections } from '@/lib/contenu-pages/queries';
import { PermissionsDeleguesClient } from './permissions-delegues-client';
import { DatastudioAccesClient } from '../datastudio-acces/datastudio-acces-client';

export const metadata: Metadata = { title: 'Permissions déléguées — Super Admin' };
export const dynamic = 'force-dynamic';

export default async function PermissionsDeleguesPage() {
  const u = await requireUtilisateurValide();
  if (u.role !== 'super_admin') notFound();

  const [admins, cmsPagesSections, accesDataStudio] = await Promise.all([
    getAdminScsAvecPermissions(),
    getCmsPagesSections(),
    listerAccesDataStudio(),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Permissions déléguées</h2>
          <p className="text-muted-foreground text-sm">
            Autorisez des administrateurs SCS à accéder à certains modules de super-administration.
            Les modules sensibles (utilisateurs, partenaires, maintenance) restent réservés au
            super_admin.
          </p>
        </div>
        <PermissionsDeleguesClient
          admins={admins}
          modules={MODULES_DELEGABLES}
          cmsPagesSections={cmsPagesSections}
        />
      </div>

      {/* Module SCS DataStudio : réservé au super_admin par défaut, délégable à
          TOUT utilisateur (pas seulement les administrateurs SCS). */}
      <div className="space-y-4 border-t pt-6">
        <div>
          <h2 className="text-lg font-semibold">SCS DataStudio (Atelier d’analyse)</h2>
          <p className="text-muted-foreground text-sm">
            L’accès au module SCS DataStudio est <strong>réservé au super administrateur</strong>{' '}
            par défaut. Activez-le ci-dessous pour un administrateur{' '}
            <em>ou n’importe quel utilisateur</em> : l’onglet « Atelier d’analyse » n’apparaît et
            n’est accessible que pour les personnes autorisées.
          </p>
        </div>
        <DatastudioAccesClient utilisateurs={accesDataStudio} />
      </div>
    </div>
  );
}
