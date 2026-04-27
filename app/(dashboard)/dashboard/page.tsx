import type { Metadata } from 'next';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DashboardAdminScs } from '@/components/dashboard/dashboard-admin-scs';
import { DashboardEditeurProjet } from '@/components/dashboard/dashboard-editeur-projet';
import { DashboardContributeur } from '@/components/dashboard/dashboard-contributeur';
import { DashboardLecteur } from '@/components/dashboard/dashboard-lecteur';
import { KpiGridOif } from '@/components/dashboard/kpi-grid-oif';
import { ChartProjetsBar } from '@/components/dashboard/chart-projets-bar';
import { ChartProgrammesPie } from '@/components/dashboard/chart-programmes-pie';
import { ActiviteRecenteFeed } from '@/components/dashboard/activite-recente-feed';
import { SelecteurPeriode } from '@/components/dashboard/selecteur-periode';
import { ToggleDevise } from '@/components/dashboard/toggle-devise';
import {
  kpiAdminScsSchema,
  kpiContributeurSchema,
  kpiEditeurProjetSchema,
  kpiLecteurSchema,
} from '@/lib/kpis/types';
import {
  PERIODES,
  PERIODE_LIBELLES,
  indicateursOifSchema,
  type Periode,
} from '@/lib/kpis/indicateurs-oif';
import { getActiviteRecente } from '@/lib/dashboard/activite-recente';

export const metadata: Metadata = {
  title: 'Accueil — OIF Emploi Jeunes',
};

type SearchParams = Promise<{ periode?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const utilisateur = await requireUtilisateurValide();
  const supabase = await createSupabaseServerClient();

  const { periode: rawPeriode } = await searchParams;
  const periode: Periode =
    rawPeriode && (PERIODES as readonly string[]).includes(rawPeriode)
      ? (rawPeriode as Periode)
      : '30j';

  const [{ data, error }, { data: rawOif }, activite] = await Promise.all([
    supabase.rpc('get_kpis_dashboard'),
    supabase.rpc('get_indicateurs_oif_v1', { p_periode: periode }),
    getActiviteRecente(periode),
  ]);

  const oifParse = indicateursOifSchema.safeParse(rawOif);
  const oif = oifParse.success ? oifParse.data : null;

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour, {utilisateur.nom_complet}
        </h1>
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-4 text-sm">
          Impossible de charger les indicateurs du tableau de bord. Rechargez la page ou contactez
          le SCS.
          <br />
          <span className="text-muted-foreground text-xs">Détail technique : {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour, {utilisateur.nom_complet}
        </h1>
        <p className="text-muted-foreground text-sm">{salutationContextuelle(utilisateur.role)}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Indicateurs opérationnels</h2>
        {renderDashboard(utilisateur.role, data)}
      </section>

      {oif && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Indicateurs OIF stratégiques</h2>
            <div className="flex flex-wrap items-center gap-4">
              <SelecteurPeriode valeur={periode} />
              <ToggleDevise />
            </div>
          </div>
          <KpiGridOif data={oif} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartProjetsBar data={oif.bar_projets} />
            <ChartProgrammesPie data={oif.pie_programmes} />
          </div>
          <ActiviteRecenteFeed evenements={activite} periodeLibelle={PERIODE_LIBELLES[periode]} />
        </section>
      )}
    </div>
  );
}

function renderDashboard(role: string, raw: unknown) {
  switch (role) {
    case 'admin_scs': {
      const parsed = kpiAdminScsSchema.safeParse(raw);
      if (!parsed.success) return <KpiLoadError />;
      return <DashboardAdminScs data={parsed.data} />;
    }
    case 'editeur_projet': {
      const parsed = kpiEditeurProjetSchema.safeParse(raw);
      if (!parsed.success) return <KpiLoadError />;
      return <DashboardEditeurProjet data={parsed.data} />;
    }
    case 'contributeur_partenaire': {
      const parsed = kpiContributeurSchema.safeParse(raw);
      if (!parsed.success) return <KpiLoadError />;
      return <DashboardContributeur data={parsed.data} />;
    }
    case 'lecteur': {
      const parsed = kpiLecteurSchema.safeParse(raw);
      if (!parsed.success) return <KpiLoadError />;
      return <DashboardLecteur data={parsed.data} />;
    }
    default:
      return <KpiLoadError />;
  }
}

function KpiLoadError() {
  return (
    <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-4 text-sm">
      Le format des indicateurs renvoyé par le serveur est inattendu. Contactez le SCS.
    </div>
  );
}

function salutationContextuelle(role: string): string {
  switch (role) {
    case 'admin_scs':
      return 'Voici les indicateurs à surveiller sur la plateforme aujourd\u2019hui.';
    case 'editeur_projet':
      return 'Voici l\u2019état des projets que vous gérez.';
    case 'contributeur_partenaire':
      return 'Voici vos contributions récentes et ce qu\u2019il reste à faire.';
    case 'lecteur':
      return 'Vue d\u2019ensemble de votre périmètre.';
    default:
      return '';
  }
}
