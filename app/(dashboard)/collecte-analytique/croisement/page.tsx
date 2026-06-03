import type { Metadata } from 'next';
import { croisementBeneficiaires } from '@/lib/collecte-analytique/actions';
import { CroisementClient } from './croisement-client';

export const metadata: Metadata = { title: 'Croisement bénéficiaires — Analytique' };
export const dynamic = 'force-dynamic';

export default async function CroisementPage() {
  const data = await croisementBeneficiaires();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Croisement avec la base globale</h2>
        <p className="text-muted-foreground text-sm">
          Compare les soumissions validées (bénéficiaires) avec la base globale.
          Identifie les fiches incomplètes et les nouvelles personnes à importer.
        </p>
      </div>
      <CroisementClient data={data} />
    </div>
  );
}
