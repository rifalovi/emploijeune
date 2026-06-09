import type { Metadata } from 'next';
import { getContenuPageAdmin, getPagesCms } from '@/lib/contenu-pages/queries';
import { ContenuPagesClient } from './contenu-pages-client';
import { exigerAccesModule, getContenuAcces } from '@/lib/super-admin/permissions';
import { requireUtilisateurValide } from '@/lib/supabase/auth';

export const metadata: Metadata = { title: 'Contenu pages — Super Admin' };
export const dynamic = 'force-dynamic';

export default async function ContenuPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await exigerAccesModule('contenu_pages');
  const u = await requireUtilisateurValide();

  // Calcule les restrictions de sections pour admin_scs (null = accès complet)
  const acces = u.role === 'admin_scs' ? await getContenuAcces(u.id) : null;

  const allPages = await getPagesCms();

  // Filtre les pages accessibles
  const pages = acces === null
    ? allPages
    : allPages.filter((p) => p in acces);

  const { page: pageParam } = await searchParams;
  const pageActive = pageParam ?? pages[0] ?? 'accueil';

  // Vérifie que la page demandée est accessible
  const pageAccessible = acces === null || (pageActive in acces);
  const pageEffective = pageAccessible ? pageActive : (pages[0] ?? 'accueil');

  const blocs = await getContenuPageAdmin(pageEffective);

  // Sections autorisées pour la page active (null = toutes)
  const sectionsAutorisees: string[] | null =
    acces === null ? null : (acces[pageEffective] ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Contenu des pages publiques</h2>
        <p className="text-muted-foreground text-sm">
          Modifiez tous les textes, titres et blocs affichés sur les pages publiques de la
          plateforme. Les modifications sont publiées immédiatement.
        </p>
      </div>
      <ContenuPagesClient
        pages={pages}
        pageActive={pageEffective}
        blocs={blocs}
        sectionsAutorisees={sectionsAutorisees}
        accesRestreint={acces !== null}
      />
    </div>
  );
}
