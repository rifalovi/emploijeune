import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BarChart2, GitCompare, TableProperties, TrendingUp } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';

export default async function CollecteAnalytiqueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const utilisateur = await requireUtilisateurValide();
  if (!['admin_scs', 'super_admin'].includes(utilisateur.role)) notFound();

  const sousMenu = [
    { href: '/collecte-analytique/donnees',     label: 'Données collectées',  icon: TableProperties },
    { href: '/collecte-analytique/croisement',  label: 'Croisement base',     icon: GitCompare     },
    { href: '/collecte-analytique/indicateurs', label: 'Indicateurs vivants', icon: TrendingUp     },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2 border-b pb-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex size-8 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #0E4F88 0%, #0198E9 100%)' }}
          >
            <BarChart2 className="size-4" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Analytique collecte</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Vue sur les données collectées, croisement avec la base globale et gestion des indicateurs.
        </p>
      </header>

      <nav aria-label="Sections analytique" className="flex flex-wrap gap-2 border-b pb-3">
        {sousMenu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="hover:bg-accent hover:text-foreground text-muted-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          >
            <item.icon aria-hidden className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
