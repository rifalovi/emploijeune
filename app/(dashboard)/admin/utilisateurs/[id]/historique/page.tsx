import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { getUtilisateurDetail } from '@/lib/utilisateurs/queries-detail';
import { getHistoriqueUtilisateur } from '@/lib/utilisateurs/queries-affectation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLE_DANS_PROJET_LIBELLES, type RoleDansProjet } from '@/lib/schemas/affectation-projet';

export const metadata: Metadata = {
  title: 'Historique projets — OIF Emploi Jeunes',
};

type PageProps = { params: Promise<{ id: string }> };

export default async function HistoriqueUtilisateurPage({ params }: PageProps) {
  const utilisateurCourant = await requireUtilisateurValide();
  if (utilisateurCourant.role !== 'admin_scs' && utilisateurCourant.role !== 'super_admin')
    notFound();

  const { id } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) notFound();

  const utilisateur = await getUtilisateurDetail(id);
  if (!utilisateur) notFound();

  const lignes = await getHistoriqueUtilisateur(utilisateur.user_id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/utilisateurs/${utilisateur.id}/modifier`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour à la fiche utilisateur
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Historique des projets · {utilisateur.nom_complet}
        </h1>
        <p className="text-muted-foreground text-sm">
          {lignes.length} ligne(s) d'historique · projets passés et actifs.
        </p>
      </header>

      {lignes.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm italic">
            Aucun projet n'a encore été attribué à cet utilisateur.
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {lignes.map((l) => {
            const actif = l.date_fin === null;
            return (
              <Card key={l.id} className={actif ? 'border-primary/50' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {l.projet_code}
                    </Badge>
                    <CardTitle className="text-base font-medium">
                      {l.projet_libelle ?? '—'}
                    </CardTitle>
                    {actif && <Badge>Actif</Badge>}
                    <Badge variant="secondary" className="text-xs">
                      {ROLE_DANS_PROJET_LIBELLES[l.role_dans_projet as RoleDansProjet] ??
                        l.role_dans_projet}
                    </Badge>
                  </div>
                  <CardDescription className="tabular-nums">
                    Du {format(new Date(l.date_debut), 'd MMM yyyy', { locale: fr })}
                    {l.date_fin && (
                      <> au {format(new Date(l.date_fin), 'd MMM yyyy', { locale: fr })}</>
                    )}
                    {!l.date_fin && <> à aujourd'hui</>}
                  </CardDescription>
                </CardHeader>
                {(l.raison_debut || l.raison_fin || l.transfere_par || l.transfere_a) && (
                  <CardContent className="space-y-1 pt-0 text-sm">
                    {l.raison_debut && (
                      <p>
                        <span className="text-muted-foreground">Début : </span>
                        {l.raison_debut}
                      </p>
                    )}
                    {l.raison_fin && (
                      <p>
                        <span className="text-muted-foreground">Fin : </span>
                        {l.raison_fin}
                      </p>
                    )}
                    {l.transfere_par && (
                      <p className="text-muted-foreground text-xs">
                        Transféré depuis un autre coordonnateur.
                      </p>
                    )}
                    {l.transfere_a && (
                      <p className="text-muted-foreground text-xs">
                        Transféré vers un autre coordonnateur.
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </ol>
      )}
    </div>
  );
}
