import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { getCubesTcd } from '@/lib/analyses/pivot-queries';
import { PivotTableClient } from '@/components/analyses/pivot-table-client';

export const metadata: Metadata = {
  title: 'Tableau croisé dynamique – OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

/**
 * Tableau croisé dynamique (TCD) sur les indicateurs A1 (bénéficiaires) et
 * B1 (structures) : glisser-déposer des champs en Lignes / Colonnes / Filtres,
 * mesures Nombre / Somme, totaux et export Excel. Réservé SCS / super_admin.
 */
export default async function TcdPage() {
  const utilisateur = await requireUtilisateurValide();
  if (!['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    redirect('/indicateurs');
  }

  const { a1, b1, erreur } = await getCubesTcd();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau croisé dynamique</h1>
        <p className="text-muted-foreground text-sm">
          Croisez librement les bénéficiaires (A1) et les structures (B1) par projet, pays, sexe,
          domaine, année… Glissez les champs dans <strong>Lignes</strong>, <strong>Colonnes</strong>{' '}
          et <strong>Filtres</strong>, puis exportez vers Excel.
        </p>
      </header>

      {erreur ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Données indisponibles</p>
          <p className="mt-1 text-xs">
            Les fonctions d&apos;agrégation ne sont pas encore appliquées en base. Lancez la
            migration <code className="font-mono">20260615000004_cubes_tcd.sql</code> (Supabase SQL
            Editor), puis rechargez.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">Détail : {erreur}</p>
        </div>
      ) : (
        <PivotTableClient a1={a1} b1={b1} />
      )}
    </div>
  );
}
