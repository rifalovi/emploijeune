import Link from 'next/link';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConsentementBadge } from './consentement-badge';
import { StatutBadge } from './statut-badge';
import { BadgeProjet } from '@/components/shared/badge-projet';
import { BeneficiaireRowActions } from './beneficiaire-row-actions';
import { calculerTrancheAge } from './tranche-age';
import type { BeneficiaireListItem } from '@/lib/beneficiaires/queries';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import type {
  ProgrammeStrategiqueCode,
  StatutBeneficiaireCode,
  Sexe,
} from '@/lib/schemas/nomenclatures';
import { SEXE_LIBELLES } from '@/lib/schemas/nomenclatures';
import { cn } from '@/lib/utils';

export type BeneficiaireTableProps = {
  rows: BeneficiaireListItem[];
  nomenclatures: Nomenclatures;
  /** Rôle de l'utilisateur courant, utilisé pour filtrer les actions disponibles. */
  peutEditerTout: boolean;
  peutSupprimer: boolean;
  utilisateurId: string;
};

/**
 * Tableau principal de la liste bénéficiaires.
 *
 * - Bordure gauche de chaque ligne colorée selon le PS du projet
 *   (décision bonus Étape 4 : visualisation par Programme Stratégique).
 * - Ligne entière cliquable → ouvre `/beneficiaires/[id]` (convention SaaS
 *   moderne : Notion, Linear, Airtable).
 * - Menu ⋯ en bout de ligne : Modifier + Supprimer (selon permissions).
 * - Responsive : scroll horizontal sur mobile, colonnes prioritaires en premier.
 */
export function BeneficiaireTable({
  rows,
  nomenclatures,
  peutEditerTout,
  peutSupprimer,
  utilisateurId,
}: BeneficiaireTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1" aria-hidden />
            <TableHead>Prénom Nom</TableHead>
            <TableHead>Sexe</TableHead>
            <TableHead>Tranche d&apos;âge</TableHead>
            <TableHead>Projet</TableHead>
            <TableHead>Pays</TableHead>
            <TableHead>Domaine</TableHead>
            <TableHead className="text-center">Année</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Consentement</TableHead>
            <TableHead className="w-10" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <BeneficiaireRow
              key={r.id}
              row={r}
              nomenclatures={nomenclatures}
              peutEditer={peutEditerTout || r.created_by === utilisateurId}
              peutSupprimer={peutSupprimer}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BeneficiaireRow({
  row,
  nomenclatures,
  peutEditer,
  peutSupprimer,
}: {
  row: BeneficiaireListItem;
  nomenclatures: Nomenclatures;
  peutEditer: boolean;
  peutSupprimer: boolean;
}) {
  const projetMeta = nomenclatures.projets.get(row.projet_code);
  const ps = projetMeta?.programme_strategique as ProgrammeStrategiqueCode | null | undefined;
  const couleurBordure = ps ? PROGRAMMES_STRATEGIQUES[ps].principale : 'transparent';

  return (
    <TableRow className="group relative cursor-pointer">
      {/* La bordure gauche colorée selon le PS du projet — encodée en cellule
          fantôme pour rester dans la grille de la table shadcn. */}
      <TableCell className="p-0" aria-hidden>
        <span className="block h-full w-1" style={{ backgroundColor: couleurBordure }} />
      </TableCell>

      <TableCell className="font-medium">
        <Link
          href={`/beneficiaires/${row.id}`}
          className="focus-visible:ring-ring block rounded focus-visible:ring-2 focus-visible:outline-none"
        >
          {row.prenom} {row.nom}
        </Link>
      </TableCell>
      <TableCell>
        <LibelleCell href={`/beneficiaires/${row.id}`}>
          {SEXE_LIBELLES[row.sexe as Sexe]}
        </LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={`/beneficiaires/${row.id}`}>
          {calculerTrancheAge(row.date_naissance)}
        </LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={`/beneficiaires/${row.id}`}>
          <BadgeProjet code={row.projet_code} programmeStrategique={ps ?? null} variant="inline" />
        </LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={`/beneficiaires/${row.id}`}>
          {nomenclatures.pays.get(row.pays_code) ?? row.pays_code}
        </LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell
          href={`/beneficiaires/${row.id}`}
          className="max-w-[14rem] truncate"
          title={
            nomenclatures.domaines.get(row.domaine_formation_code) ?? row.domaine_formation_code
          }
        >
          {nomenclatures.domaines.get(row.domaine_formation_code) ?? row.domaine_formation_code}
        </LibelleCell>
      </TableCell>
      <TableCell className="text-center tabular-nums">
        <LibelleCell href={`/beneficiaires/${row.id}`}>{row.annee_formation}</LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={`/beneficiaires/${row.id}`}>
          <StatutBadge code={row.statut_code as StatutBeneficiaireCode} />
        </LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={`/beneficiaires/${row.id}`}>
          <ConsentementBadge recueilli={row.consentement_recueilli} size="sm" />
        </LibelleCell>
      </TableCell>
      <TableCell>
        <BeneficiaireRowActions id={row.id} peutEditer={peutEditer} peutSupprimer={peutSupprimer} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Wrapper de cellule qui propage le clic vers `/beneficiaires/[id]`. On utilise
 * un `<Link>` par cellule plutôt qu'un `onClick` sur `<tr>` (qui n'est pas
 * sémantique et casserait les middle-clicks / Ctrl+clics pour ouvrir en onglet).
 */
function LibelleCell({
  href,
  children,
  className,
  title,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'focus-visible:ring-ring block rounded focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
      title={title}
    >
      {children}
    </Link>
  );
}
