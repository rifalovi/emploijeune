import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { History } from 'lucide-react';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { listerSessionsImports } from '@/lib/super-admin/import-sessions-actions';
import { ImportSessionsClient } from './import-sessions-client';

export const metadata: Metadata = { title: 'Sessions d\'import — OIF Emploi Jeunes' };
export const dynamic = 'force-dynamic';

export default async function ImportSessionsPage() {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') redirect('/dashboard');

  const sessions = await listerSessionsImports(200);
  const nbZombies = sessions.filter((s) => s.est_zombie).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
          <History className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sessions d&apos;import</h1>
          <p className="mt-1 text-sm text-slate-500">
            {sessions.length} session{sessions.length > 1 ? 's' : ''}
            {nbZombies > 0 && (
              <span className="ml-1 font-semibold text-orange-600">
                dont {nbZombies} zombie{nbZombies > 1 ? 's' : ''} a traiter
              </span>
            )}
          </p>
        </div>
      </div>
      <ImportSessionsClient sessions={sessions} />
    </div>
  );
}
