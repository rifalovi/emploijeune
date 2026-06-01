import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Copy, CheckCircle2 } from 'lucide-react';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { detecterDoublons } from '@/lib/super-admin/import-sessions-actions';
import { DoublonsClient } from './doublons-client';

export const metadata: Metadata = { title: 'Doublons — OIF Emploi Jeunes' };
export const dynamic = 'force-dynamic';

export default async function DoublonsPage() {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') redirect('/dashboard');

  const doublons = await detecterDoublons();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
          <Copy className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Detection des doublons</h1>
          <p className="mt-1 text-sm text-slate-500">
            {doublons.length === 0 ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="size-4" /> Aucun doublon detecte. La base est saine.
              </span>
            ) : (
              <>{doublons.length} groupe{doublons.length > 1 ? 's' : ''} de doublons detecte{doublons.length > 1 ? 's' : ''}</>
            )}
          </p>
        </div>
      </div>
      {doublons.length > 0 && <DoublonsClient doublons={doublons} />}
    </div>
  );
}
