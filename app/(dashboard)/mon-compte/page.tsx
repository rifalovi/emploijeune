import type { Metadata } from 'next';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { InfoPersoCard } from '@/components/mon-compte/info-perso-card';
import { ChangerMdpForm } from '@/components/mon-compte/changer-mdp-form';

export const metadata: Metadata = {
  title: 'Mon compte — OIF Emploi Jeunes',
};

/**
 * Page Mon Compte (V1 — Action 3 du sprint 6.5).
 *
 * Accessible à tout utilisateur authentifié (admin_scs, editeur_projet,
 * contributeur_partenaire, lecteur). 2 cards :
 *   1. Informations personnelles (lecture seule en V1)
 *   2. Modifier mon mot de passe (avec vérification de l'ancien mdp)
 *
 * V1.5 prévues : édition prénom/nom/email avec workflow de confirmation,
 * historique des connexions, paramètres de notification.
 */
export default async function MonComptePage() {
  const utilisateur = await requireUtilisateurValide();

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email ?? '—';
  const createdAt = auth.user?.created_at ?? new Date().toISOString();

  // Récupère organisation + projets gérés (pour rôles partenaire/coordo)
  let organisationNom: string | null = null;
  let projetsGeres: string[] = [];
  if (utilisateur.organisation_id) {
    const { data: orga } = await supabase
      .from('organisations')
      .select('nom, projets_geres')
      .eq('id', utilisateur.organisation_id)
      .maybeSingle();
    organisationNom = orga?.nom ?? null;
    projetsGeres = orga?.projets_geres ?? [];
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="text-muted-foreground text-sm">
          Consultez vos informations personnelles et gérez votre mot de passe.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoPersoCard
          email={email}
          nomComplet={utilisateur.nom_complet}
          role={utilisateur.role}
          organisationNom={organisationNom}
          projetsGeres={projetsGeres}
          createdAt={createdAt}
        />
        <ChangerMdpForm />
      </div>
    </div>
  );
}
