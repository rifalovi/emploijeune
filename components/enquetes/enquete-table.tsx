import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
import type { SessionEnqueteListItem } from '@/lib/enquetes/queries';
import type { ProgrammeStrategiqueCode } from '@/lib/schemas/nomenclatures';
import { VAGUE_ENQUETE_LIBELLES, type VagueEnquete } from '@/lib/schemas/enquetes/nomenclatures';
import { cn } from '@/lib/utils';

export type EnqueteTableProps = {
  rows: SessionEnqueteListItem[];
};

/**
 * Tableau principal de la liste des sessions d'enquête (Étape 6c).
 * Pattern miroir de StructureTable / BeneficiaireTable :
 *   - Bordure gauche colorée selon PS du projet
 *   - Ligne entière cliquable → /enquetes/[id]
 *   - Pas de menu actions par ligne (édition complète depuis la fiche détail)
 */
export function EnqueteTable({ rows }: EnqueteTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1" aria-hidden />
            <TableHead>Cible</TableHead>
            <TableHead>Questionnaire</TableHead>
            <TableHead>Projet</TableHead>
            <TableHead>Vague</TableHead>
            <TableHead>Date collecte</TableHead>
            <TableHead className="text-right">Indicateurs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <EnqueteRow key={r.id} row={r} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EnqueteRow({ row }: { row: SessionEnqueteListItem }) {
  const ps = row.programme_strategique as ProgrammeStrategiqueCode | null;
  const couleurBordure = ps ? PROGRAMMES_STRATEGIQUES[ps].principale : 'transparent';
  const href = `/enquetes/${row.id}`;
  const dateLisible = (() => {
    try {
      return format(new Date(row.date_collecte), 'd MMM yyyy', { locale: fr });
    } catch {
      return row.date_collecte;
    }
  })();
  const vagueLibelle =
    VAGUE_ENQUETE_LIBELLES[row.vague_enquete as VagueEnquete] ?? row.vague_enquete;

  return (
    <TableRow className="group relative cursor-pointer">
      <TableCell className="p-0" aria-hidden>
        <span className="block h-full w-1" style={{ backgroundColor: couleurBordure }} />
      </TableCell>

      <TableCell className="font-medium">
        <LibelleCell href={href} title={row.cible_libelle ?? undefined}>
          <span className="block max-w-[16rem] truncate">{row.cible_libelle ?? '—'}</span>
        </LibelleCell>
      </TableCell>

      <TableCell>
        <LibelleCell href={href}>
          <Badge variant="outline" className="font-mono">
            {row.questionnaire ?? '—'}
          </Badge>
        </LibelleCell>
      </TableCell>

      <TableCell>
        <LibelleCell href={href}>
          {row.projet_code ? (
            <BadgeProjet code={row.projet_code} programmeStrategique={ps} variant="inline" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </LibelleCell>
      </TableCell>

      <TableCell>
        <LibelleCell href={href}>
          <span className="text-sm">{vagueLibelle}</span>
        </LibelleCell>
      </TableCell>

      <TableCell className="tabular-nums">
        <LibelleCell href={href}>{dateLisible}</LibelleCell>
      </TableCell>

      <TableCell className="text-right">
        <LibelleCell href={href}>
          <div className="flex flex-wrap justify-end gap-1">
            {row.indicateurs.map((code) => (
              <Badge key={code} variant="secondary" className="font-mono text-xs">
                {code}
              </Badge>
            ))}
          </div>
        </LibelleCell>
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
