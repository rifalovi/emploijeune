import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { beneficiaireFiltersSchema } from '@/lib/schemas/beneficiaire';
import { listBeneficiaires } from '@/lib/beneficiaires/queries';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { buttonVariants } from '@/components/ui/button';
import { BeneficiaireFilters } from '@/components/beneficiaires/beneficiaire-filters';
import { BeneficiaireTable } from '@/components/beneficiaires/beneficiaire-table';
import { BeneficiairePagination } from '@/components/beneficiaires/beneficiaire-pagination';
import { BeneficiaireEmptyState } from '@/components/beneficiaires/beneficiaire-empty-state';
import { BoutonExporter } from '@/components/beneficiaires/bouton-exporter';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Bénéficiaires — OIF Emploi Jeunes',
};

const DEFAULT_PAGE_SIZE = 25;
const ALLOWED_PAGE_SIZES = [10, 25, 50, 100];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BeneficiairesPage({ searchParams }: PageProps) {
  const utilisateur = await requireUtilisateurValide();

  const params = await searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') raw[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') raw[k] = v[0];
  }

  // Validation des filtres (défaut page=1 appliqué par Zod)
  const filtersParse = beneficiaireFiltersSchema.safeParse(raw);
  const filters = filtersParse.success ? filtersParse.data : beneficiaireFiltersSchema.parse({});

  // Page size (hors du filters schema — c'est un paramètre UI plus que filtre)
  const pageSizeRaw = Number(raw.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = ALLOWED_PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;

  // Nomenclatures affichables (libellés pour dropdowns et table)
  const nomenclatures = await getNomenclatures();

  // Résultats paginés
  const result = await listBeneficiaires(filters, pageSize);

  // Années disponibles : on les calcule à partir de la nomenclature
  // projets × plage 2020..année+1. Simple, pas besoin de requête supplémentaire.
  const anneeMax = new Date().getFullYear() + 1;
  const annees: number[] = [];
  for (let a = anneeMax; a >= 2020; a -= 1) annees.push(a);

  // Listes filtrées : on n'affiche que les projets concernés par emploi jeunes
  // par défaut (règle métier seed SQL). Admin_scs voit tous les projets.
  const projetsOptions = Array.from(nomenclatures.projets.entries())
    .filter(
      ([, meta]) =>
        utilisateur.role === 'admin_scs' ||
        utilisateur.role === 'super_admin' ||
        meta.programme_strategique === 'PS3',
    )
    .map(([code, meta]) => ({ code, libelle: `${code} — ${meta.libelle}` }));

  const paysOptions = Array.from(nomenclatures.pays.entries()).map(([code, libelle]) => ({
    code,
    libelle: `${code} — ${libelle}`,
  }));

  const domainesOptions = Array.from(nomenclatures.domaines.entries()).map(([code, libelle]) => ({
    code,
    libelle,
  }));

  // Droits UI (la RLS reste la vraie barrière côté serveur)
  const peutCreer =
    utilisateur.role === 'admin_scs' ||
    utilisateur.role === 'super_admin' ||
    utilisateur.role === 'editeur_projet' ||
    utilisateur.role === 'contributeur_partenaire';
  const peutEditerTout =
    utilisateur.role === 'admin_scs' ||
    utilisateur.role === 'super_admin' ||
    utilisateur.role === 'editeur_projet';
  const peutSupprimer = utilisateur.role === 'admin_scs' || utilisateur.role === 'super_admin';

  const hasActiveFilters = Boolean(
    filters.q ||
    filters.projet_code ||
    filters.ps ||
    filters.pays_code ||
    filters.domaine_formation_code ||
    filters.annee_formation ||
    filters.statut_code ||
    filters.sexe ||
    filters.mien,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bénéficiaires</h1>
          <p className="text-muted-foreground text-sm">
            Indicateur A1 — {result.total.toLocaleString('fr-FR')} bénéficiaire
            {result.total > 1 ? 's' : ''} dans votre périmètre
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BoutonExporter totalDisponible={result.total} />
          {peutCreer && (
            <Link
              href="/beneficiaires/nouveau"
              className={cn(buttonVariants({ variant: 'default' }))}
            >
              <Plus aria-hidden className="size-4" />
              Nouveau bénéficiaire
            </Link>
          )}
        </div>
      </header>

      <BeneficiaireFilters
        projets={projetsOptions}
        pays={paysOptions}
        domaines={domainesOptions}
        annees={annees}
      />

      {result.rows.length === 0 ? (
        <BeneficiaireEmptyState
          variante={
            hasActiveFilters ? (filters.q ? 'recherche_vide' : 'aucun_resultat') : 'base_vide'
          }
          peutCreer={peutCreer}
        />
      ) : (
        <>
          <BeneficiaireTable
            rows={result.rows}
            nomenclatures={nomenclatures}
            peutEditerTout={peutEditerTout}
            peutSupprimer={peutSupprimer}
            utilisateurId={utilisateur.user_id}
          />
          <BeneficiairePagination
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
