import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RoleUtilisateur } from '@/lib/supabase/auth';

const ROLE_LIBELLES: Record<RoleUtilisateur, string> = {
  super_admin: 'Super administrateur',
  admin_scs: 'Administrateur SCS',
  editeur_projet: 'Coordonnateur de projet',
  contributeur_partenaire: 'Contributeur partenaire',
  lecteur: 'Lecteur (lecture seule)',
};

export type InfoPersoCardProps = {
  email: string;
  nomComplet: string;
  role: RoleUtilisateur;
  organisationNom: string | null;
  projetsGeres: string[];
  createdAt: string;
};

export function InfoPersoCard({
  email,
  nomComplet,
  role,
  organisationNom,
  projetsGeres,
  createdAt,
}: InfoPersoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Informations personnelles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Champ label="Email">
          <span className="text-muted-foreground font-mono">{email}</span>
        </Champ>
        <Champ label="Nom complet">
          <span className="font-medium">{nomComplet}</span>
        </Champ>
        <Champ label="Rôle">
          <Badge variant="outline">{ROLE_LIBELLES[role]}</Badge>
        </Champ>
        {role === 'contributeur_partenaire' && (
          <Champ label="Organisation rattachée">
            {organisationNom ?? <span className="text-muted-foreground italic">Aucune</span>}
          </Champ>
        )}
        {role === 'editeur_projet' && (
          <Champ label="Projets gérés">
            {projetsGeres.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {projetsGeres.map((p) => (
                  <Badge key={p} variant="secondary" className="font-mono text-xs">
                    {p}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground italic">Aucun</span>
            )}
          </Champ>
        )}
        <Champ label="Compte créé le">
          {format(new Date(createdAt), 'd MMMM yyyy', { locale: fr })}
        </Champ>

        <p className="text-muted-foreground border-t pt-3 text-xs italic">
          La modification de l’email, du prénom et du nom est réservée à un administrateur SCS. Ces
          champs deviendront modifiables ici en V1.5.
        </p>
      </CardContent>
    </Card>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-baseline">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}
