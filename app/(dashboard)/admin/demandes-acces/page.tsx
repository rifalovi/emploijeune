import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { listDemandesAcces } from '@/lib/demandes-acces/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DemandeAccesActions } from '@/components/demandes-acces/demande-acces-actions';
import { DemandeAccesSupprimer } from '@/components/demandes-acces/demande-acces-supprimer';
import { ROLE_DEMANDABLE_LIBELLES } from '@/lib/schemas/demande-acces';

export const metadata: Metadata = {
  title: 'Administration · Demandes d’accès — OIF Emploi Jeunes',
};

const STATUTS_LIBELLES = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Rejetée',
} as const;

export default async function AdminDemandesAccesPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const utilisateur = await requireUtilisateurValide();
  if (utilisateur.role !== 'admin_scs') notFound();

  const { statut } = await searchParams;
  const filtre =
    statut === 'approved' || statut === 'rejected' || statut === 'pending' ? statut : undefined;

  const demandes = await listDemandesAcces(filtre);
  const enAttente = demandes.filter((d) => d.statut === 'pending').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Demandes d’accès</h1>
          <p className="text-muted-foreground text-sm">
            {demandes.length.toLocaleString('fr-FR')} demande(s){' '}
            {filtre ? `(${STATUTS_LIBELLES[filtre]})` : ''}
            {enAttente > 0 && !filtre ? ` · ${enAttente} en attente` : ''}.
          </p>
        </div>
        <FiltreNavigation statutCourant={filtre} />
      </header>

      {demandes.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            Aucune demande {filtre ? `avec le statut « ${STATUTS_LIBELLES[filtre]} »` : ''}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {demandes.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {d.prenom} {d.nom}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1 font-mono text-xs">{d.email}</p>
                  </div>
                  <BadgeStatut statut={d.statut} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Champ label="Rôle souhaité">
                    <Badge variant="outline">
                      {ROLE_DEMANDABLE_LIBELLES[
                        d.role_souhaite as keyof typeof ROLE_DEMANDABLE_LIBELLES
                      ] ?? d.role_souhaite}
                    </Badge>
                  </Champ>
                  <Champ label="Soumise le">
                    {format(new Date(d.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                  </Champ>
                </div>

                {d.contexte_souhaite && (
                  <Champ label="Contexte">
                    <span className="text-muted-foreground whitespace-pre-wrap">
                      {d.contexte_souhaite}
                    </span>
                  </Champ>
                )}

                <Champ label="Justification">
                  <span className="text-muted-foreground whitespace-pre-wrap">
                    {d.justification}
                  </span>
                </Champ>

                {d.statut === 'rejected' && d.raison_rejet && (
                  <Champ label="Raison du rejet">
                    <span className="text-destructive text-xs whitespace-pre-wrap">
                      {d.raison_rejet}
                    </span>
                  </Champ>
                )}

                {d.statut === 'pending' && (
                  <div className="border-t pt-3">
                    <DemandeAccesActions
                      demandeId={d.id}
                      demandeurLibelle={`${d.prenom} ${d.nom} (${d.email})`}
                    />
                  </div>
                )}
                {d.statut === 'rejected' && (
                  <div className="border-t pt-3">
                    <DemandeAccesSupprimer
                      demandeId={d.id}
                      demandeurLibelle={`${d.prenom} ${d.nom} (${d.email})`}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FiltreNavigation({ statutCourant }: { statutCourant: string | undefined }) {
  const items: Array<{ key: string | undefined; libelle: string }> = [
    { key: undefined, libelle: 'Toutes' },
    { key: 'pending', libelle: 'En attente' },
    { key: 'approved', libelle: 'Approuvées' },
    { key: 'rejected', libelle: 'Rejetées' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => {
        const actif = statutCourant === it.key;
        const href = it.key ? `?statut=${it.key}` : '?';
        return (
          <a
            key={it.libelle}
            href={href}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              actif ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-input'
            }`}
          >
            {it.libelle}
          </a>
        );
      })}
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function BadgeStatut({ statut }: { statut: 'pending' | 'approved' | 'rejected' }) {
  if (statut === 'approved')
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-600">
        {STATUTS_LIBELLES.approved}
      </Badge>
    );
  if (statut === 'rejected')
    return <Badge variant="destructive">{STATUTS_LIBELLES.rejected}</Badge>;
  return <Badge variant="outline">{STATUTS_LIBELLES.pending}</Badge>;
}
