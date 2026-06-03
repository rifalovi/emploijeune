import type { Metadata } from 'next';
import { Layers } from 'lucide-react';
import { listerTranchesAge } from '@/lib/super-admin/tranches-age-actions';
import { TranchesAgeClient } from './tranches-age-client';
import { exigerAccesModule } from '@/lib/super-admin/permissions';

export const metadata: Metadata = {
  title: 'Tranches d\'age — OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

export default async function TranchesAgePage() {
  await exigerAccesModule('referentiels');

  const tranches = await listerTranchesAge();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
          <Layers className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Tranches d&apos;age precises
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Referentiel configurable. Chaque tranche est rattachee a une categorie OIF
            (Jeune ou Adulte) et apparait dans les formulaires de collecte publique.
          </p>
        </div>
      </div>

      <TranchesAgeClient tranches={tranches} />
    </div>
  );
}
