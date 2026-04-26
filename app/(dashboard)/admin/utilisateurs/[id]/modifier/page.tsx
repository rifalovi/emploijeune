import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import {
  getUtilisateurDetail,
  getAuditUtilisateur,
  listOrganisationsLegeres,
} from '@/lib/utilisateurs/queries-detail';
import { Card, CardContent } from '@/components/ui/card';
import { FormulaireModifierUtilisateur } from '@/components/admin/formulaire-modifier-utilisateur';
import { AuditUtilisateurCard } from '@/components/admin/audit-utilisateur-card';

export const metadata: Metadata = {
  title: 'Modifier utilisateur — OIF Emploi Jeunes',
};

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Page d'édition complète d'un utilisateur (Étape 8 enrichie — admin_scs only).
 *
 * Layout 5 cards :
 *   1. Informations personnelles (nom complet)
 *   2. Rôle (Select + AlertDialog si changement)
 *   3. Rattachement organisation (avec aperçu projets gérés)
 *   4. Statut (toggle actif/désactivé + raison optionnelle)
 *   5. Audit (lecture seule, 10 dernières actions)
 *
 * Garde-fous métier appliqués côté Server Action :
 *   - Pas de modification de soi-même (rôle ou actif=false)
 *   - Pas de désactivation du dernier admin_scs actif
 */
export default async function ModifierUtilisateurPage({ params }: PageProps) {
  const utilisateurCourant = await requireUtilisateurValide();
  if (utilisateurCourant.role !== 'admin_scs') notFound();

  const { id } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) notFound();

  const [utilisateur, audit, organisations] = await Promise.all([
    getUtilisateurDetail(id),
    getAuditUtilisateur(id, 10),
    listOrganisationsLegeres(),
  ]);

  if (!utilisateur) notFound();

  const estLuiMeme = utilisateur.user_id === utilisateurCourant.user_id;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/utilisateurs"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour à la liste des utilisateurs
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier · {utilisateur.nom_complet}
        </h1>
        <p className="text-muted-foreground text-sm">
          Email : <code className="font-mono">{utilisateur.email ?? '—'}</code> · Compte créé le{' '}
          {new Date(utilisateur.created_at).toLocaleDateString('fr-FR')}
        </p>
      </header>

      <Card>
        <CardContent className="bg-muted/30 p-3 text-xs">
          <strong>Email non modifiable</strong> — le changement d’email impacte l’authentification
          (auth.users) et la cohérence des sessions actives. Pour modifier un email, supprimez le
          compte et créez-en un nouveau (ou attendez V1.5).
        </CardContent>
      </Card>

      <FormulaireModifierUtilisateur
        utilisateurId={utilisateur.id}
        initialValues={{
          nom_complet: utilisateur.nom_complet,
          role: utilisateur.role,
          organisation_id: utilisateur.organisation_id,
          actif: utilisateur.actif,
        }}
        organisations={organisations}
        estLuiMeme={estLuiMeme}
      />

      <AuditUtilisateurCard lignes={audit} />
    </div>
  );
}
