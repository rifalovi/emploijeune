import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { listerAccesDataStudio } from '@/lib/super-admin/permissions';
import { DatastudioAccesClient } from './datastudio-acces-client';

export const metadata: Metadata = {
  title: 'Accès SCS DataStudio – Super Administration',
};

export const dynamic = 'force-dynamic';

export default async function DatastudioAccesPage() {
  const utilisateur = await requireUtilisateurValide();
  if (utilisateur.role !== 'super_admin') notFound();

  const utilisateurs = await listerAccesDataStudio();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Accès SCS DataStudio</h1>
        <p className="text-muted-foreground text-sm">
          Le module <strong>Atelier d’analyse (SCS DataStudio)</strong> est réservé au super
          administrateur. Activez-le ici, individuellement, pour un administrateur ou pour tout
          utilisateur. La délégation s’applique immédiatement à son menu et à ses accès.
        </p>
      </header>
      <DatastudioAccesClient utilisateurs={utilisateurs} />
    </div>
  );
}
