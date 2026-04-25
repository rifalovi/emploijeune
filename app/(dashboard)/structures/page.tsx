import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { structureFiltersSchema } from '@/lib/schemas/structure';
import { listStructures } from '@/lib/structures/queries';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { buttonVariants } from '@/components/ui/button';
import { StructureFilters } from '@/components/structures/structure-filters';
import { StructureTable } from '@/components/structures/structure-table';
import { StructurePagination } from '@/components/structures/structure-pagination';
import { StructureEmptyState } from '@/components/structures/structure-empty-state';
import { BoutonExporterStructures } from '@/components/structures/bouton-exporter';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Structures — OIF Emploi Jeunes',
};

const DEFAULT_PAGE_SIZE = 25;
const ALLOWED_PAGE_SIZES = [10, 25, 50, 100];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StructuresPage({ searchParams }: PageProps) {
  const utilisateur = await requireUtilisateurValide();

  const params = await searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') raw[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') raw[k] = v[0];
  }

  const filtersParse = structureFiltersSchema.safeParse(raw);
  const filters = filtersParse.success ? filtersParse.data : structureFiltersSchema.parse({});

  const pageSizeRaw = Number(raw.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = ALLOWED_PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;

  // Cache nomenclatures (étendu en 5b avec types/secteurs/natures/devises)
  const nomenclatures = await getNomenclatures();

  const result = await listStructures(filters, pageSize);

  // Années sélectionnables : 2000 → année courante + 1 (alignées sur la
  // contrainte BDD `annee_appui BETWEEN 2000 AND 2100`).
  const anneeMax = new Date().getFullYear() + 1;
  const annees: number[] = [];
  for (let a = anneeMax; a >= 2000; a -= 1) annees.push(a);

  // Listes filtrées : un contributeur ne voit en filtre que les projets de
  // PS3 (emploi jeunes) sauf admin_scs qui voit tout.
  const projetsOptions = Array.from(nomenclatures.projets.entries())
    .filter(([, meta]) => utilisateur.role === 'admin_scs' || meta.programme_strategique === 'PS3')
    .map(([code, meta]) => ({ code, libelle: `${code} — ${meta.libelle}` }));

  const paysOptions = Array.from(nomenclatures.pays.entries()).map(([code, libelle]) => ({
    code,
    libelle: `${code} — ${libelle}`,
  }));

  // Droits UI (la RLS reste la vraie barrière côté serveur).
  const peutCreer =
    utilisateur.role === 'admin_scs' ||
    utilisateur.role === 'editeur_projet' ||
    utilisateur.role === 'contributeur_partenaire';
  const peutEditerTout = utilisateur.role === 'admin_scs' || utilisateur.role === 'editeur_projet';
  const peutSupprimer = utilisateur.role === 'admin_scs';
  // Décision Étape 5e : export Excel B1 réservé aux admin_scs (les autres
  // rôles utilisent l'export bénéficiaires A1 ou les tableaux de bord agrégés
  // — l'export structurel est un outil de pilotage transverse).
  const peutExporter = utilisateur.role === 'admin_scs';

  const hasActiveFilters = Boolean(
    filters.q ||
    filters.projet_code ||
    filters.ps ||
    filters.pays_code ||
    filters.type_structure_code ||
    filters.secteur_activite_code ||
    filters.nature_appui_code ||
    filters.statut_creation ||
    filters.annee_appui ||
    filters.mien,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Structures</h1>
          <p className="text-muted-foreground text-sm">
            Indicateur B1 — {result.total.toLocaleString('fr-FR')} structure
            {result.total > 1 ? 's' : ''} appuyée
            {result.total > 1 ? 's' : ''} dans votre périmètre
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {peutExporter && <BoutonExporterStructures totalDisponible={result.total} />}
          {peutCreer && (
            <Link href="/structures/nouveau" className={cn(buttonVariants({ variant: 'default' }))}>
              <Plus aria-hidden className="size-4" />
              Nouvelle structure
            </Link>
          )}
        </div>
      </header>

      <StructureFilters projets={projetsOptions} pays={paysOptions} annees={annees} />

      {result.rows.length === 0 ? (
        <StructureEmptyState
          variante={
            hasActiveFilters ? (filters.q ? 'recherche_vide' : 'aucun_resultat') : 'base_vide'
          }
          peutCreer={peutCreer}
        />
      ) : (
        <>
          <StructureTable
            rows={result.rows}
            nomenclatures={nomenclatures}
            peutEditerTout={peutEditerTout}
            peutSupprimer={peutSupprimer}
            utilisateurId={utilisateur.user_id}
          />
          <StructurePagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            totalPages={result.totalPages}
          />
        </>
      )}
    </div>
  );
}
