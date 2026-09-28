import type { Metadata } from 'next';

import { exigerAccesDataStudio } from '@/lib/super-admin/permissions';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { AnalyseurCmrClient } from './analyseur-cmr-client';

export const metadata: Metadata = {
  title: 'Analyseur de CMR — OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

/**
 * Analyseur autonome de CMR (Cadre de Mesure du Rendement) : à partir d'un
 * classeur Excel (un onglet par projet), produit un audit par projet (anomalies,
 * scores), un CMR révisé tracé, et un tableau de bord global consolidé. Réservé
 * aux utilisateurs autorisés au module SCS DataStudio.
 */
export default async function AnalyseurCmrPage() {
  await exigerAccesDataStudio();
  await requireUtilisateurValide();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analyseur de CMR</h1>
        <p className="text-muted-foreground text-sm">
          Chargez votre <strong>Cadre de Mesure du Rendement</strong> (un onglet par projet) :
          l’outil audite chaque projet (anomalies, contrôle des calculs, cohérence GAR, qualité des
          données), propose un CMR révisé tracé, et consolide le tout dans un{' '}
          <strong>tableau de bord global</strong> — audit, corrections et livrables HTML
          téléchargeables.
        </p>
      </header>

      <AnalyseurCmrClient />
    </div>
  );
}
