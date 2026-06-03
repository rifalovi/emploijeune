import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert,
  Activity,
  Users,
  Building2,
  Package,
  BookOpen,
  Sparkles,
  LayoutGrid,
  MapPinOff,
  Wrench,
  Layers,
  History,
  Copy,
  FileText,
  KeyRound,
} from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { getPermissionsUtilisateur, type ModuleKey } from '@/lib/super-admin/permissions';

/**
 * Layout du segment /super-admin/* — V3.0.0.
 *
 * Accès :
 *   - super_admin : accès complet à tous les items
 *   - admin_scs   : accès limité aux modules explicitement délégués
 *   - autres rôles: 404
 */
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const utilisateur = await requireUtilisateurValide();

  const isSuperAdmin = utilisateur.role === 'super_admin';
  const isAdminScs   = utilisateur.role === 'admin_scs';

  if (!isSuperAdmin && !isAdminScs) notFound();

  // Pour admin_scs : récupère ses permissions et bloque si aucune
  let permissionsAdminScs = new Set<ModuleKey>();
  if (isAdminScs) {
    permissionsAdminScs = await getPermissionsUtilisateur(utilisateur.id);
    if (permissionsAdminScs.size === 0) notFound();
  }

  // Items réservés au super_admin (jamais délégables)
  const itemsSuperAdminOnly = [
    { href: '/super-admin',                          label: 'Vue d\u2019ensemble',      icon: ShieldAlert },
    { href: '/super-admin/utilisateurs',             label: 'Utilisateurs',             icon: Users },
    { href: '/super-admin/partenaires',              label: 'Partenaires',              icon: Building2 },
    { href: '/super-admin/modules',                  label: 'Modules',                  icon: Package },
    { href: '/super-admin/maintenance',              label: 'Maintenance',              icon: Wrench },
    { href: '/super-admin/permissions-delegues',     label: 'Permissions d\u00e9l\u00e9gu\u00e9es', icon: KeyRound },
  ];

  // Items délégables (filtrés selon le rôle)
  const itemsDelegables: { href: string; label: string; icon: React.ElementType; module: ModuleKey }[] = [
    { href: '/super-admin/tracking',                         label: 'Tracking & Logs',       icon: Activity,   module: 'tracking' },
    { href: '/super-admin/base-connaissance',                label: 'Base de connaissance',  icon: BookOpen,   module: 'base_connaissance' },
    { href: '/super-admin/analyses-indicateurs',             label: 'Analyses IA',           icon: Sparkles,   module: 'analyses_indicateurs' },
    { href: '/super-admin/affichage-public',                 label: 'Affichage public',      icon: LayoutGrid, module: 'affichage_public' },
    { href: '/super-admin/contenu-pages',                    label: 'Contenu pages',         icon: FileText,   module: 'contenu_pages' },
    { href: '/super-admin/nettoyage-donnees/pays-inconnus',  label: 'Pays inconnus',         icon: MapPinOff,  module: 'nettoyage_donnees' },
    { href: '/super-admin/referentiels/tranches-age',        label: "Tranches d'âge",        icon: Layers,     module: 'referentiels' },
    { href: '/super-admin/import-sessions',                  label: "Sessions d'import",     icon: History,    module: 'import_sessions' },
    { href: '/super-admin/doublons',                         label: 'Doublons',              icon: Copy,       module: 'doublons' },
  ];

  const itemsDelegablesVisibles = isSuperAdmin
    ? itemsDelegables
    : itemsDelegables.filter((i) => permissionsAdminScs.has(i.module));

  const sousMenu = isSuperAdmin
    ? [...itemsSuperAdminOnly, ...itemsDelegables]
    : itemsDelegablesVisibles;

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
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSuperAdmin ? 'Super Administration' : 'Administration avancée'}
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {isSuperAdmin
            ? 'Section super_admin. Tracking étendu, gestion avancée des utilisateurs, archivage de partenaires, contrôle des modules.'
            : 'Modules d\u2019administration avancée accessibles sur délégation.'}
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
