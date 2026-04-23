import { requireUtilisateurValide, getNotificationsAdminCount } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/mobile-header';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const utilisateur = await requireUtilisateurValide();

  // Libellé de l'organisation pour l'afficher dans la sidebar (pas critique si échec)
  let organisationLibelle: string | null = null;
  if (utilisateur.organisation_id) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from('organisations')
      .select('nom')
      .eq('id', utilisateur.organisation_id)
      .maybeSingle();
    organisationLibelle = data?.nom ?? null;
  }

  const notificationsCount =
    utilisateur.role === 'admin_scs' ? await getNotificationsAdminCount() : 0;

  return (
    <div className="bg-background flex min-h-screen">
      <Sidebar
        utilisateur={utilisateur}
        organisationLibelle={organisationLibelle}
        notificationsCount={notificationsCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader utilisateur={utilisateur} notificationsCount={notificationsCount} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
