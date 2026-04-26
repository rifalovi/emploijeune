import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { enqueteFiltersSchema } from '@/lib/schemas/enquetes/schemas';
import { listSessionsEnquete } from '@/lib/enquetes/queries';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { buttonVariants } from '@/components/ui/button';
import { EnqueteFilters } from '@/components/enquetes/enquete-filters';
import { EnqueteTable } from '@/components/enquetes/enquete-table';
import { EnquetePagination } from '@/components/enquetes/enquete-pagination';
import { EnqueteEmptyState } from '@/components/enquetes/enquete-empty-state';
import { BoutonExporterEnquetes } from '@/components/enquetes/bouton-exporter';
import { DialogueLancerVague } from '@/components/enquetes/dialogue-lancer-vague';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Enquêtes — OIF Emploi Jeunes',
};

const DEFAULT_PAGE_SIZE = 25;
const ALLOWED_PAGE_SIZES = [10, 25, 50, 100];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EnquetesPage({ searchParams }: PageProps) {
  const utilisateur = await requireUtilisateurValide();

  const params = await searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') raw[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') raw[k] = v[0];
  }

  const filtersParse = enqueteFiltersSchema.safeParse(raw);
  const filters = filtersParse.success ? filtersParse.data : enqueteFiltersSchema.parse({});

  const pageSizeRaw = Number(raw.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = ALLOWED_PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;

  const nomenclatures = await getNomenclatures();
  const result = await listSessionsEnquete(filters, pageSize);

  const projetsOptions = Array.from(nomenclatures.projets.entries())
    .filter(([, meta]) => utilisateur.role === 'admin_scs' || meta.programme_strategique === 'PS3')
    .map(([code, meta]) => ({ code, libelle: `${code} — ${meta.libelle}` }));

  const peutCreer =
    utilisateur.role === 'admin_scs' ||
    utilisateur.role === 'editeur_projet' ||
    utilisateur.role === 'contributeur_partenaire';
  // Décision Étape 6f : export Excel des enquêtes réservé admin_scs
  // (pilotage transverse, alimente l'analyse des indicateurs publics).
  const peutExporter = utilisateur.role === 'admin_scs';

  const hasActiveFilters = Boolean(
    filters.q ||
    filters.questionnaire ||
    filters.projet_code ||
    filters.vague_enquete ||
    filters.canal_collecte ||
    filters.cible_id ||
    filters.date_debut ||
    filters.date_fin ||
    filters.mien,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Enquêtes</h1>
          <p className="text-muted-foreground text-sm">
            Indicateurs A2/A3/A4/A5 + B2/B3/B4 + F1 + C5 — {result.total.toLocaleString('fr-FR')}{' '}
            session{result.total > 1 ? 's' : ''} d’enquête dans votre périmètre
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {peutExporter && <BoutonExporterEnquetes totalDisponible={result.total} />}
          {peutCreer && <DialogueLancerVague projets={projetsOptions} />}
          {peutCreer && (
            <Link href="/enquetes/nouvelle" className={cn(buttonVariants({ variant: 'default' }))}>
              <Plus aria-hidden className="size-4" />
              Nouvelle enquête
            </Link>
          )}
        </div>
      </header>

      <EnqueteFilters projets={projetsOptions} />

      {result.rows.length === 0 ? (
        <EnqueteEmptyState
          variante={
            hasActiveFilters ? (filters.q ? 'recherche_vide' : 'aucun_resultat') : 'base_vide'
          }
          peutCreer={peutCreer}
        />
      ) : (
        <>
          <EnqueteTable rows={result.rows} />
          <EnquetePagination
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
