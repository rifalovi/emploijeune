import type { Metadata } from 'next';

import { exigerAccesDataStudio } from '@/lib/super-admin/permissions';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import {
  listerHistorique,
  listerIndicateursSource,
  listerProgrammes,
  listerProjets,
} from '@/lib/atelier-analyse/queries';
import { listerDocumentsReference } from '@/lib/atelier-analyse/rag';
import { AtelierClient } from './atelier-client';

export const metadata: Metadata = {
  title: "Atelier d'analyse — OIF Emploi Jeunes",
};

export const dynamic = 'force-dynamic';

/**
 * Atelier d'analyse (SCS DataStudio en ligne) : charge les réponses d'enquête
 * d'un indicateur, produit tris à plat et croisements via le moteur DataStudio,
 * et conserve l'historique des traitements. Réservé SCS / super_admin.
 */
export default async function AtelierAnalysePage() {
  // Accès réservé : super administrateur, ou tout utilisateur explicitement
  // autorisé au module SCS DataStudio (permissions_delegues).
  await exigerAccesDataStudio();
  const utilisateur = await requireUtilisateurValide();
  const estSuperAdmin = utilisateur.role === 'super_admin';

  const [indicateurs, historique, documentsReference, programmes, projets] = await Promise.all([
    listerIndicateursSource(),
    listerHistorique(),
    listerDocumentsReference(),
    listerProgrammes(),
    listerProjets(),
  ]);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Atelier d’analyse</h1>
        <p className="text-muted-foreground text-sm">
          Analysez les données d’enquête ou tout fichier importé avec le moteur{' '}
          <strong>SCS DataStudio</strong> : tris à plat, croisements, tests statistiques, réponses
          multiples, nettoyage de base et rapports — sans quitter la plateforme.
        </p>
      </header>

      <AtelierClient
        indicateurs={indicateurs}
        historique={historique}
        documentsReference={documentsReference}
        programmes={programmes}
        projets={projets}
        estSuperAdmin={estSuperAdmin}
      />
    </div>
  );
}
