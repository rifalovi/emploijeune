import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { ImportsPageClient } from './imports-client';

export const metadata: Metadata = {
  title: 'Imports Excel — OIF Emploi Jeunes',
};

/**
 * Page imports Excel (Étape 7) — admin_scs + editeur_projet.
 * Le composant client gère l'état du rapport modal après upload.
 */
export default async function ImportsPage() {
  const utilisateur = await requireUtilisateurValide();
  if (!['super_admin', 'admin_scs', 'editeur_projet'].includes(utilisateur.role)) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Imports Excel</h1>
        <p className="text-muted-foreground text-sm">
          Importez en masse des bénéficiaires (A1) ou des structures (B1) depuis un fichier .xlsx au
          format Template V1. Les erreurs sont reportées ligne par ligne pour correction et
          ré-import.
        </p>
      </header>

      <ImportsPageClient />
    </div>
  );
}
