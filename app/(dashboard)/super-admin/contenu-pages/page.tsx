import type { Metadata } from 'next';
import { getContenuPageAdmin, getPagesCms } from '@/lib/contenu-pages/queries';
import { ContenuPagesClient } from './contenu-pages-client';

export const metadata: Metadata = { title: 'Contenu pages — Super Admin' };
export const dynamic = 'force-dynamic';

export default async function ContenuPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const pages = await getPagesCms();
  const pageActive = pageParam ?? pages[0] ?? 'accueil';
  const blocs = await getContenuPageAdmin(pageActive);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Contenu des pages publiques</h2>
        <p className="text-muted-foreground text-sm">
          Modifiez tous les textes, titres et blocs affichés sur les pages publiques de la
          plateforme. Les modifications sont publiées immédiatement.
        </p>
      </div>
      <ContenuPagesClient pages={pages} pageActive={pageActive} blocs={blocs} />
    </div>
  );
}
