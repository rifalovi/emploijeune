import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getHistoriqueProjet } from '@/lib/utilisateurs/queries-affectation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLE_DANS_PROJET_LIBELLES, type RoleDansProjet } from '@/lib/schemas/affectation-projet';

export const metadata: Metadata = {
  title: 'Historique projet — OIF Emploi Jeunes',
};

type PageProps = { params: Promise<{ code: string }> };

export default async function HistoriqueProjetPage({ params }: PageProps) {
  const utilisateurCourant = await requireUtilisateurValide();
  if (utilisateurCourant.role !== 'admin_scs' && utilisateurCourant.role !== 'super_admin')
    notFound();

  const { code } = await params;
  if (!/^[A-Z0-9_]+$/.test(code)) notFound();

  const adminClient = createSupabaseAdminClient();
  const { data: projet } = await adminClient
    .from('projets')
    .select('code, libelle, programme_strategique')
    .eq('code', code)
    .maybeSingle();

  if (!projet) notFound();

  const lignes = await getHistoriqueProjet(code);

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
          Historique du projet <span className="font-mono">{projet.code}</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          {projet.libelle} · {lignes.length} affectation(s) (passées + actives).
        </p>
      </header>

      {lignes.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm italic">
            Aucun coordonnateur n'a encore été attribué à ce projet.
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
                    <CardTitle className="text-base font-medium">
                      {l.user_nom ?? l.user_id.slice(0, 8) + '…'}
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
                {(l.raison_debut || l.raison_fin) && (
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
