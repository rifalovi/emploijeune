import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Activity, Users, Building2, Package } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';

/**
 * Layout du segment /super-admin/* — V2.0.0.
 *
 * Garde stricte : SEUL le rôle super_admin peut accéder à ces pages. Les
 * autres rôles (y compris admin_scs) reçoivent un 404 standard, exactement
 * comme si la page n'existait pas. Aucune trace UI nulle part pour les
 * autres rôles.
 *
 * Le sous-menu propose les 4 sections exclusives super_admin :
 *   - Tracking & Logs    (lecture étendue audit)
 *   - Utilisateurs       (suspension / bannissement)
 *   - Partenaires        (archivage organisations)
 *   - Modules            (activation/désactivation IA par rôle)
 */
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const utilisateur = await requireUtilisateurValide();
  if (utilisateur.role !== 'super_admin') notFound();

  const sousMenu = [
    { href: '/super-admin', label: 'Vue d’ensemble', icon: ShieldAlert, exact: true },
    { href: '/super-admin/tracking', label: 'Tracking & Logs', icon: Activity },
    { href: '/super-admin/utilisateurs', label: 'Utilisateurs', icon: Users },
    { href: '/super-admin/partenaires', label: 'Partenaires', icon: Building2 },
    { href: '/super-admin/modules', label: 'Modules', icon: Package },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2 border-b pb-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex size-8 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
          >
            <ShieldAlert className="size-4" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Super Administration</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Section exclusive super_admin. Tracking étendu, gestion avancée des utilisateurs,
          archivage de partenaires, contrôle des modules optionnels.
        </p>
      </header>

      <nav aria-label="Sections super-admin" className="flex flex-wrap gap-2 border-b pb-3">
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
