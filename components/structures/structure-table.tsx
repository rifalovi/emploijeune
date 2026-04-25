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
import { Badge } from '@/components/ui/badge';
import { BadgeProjet } from '@/components/shared/badge-projet';
import { StatutStructureBadge } from './statut-structure-badge';
import { StructureRowActions } from './structure-row-actions';
import type { StructureListItem } from '@/lib/structures/queries';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import type { ProgrammeStrategiqueCode, StatutStructure } from '@/lib/schemas/nomenclatures';
import { formaterMontant } from '@/lib/utils/formater-montant';
import type { DeviseCode } from '@/lib/schemas/nomenclatures';
import { cn } from '@/lib/utils';

export type StructureTableProps = {
  rows: StructureListItem[];
  nomenclatures: Nomenclatures;
  peutEditerTout: boolean;
  peutSupprimer: boolean;
  utilisateurId: string;
};

/**
 * Tableau principal de la liste structures (indicateur B1). Reprend le
 * pattern table bénéficiaires :
 *   - Bordure gauche colorée selon le PS du projet
 *   - Ligne entière cliquable → `/structures/[id]`
 *   - Menu ⋯ Modifier / Supprimer (selon permissions)
 *   - Responsive : scroll horizontal sur mobile
 */
export function StructureTable({
  rows,
  nomenclatures,
  peutEditerTout,
  peutSupprimer,
  utilisateurId,
}: StructureTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1" aria-hidden />
            <TableHead>Structure</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Secteur</TableHead>
            <TableHead>Pays</TableHead>
            <TableHead>Projet</TableHead>
            <TableHead className="text-center">Année</TableHead>
            <TableHead className="text-right">Montant appui</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-10" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <StructureRow
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

function StructureRow({
  row,
  nomenclatures,
  peutEditer,
  peutSupprimer,
}: {
  row: StructureListItem;
  nomenclatures: Nomenclatures;
  peutEditer: boolean;
  peutSupprimer: boolean;
}) {
  const projetMeta = nomenclatures.projets.get(row.projet_code);
  const ps = projetMeta?.programme_strategique as ProgrammeStrategiqueCode | null | undefined;
  const couleurBordure = ps ? PROGRAMMES_STRATEGIQUES[ps].principale : 'transparent';
  const href = `/structures/${row.id}`;
  const typeLibelle =
    nomenclatures.typesStructure.get(row.type_structure_code) ?? row.type_structure_code;
  const secteurLibelle =
    nomenclatures.secteursActivite.get(row.secteur_activite_code) ?? row.secteur_activite_code;
  const paysLibelle = nomenclatures.pays.get(row.pays_code) ?? row.pays_code;
  const montantFormate = formaterMontant(row.montant_appui, row.devise_code as DeviseCode | null);

  return (
    <TableRow className="group relative cursor-pointer">
      <TableCell className="p-0" aria-hidden>
        <span className="block h-full w-1" style={{ backgroundColor: couleurBordure }} />
      </TableCell>

      <TableCell className="font-medium">
        <Link
          href={href}
          className="focus-visible:ring-ring block rounded focus-visible:ring-2 focus-visible:outline-none"
          title={row.nom_structure}
        >
          <span className="block max-w-[16rem] truncate">{row.nom_structure}</span>
          {row.porteur_nom && (
            <span className="text-muted-foreground block text-xs font-normal">
              {row.porteur_prenom ? `${row.porteur_prenom} ` : ''}
              {row.porteur_nom}
            </span>
          )}
        </Link>
      </TableCell>
      <TableCell>
        <LibelleCell href={href}>
          <Badge variant="outline" className="font-medium" title={typeLibelle}>
            {typeLibelle}
          </Badge>
        </LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={href} className="max-w-[14rem] truncate" title={secteurLibelle}>
          {secteurLibelle}
        </LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={href}>{paysLibelle}</LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={href}>
          <BadgeProjet code={row.projet_code} programmeStrategique={ps ?? null} variant="inline" />
        </LibelleCell>
      </TableCell>
      <TableCell className="text-center tabular-nums">
        <LibelleCell href={href}>{row.annee_appui}</LibelleCell>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <LibelleCell href={href}>
          {montantFormate || <span className="text-muted-foreground">—</span>}
        </LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={href}>
          <StatutStructureBadge code={row.statut_creation as StatutStructure} />
        </LibelleCell>
      </TableCell>
      <TableCell>
        <StructureRowActions id={row.id} peutEditer={peutEditer} peutSupprimer={peutSupprimer} />
      </TableCell>
    </TableRow>
  );
}

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
