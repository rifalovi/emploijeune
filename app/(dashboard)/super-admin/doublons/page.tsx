import type { Metadata } from 'next';
import { Copy, CheckCircle2 } from 'lucide-react';
import {
  detecterDoublons,
  detecterDoublonsStructures,
} from '@/lib/super-admin/import-sessions-actions';
import { DoublonsClient } from './doublons-client';
import { exigerAccesModule } from '@/lib/super-admin/permissions';

export const metadata: Metadata = { title: 'Doublons — OIF Emploi Jeunes' };
export const dynamic = 'force-dynamic';

export default async function DoublonsPage() {
  await exigerAccesModule('doublons');

  const [beneficiaires, structures] = await Promise.all([
    detecterDoublons(),
    detecterDoublonsStructures(),
  ]);

  const total = beneficiaires.length + structures.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
          <Copy className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Détection des doublons</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total === 0 ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="size-4" /> Aucun doublon détecté. La base est saine.
              </span>
            ) : (
              <>
                {total} groupe{total > 1 ? 's' : ''} de doublons détecté{total > 1 ? 's' : ''} (
                {beneficiaires.length} bénéficiaires · {structures.length} structures)
              </>
            )}
          </p>
        </div>
      </div>
      <DoublonsClient beneficiaires={beneficiaires} structures={structures} />
    </div>
  );
}
