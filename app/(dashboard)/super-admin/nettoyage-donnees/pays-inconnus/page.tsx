import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MapPinOff } from 'lucide-react';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import {
  listerBeneficiairesZzz,
  getResumeProjets,
  listerPays,
} from '@/lib/super-admin/nettoyage-pays-actions';
import { PaysInconnusClient } from './pays-inconnus-client';

export const metadata: Metadata = {
  title: 'Pays inconnus (ZZZ) — OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

export default async function PaysInconnusPage() {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    redirect('/dashboard');
  }

  const [beneficiaires, resumeProjets, pays] = await Promise.all([
    listerBeneficiairesZzz(),
    getResumeProjets(),
    listerPays(),
  ]);

  return (
    <div className="space-y-6">
      {/* En-tete */}
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <MapPinOff className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Resolution des pays inconnus (ZZZ)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {beneficiaires.length} beneficiaire{beneficiaires.length > 1 ? 's' : ''} avec
            un pays non resolu a l&apos;import. Corrigez le pays ou ignorez les lignes
            non exploitables.
          </p>
        </div>
      </div>

      <PaysInconnusClient
        beneficiaires={beneficiaires}
        resumeProjets={resumeProjets}
        pays={pays}
      />
    </div>
  );
}
