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
import type { DeviseCode, Sexe } from '@/lib/schemas/nomenclatures';
import { SEXE_LIBELLES } from '@/lib/schemas/nomenclatures';
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
          <TableRow className="whitespace-nowrap">
            <TableHead className="w-1" aria-hidden />
            <TableHead>Structure</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Secteur</TableHead>
            <TableHead>Secteur précis</TableHead>
            <TableHead>Initiative</TableHead>
            <TableHead>Pays</TableHead>
            <TableHead>Projet</TableHead>
            <TableHead>Porteur</TableHead>
            <TableHead>Sexe</TableHead>
            <TableHead>Fonction</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead>Courriel</TableHead>
            <TableHead className="text-center">Année</TableHead>
            <TableHead>Nature appui</TableHead>
            <TableHead className="text-right">Montant appui</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Date création</TableHead>
            <TableHead>Consentement</TableHead>
            <TableHead>Ville</TableHead>
            <TableHead>Localité</TableHead>
            <TableHead>Adresse</TableHead>
            <TableHead className="text-right">CA</TableHead>
            <TableHead className="text-center">Emp. perm.</TableHead>
            <TableHead className="text-center">Emp. temp.</TableHead>
            <TableHead className="text-center">Emplois créés</TableHead>
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
  const natureLibelle =
    nomenclatures.naturesAppui.get(row.nature_appui_code) ?? row.nature_appui_code;
  const sexeLibelle = row.porteur_sexe
    ? (SEXE_LIBELLES[row.porteur_sexe as Sexe] ?? row.porteur_sexe)
    : null;
  const caFormate = formaterMontant(row.chiffre_affaires, row.devise_code as DeviseCode | null);

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
      <TexteCell href={href} valeur={row.secteur_precis} />
      <TexteCell href={href} valeur={row.intitule_initiative} />
      <TableCell>
        <LibelleCell href={href}>{paysLibelle}</LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={href}>
          <BadgeProjet code={row.projet_code} programmeStrategique={ps ?? null} variant="inline" />
        </LibelleCell>
      </TableCell>
      <TexteCell
        href={href}
        valeur={[row.porteur_prenom, row.porteur_nom].filter(Boolean).join(' ').trim() || null}
      />
      <TexteCell href={href} valeur={sexeLibelle} />
      <TexteCell href={href} valeur={row.fonction_porteur} />
      <TexteCell href={href} valeur={row.telephone_porteur} />
      <TexteCell href={href} valeur={row.courriel_porteur} />
      <TableCell className="text-center tabular-nums">
        <LibelleCell href={href}>{row.annee_appui}</LibelleCell>
      </TableCell>
      <TexteCell href={href} valeur={natureLibelle} />
      <TableCell className="text-right tabular-nums">
        <LibelleCell href={href}>
          {montantFormate || <span className="text-muted-foreground">–</span>}
        </LibelleCell>
      </TableCell>
      <TableCell>
        <LibelleCell href={href}>
          <StatutStructureBadge code={row.statut_creation as StatutStructure} />
        </LibelleCell>
      </TableCell>
      <TexteCell href={href} valeur={row.date_creation} />
      <TableCell className="whitespace-nowrap">
        <LibelleCell href={href}>{row.consentement_recueilli ? 'Oui' : 'Non'}</LibelleCell>
      </TableCell>
      <TexteCell href={href} valeur={row.ville} />
      <TexteCell href={href} valeur={row.localite} />
      <TexteCell href={href} valeur={row.adresse} />
      <TableCell className="text-right tabular-nums">
        <LibelleCell href={href}>
          {caFormate || <span className="text-muted-foreground">–</span>}
        </LibelleCell>
      </TableCell>
      <TexteCell href={href} valeur={row.employes_permanents} centre />
      <TexteCell href={href} valeur={row.employes_temporaires} centre />
      <TexteCell href={href} valeur={row.emplois_crees} centre />
      <TableCell>
        <StructureRowActions id={row.id} peutEditer={peutEditer} peutSupprimer={peutSupprimer} />
      </TableCell>
    </TableRow>
  );
}

/** Cellule générique pour un champ texte/numérique nullable, cliquable. */
function TexteCell({
  href,
  valeur,
  centre,
}: {
  href: string;
  valeur: string | number | null;
  centre?: boolean;
}) {
  const vide = valeur === null || valeur === undefined || valeur === '';
  const texte = vide ? '–' : String(valeur);
  return (
    <TableCell
      className={cn(
        'whitespace-nowrap',
        centre ? 'text-center tabular-nums' : undefined,
        typeof valeur === 'number' ? 'tabular-nums' : undefined,
      )}
    >
      <LibelleCell href={href} className="max-w-[16rem] truncate" title={vide ? undefined : texte}>
        {vide ? <span className="text-muted-foreground">–</span> : texte}
      </LibelleCell>
    </TableCell>
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
