'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MoreVertical, KeyRound, Power, Pencil, Eye } from 'lucide-react';
import { toast } from 'sonner';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { reinitialiserMotPasseUtilisateur, toggleCompteActif } from '@/lib/utilisateurs/mutations';
import { assumerVueUtilisateur } from '@/lib/auth/view-as-actions';
import type { UtilisateurListItem } from '@/lib/utilisateurs/queries';
import { cn } from '@/lib/utils';

const ROLE_LIBELLES_AFFICHAGE: Record<string, string> = {
  admin_scs: 'Admin SCS',
  editeur_projet: 'Coordonnateur',
  contributeur_partenaire: 'Contributeur',
  lecteur: 'Lecteur',
};

export type UtilisateurTableProps = {
  rows: UtilisateurListItem[];
};

/**
 * Tableau des utilisateurs (Étape 6.5b). Affiche tous les utilisateurs
 * avec actions admin_scs : réinitialiser mdp + désactiver/réactiver.
 *
 * Phase MOCK email : les liens d'activation/reset sont retournés dans le
 * toast de succès pour copier-coller manuel pendant les tests SCS.
 */
export function UtilisateurTable({ rows }: UtilisateurTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
        Aucun utilisateur. Créez le premier compte avec le bouton ci-dessus.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Organisation</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Créé le</TableHead>
            <TableHead className="w-10" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <UtilisateurRow key={u.id} row={u} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UtilisateurRow({ row }: { row: UtilisateurListItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleReinit = () => {
    startTransition(async () => {
      const result = await reinitialiserMotPasseUtilisateur(row.id);
      if (result.status === 'succes') {
        toast.success('Lien de réinitialisation généré', {
          description:
            result.emailEnvoi === 'mock'
              ? `MOCK — Lien à transmettre manuellement : ${result.lienActivation}`
              : 'Email envoyé à l’utilisateur.',
          duration: 12000,
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleToggle = () => {
    startTransition(async () => {
      const result = await toggleCompteActif(row.id, !row.actif);
      if (result.status === 'succes') {
        toast.success(result.actif ? 'Compte réactivé' : 'Compte désactivé');
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleVoirComme = () => {
    startTransition(async () => {
      const result = await assumerVueUtilisateur(row.user_id);
      if (result.status === 'succes') {
        toast.success(`Vue de ${result.targetNomComplet} activée`, {
          description: 'Mode visualisation 30 min — toutes les écritures sont bloquées.',
        });
        router.push('/dashboard');
        router.refresh();
      } else if ('message' in result) {
        toast.error(result.message);
      }
    });
  };

  const roleLib = ROLE_LIBELLES_AFFICHAGE[row.role] ?? row.role;

  return (
    <TableRow className={cn(!row.actif && 'opacity-60')}>
      <TableCell className="font-medium">{row.nom_complet}</TableCell>
      <TableCell>
        <Badge variant="outline">{roleLib}</Badge>
      </TableCell>
      <TableCell className="text-sm">
        {row.organisation_nom ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        <BadgeStatut actif={row.actif} statut={row.statut_validation} />
      </TableCell>
      <TableCell className="text-muted-foreground text-sm tabular-nums">
        {format(new Date(row.created_at), 'd MMM yyyy', { locale: fr })}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }))}
            aria-label="Actions utilisateur"
            disabled={pending}
          >
            <MoreVertical aria-hidden className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => router.push(`/admin/utilisateurs/${row.id}/modifier`)}
              disabled={pending}
            >
              <Pencil aria-hidden className="size-4" />
              Modifier les détails
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleVoirComme} disabled={pending || !row.actif}>
              <Eye aria-hidden className="size-4" />
              Voir comme cet utilisateur
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReinit} disabled={pending}>
              <KeyRound aria-hidden className="size-4" />
              Réinitialiser le mot de passe
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleToggle}
              variant={row.actif ? 'destructive' : undefined}
              disabled={pending}
            >
              <Power aria-hidden className="size-4" />
              {row.actif ? 'Désactiver le compte' : 'Réactiver le compte'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function BadgeStatut({
  actif,
  statut,
}: {
  actif: boolean;
  statut: 'en_attente' | 'valide' | 'rejete';
}) {
  if (!actif) return <Badge variant="secondary">Désactivé</Badge>;
  if (statut === 'valide') return <Badge>Actif</Badge>;
  if (statut === 'en_attente') return <Badge variant="outline">En attente</Badge>;
  return <Badge variant="destructive">Rejeté</Badge>;
}
