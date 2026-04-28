import { requireUtilisateurValide, getNotificationsAdminCount } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUtilisateurEffectif } from '@/lib/auth/view-as';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/mobile-header';
import { BandeauViewAs } from '@/components/admin/bandeau-view-as';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUtilisateurValide();

  const effectif = await getUtilisateurEffectif();
  if (!effectif) return null;
  const utilisateur = effectif.profil;

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

  // Notifications : on les masque en mode view-as (notifications de l'admin
  // réel, pas pertinent pour la cible visualisée).
  const notificationsCount =
    (utilisateur.role === 'admin_scs' || utilisateur.role === 'super_admin') && !effectif.isViewAs
      ? await getNotificationsAdminCount()
      : 0;

  // Module IA actif pour le rôle de l'utilisateur courant (V2.0.0).
  // Lecture défensive : en cas d'erreur (table pas encore migrée en local),
  // on retourne FALSE et le module reste invisible.
  let moduleIaActif = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: rpcData } = await supabase.rpc('module_ia_actif_pour_courant');
    moduleIaActif = rpcData === true;
  } catch {
    moduleIaActif = false;
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {effectif.isViewAs && effectif.viewAsContext && (
        <BandeauViewAs
          cibleNomComplet={effectif.profil.nom_complet}
          cibleRole={effectif.profil.role}
          expiresAt={effectif.viewAsContext.expiresAt}
        />
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar
          utilisateur={utilisateur}
          organisationLibelle={organisationLibelle}
          notificationsCount={notificationsCount}
          moduleIaActif={moduleIaActif}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader
            utilisateur={utilisateur}
            notificationsCount={notificationsCount}
            moduleIaActif={moduleIaActif}
          />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
