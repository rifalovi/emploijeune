import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Users, Inbox } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { compterDemandesEnAttente } from '@/lib/demandes-acces/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Administration — OIF Emploi Jeunes',
};

/**
 * Page hub d'administration (admin_scs uniquement) — V1-Enrichie-A.
 * Présente les sous-pages d'admin avec leurs compteurs (badges).
 *
 * V1.5 : enrichir avec dashboard audit + paramètres + statistiques d'usage.
 */
export default async function AdminPage() {
  const utilisateur = await requireUtilisateurValide();
  if (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin') notFound();

  const nbDemandesEnAttente = await compterDemandesEnAttente().catch(() => 0);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="text-muted-foreground text-sm">
          Outils d’administration réservés aux administrateurs SCS.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/utilisateurs"
          className="hover:bg-accent/30 rounded-lg transition-colors"
        >
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users aria-hidden className="text-primary size-6" />
                <div>
                  <CardTitle className="text-base">Utilisateurs</CardTitle>
                  <CardDescription>Comptes existants, création, désactivation</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              Gérez les comptes des coordonnateurs, contributeurs et autres administrateurs.
            </CardContent>
          </Card>
        </Link>

        <Link
          href="/admin/demandes-acces"
          className="hover:bg-accent/30 rounded-lg transition-colors"
        >
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Inbox aria-hidden className="text-primary size-6" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Demandes d’accès</CardTitle>
                    {nbDemandesEnAttente > 0 && (
                      <Badge variant="destructive">{nbDemandesEnAttente}</Badge>
                    )}
                  </div>
                  <CardDescription>Approuver ou rejeter les demandes auto-service</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              {nbDemandesEnAttente === 0
                ? 'Aucune demande en attente.'
                : `${nbDemandesEnAttente} demande${nbDemandesEnAttente > 1 ? 's' : ''} en attente de traitement.`}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
