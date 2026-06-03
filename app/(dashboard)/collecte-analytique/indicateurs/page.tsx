import type { Metadata } from 'next';
import { lireIndicateursLive } from '@/lib/collecte-analytique/actions';
import { INDICATEURS } from '@/lib/referentiels/indicateurs';
import { IndicateursClient } from './indicateurs-client';

export const metadata: Metadata = { title: 'Indicateurs vivants — Analytique' };
export const dynamic = 'force-dynamic';

export default async function IndicateursPage() {
  const { calculees, publiees } = await lireIndicateursLive();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Indicateurs vivants</h2>
        <p className="text-muted-foreground text-sm">
          Valeurs calculées en temps réel depuis la base de données. Publiez pour les rendre
          visibles sur le frontend public.
        </p>
      </div>
      <IndicateursClient
        indicateurs={INDICATEURS}
        calculees={calculees}
        publiees={publiees}
      />
    </div>
  );
}
