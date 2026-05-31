import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MaintenanceClient } from './maintenance-client';

export const metadata: Metadata = {
  title: 'Maintenance — OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

export type EffectifsActuels = {
  beneficiaires: number;
  structures: number;
  indicateurs_saisis: number;
  alertes_qualite: number;
  import_sessions: number;
  reponses_enquetes: number;
};

async function getEffectifs(): Promise<EffectifsActuels> {
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- alertes_qualite pas encore dans les types générées
  const from = supabase.from.bind(supabase) as any;
  const [benef, struct, indic, alertes, imports, reponses] = await Promise.all([
    supabase.from('beneficiaires').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('structures').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('valeurs_indicateurs_saisies').select('id', { count: 'exact', head: true }),
    from('alertes_qualite').select('id', { count: 'exact', head: true }),
    supabase.from('import_sessions').select('id', { count: 'exact', head: true }),
    supabase.from('reponses_enquetes').select('id', { count: 'exact', head: true }),
  ]);

  return {
    beneficiaires: benef.count ?? 0,
    structures: struct.count ?? 0,
    indicateurs_saisis: indic.count ?? 0,
    alertes_qualite: alertes.count ?? 0,
    import_sessions: imports.count ?? 0,
    reponses_enquetes: reponses.count ?? 0,
  };
}

export default async function MaintenancePage() {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const effectifs = await getEffectifs();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
          <Wrench className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Maintenance de la plateforme
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Purge des données métier et recalcul des indicateurs.
            Réservé aux super-administrateurs.
          </p>
        </div>
      </div>

      <MaintenanceClient effectifs={effectifs} />
    </div>
  );
}
