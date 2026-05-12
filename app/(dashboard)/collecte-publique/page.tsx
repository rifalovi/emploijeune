import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { listerLiensCollecte, listerSoumissions } from '@/lib/collecte-publique/actions';
import { CollectePubliqueClient } from './collecte-publique-client';

export const metadata: Metadata = {
  title: 'Collecte publique – OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

/**
 * Page de gestion des liens de collecte publique (admin).
 * Accessible aux rôles admin_scs, super_admin, editeur_projet, contributeur_partenaire.
 * Seuls les admins peuvent valider / rejeter des soumissions.
 */
export default async function CollectePubliquePage() {
  const utilisateur = await getCurrentUtilisateur({ allowViewAs: true });
  if (!utilisateur) redirect('/connexion');

  const rolesAutorises = ['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire'];
  if (!rolesAutorises.includes(utilisateur.role)) {
    redirect('/dashboard');
  }

  const [liensResult, soumissionsResult] = await Promise.all([
    listerLiensCollecte(),
    listerSoumissions({ limit: 200 }),
  ]);

  const liens = liensResult.status === 'succes' ? liensResult.liens : [];
  const soumissions = soumissionsResult.status === 'succes' ? soumissionsResult.soumissions : [];

  const peutCreer = rolesAutorises.includes(utilisateur.role);
  const peutValider = utilisateur.role === 'admin_scs' || utilisateur.role === 'super_admin';

  return (
    <div className="px-6 py-8">
      <CollectePubliqueClient
        liensInitiaux={liens}
        soumissionsInitiales={soumissions}
        peutCreer={peutCreer}
        peutValider={peutValider}
      />
    </div>
  );
}
