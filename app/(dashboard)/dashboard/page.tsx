import type { Metadata } from 'next';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUtilisateurEffectif } from '@/lib/auth/view-as';
import { DashboardAdminScs } from '@/components/dashboard/dashboard-admin-scs';
import { DashboardEditeurProjet } from '@/components/dashboard/dashboard-editeur-projet';
import { DashboardContributeur } from '@/components/dashboard/dashboard-contributeur';
import { DashboardLecteur } from '@/components/dashboard/dashboard-lecteur';
import { KpiGridOif } from '@/components/dashboard/kpi-grid-oif';
import { ChartProjetsBar } from '@/components/dashboard/chart-projets-bar';
import { ChartPaysBar } from '@/components/dashboard/chart-pays-bar';
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
  await requireUtilisateurValide();
  const supabase = await createSupabaseServerClient();

  const effectif = await getUtilisateurEffectif();
  if (!effectif) {
    // Garde-fou : requireUtilisateurValide a déjà redirigé sinon.
    return null;
  }
  const utilisateur = effectif.profil;

  const { periode: rawPeriode } = await searchParams;
  const periode: Periode =
    rawPeriode && (PERIODES as readonly string[]).includes(rawPeriode)
      ? (rawPeriode as Periode)
      : '30j';

  // En mode view-as, on appelle la RPC qui simule la vue cible. Sinon, RPC
  // standard pilotée par auth.uid().
  const oifPromise = effectif.isViewAs
    ? supabase.rpc('get_indicateurs_oif_v1_for_user', {
        p_target_user_id: effectif.profil.user_id,
        p_periode: periode,
      })
    : supabase.rpc('get_indicateurs_oif_v1', { p_periode: periode });

  const [{ data, error }, oifResp, activite] = await Promise.all([
    supabase.rpc('get_kpis_dashboard'),
    oifPromise,
    getActiviteRecente(periode),
  ]);

  // Diagnostic dev-only : si la fonction OIF n'est pas encore appliquée sur Supabase
  // ou si elle retourne une forme inattendue, on logge pour faciliter le debug.
  const oifParse = indicateursOifSchema.safeParse(oifResp.data);
  const oif = oifParse.success ? oifParse.data : null;
  const oifErreur: string | null = oifResp.error
    ? oifResp.error.message
    : !oifParse.success
      ? `Format inattendu du payload : ${oifParse.error.issues
          .slice(0, 2)
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .join(' · ')}`
      : null;

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
        {effectif.isViewAs ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="text-muted-foreground">
              Les indicateurs opérationnels (comptes à valider, alertes qualité, imports récents…)
              sont propres à l&apos;administrateur réel et restent{' '}
              <strong>masqués en mode visualisation</strong>. Cliquez sur « Revenir à mon admin »
              dans le bandeau pour les retrouver.
            </p>
          </div>
        ) : (
          renderDashboard(utilisateur.role, data)
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Indicateurs OIF stratégiques</h2>
          <div className="flex flex-wrap items-center gap-4">
            <SelecteurPeriode valeur={periode} />
            <ToggleDevise />
          </div>
        </div>

        {oif ? (
          <>
            <KpiGridOif data={oif} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartProjetsBar data={oif.bar_projets} />
              <ChartProgrammesPie data={oif.pie_programmes} />
            </div>
            <ChartPaysBar data={oif.bar_pays ?? []} />
            <ActiviteRecenteFeed evenements={activite} periodeLibelle={PERIODE_LIBELLES[periode]} />
          </>
        ) : (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Indicateurs OIF stratégiques non disponibles
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              La fonction <code className="font-mono">get_indicateurs_oif_v1</code> n&apos;a pas
              renvoyé de payload exploitable. Causes possibles :
            </p>
            <ul className="text-muted-foreground mt-1 list-disc pl-5 text-xs">
              <li>
                La migration{' '}
                <code className="font-mono">20260427000002_kpis_indicateurs_oif.sql</code>{' '}
                n&apos;est pas encore appliquée sur Supabase (lancer{' '}
                <code className="font-mono">supabase db push</code>).
              </li>
              <li>
                Votre profil utilisateur n&apos;est pas valide (vérifier{' '}
                <code className="font-mono">utilisateurs.actif = true</code>).
              </li>
            </ul>
            {oifErreur && process.env.NODE_ENV !== 'production' && (
              <p className="text-muted-foreground mt-3 text-xs">
                <span className="font-medium">Détail technique (dev) :</span>{' '}
                <code className="font-mono">{oifErreur}</code>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function renderDashboard(role: string, raw: unknown) {
  switch (role) {
    // super_admin hérite de la vue admin_scs (cohérence avec is_admin_scs RLS).
    case 'super_admin':
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
    case 'super_admin':
      return 'Vue super_admin : tous les indicateurs de la plateforme + actions sensibles.';
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
