import type { Metadata } from 'next';
import { listerSoumissionsCollectees } from '@/lib/collecte-analytique/actions';
import { DonneesCollecteClient } from './donnees-collecte-client';

export const metadata: Metadata = { title: 'Données collectées — Analytique' };
export const dynamic = 'force-dynamic';

export default async function DonneesCollectePage() {
  const result = await listerSoumissionsCollectees({ statut: 'tous', page: 1, pageSize: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Données collectées</h2>
        <p className="text-muted-foreground text-sm">
          Toutes les soumissions reçues via les formulaires publics, tous types confondus.
        </p>
      </div>
      <DonneesCollecteClient initialData={result} />
    </div>
  );
}
