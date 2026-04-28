// Client Component — la Sidebar passe des références de composants d'icônes
// (lucide-react) à NavLink, qui est lui-même un Client Component.
// Next.js 14 App Router n'autorise pas qu'un Server Component passe une
// fonction / un component-type à travers une frontière Server→Client. En
// marquant la Sidebar comme Client Component, la frontière est remontée au
// niveau du layout (qui ne passe plus que des données sérialisables :
// UtilisateurProfile, strings, numbers). Toute la logique serveur (fetch
// Supabase, notifications count) reste dans app/(dashboard)/layout.tsx.
'use client';

import Link from 'next/link';
import { UserCircle, Globe } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { LogoOIF } from '@/components/branding/logo-oif';
import { NavLink } from './nav-link';
import { SignOutButton } from './sign-out-button';
import { visibleNavItems } from './nav-items';
import type { UtilisateurProfile } from '@/lib/supabase/auth';

type SidebarProps = {
  utilisateur: UtilisateurProfile;
  organisationLibelle?: string | null;
  notificationsCount?: number;
  /** Module IA activé pour le rôle de l'utilisateur courant (V2.0.0). */
  moduleIaActif?: boolean;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Sidebar({
  utilisateur,
  organisationLibelle,
  notificationsCount,
  moduleIaActif = false,
}: SidebarProps) {
  const items = visibleNavItems(utilisateur.role, { module_ia: moduleIaActif });

  return (
    <aside
      aria-label="Navigation principale"
      className="bg-sidebar text-sidebar-foreground hidden min-h-screen w-64 flex-col border-r md:flex"
    >
      {/* En-tête de sidebar : logotype OIF officiel + sous-marque plateforme.
          Logo à taille minimum charte (96 px) avec espace protégé respecté. */}
      <div className="px-3 py-4">
        <LogoOIF
          variant="quadri"
          size="sm"
          withProtectedSpace
          priority
          ariaLabel="OIF — Organisation Internationale de la Francophonie"
        />
        <div className="mt-1 px-2 leading-tight">
          <p className="text-sm font-semibold">Emploi Jeunes</p>
          <p className="text-muted-foreground text-xs">Plateforme SCS</p>
        </div>
      </div>

      <Separator />

      <nav aria-label="Menu" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            badge={
              item.href === '/admin' &&
              (utilisateur.role === 'admin_scs' || utilisateur.role === 'super_admin')
                ? notificationsCount
                : undefined
            }
          />
        ))}
      </nav>

      <Separator />

      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback>{initialsFromName(utilisateur.nom_complet)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{utilisateur.nom_complet}</p>
            <p className="text-muted-foreground truncate text-xs">
              {organisationLibelle ?? roleLibelle(utilisateur.role)}
            </p>
          </div>
        </div>
        <Link
          href="/mon-compte"
          className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
        >
          <UserCircle aria-hidden className="size-4" />
          Mon compte
        </Link>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title="Voir la vitrine publique de la plateforme"
          className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
        >
          <Globe aria-hidden className="size-4" />
          Vue publique
        </Link>
        <SignOutButton variant="sidebar" />
      </div>
    </aside>
  );
}

function roleLibelle(role: UtilisateurProfile['role']): string {
  switch (role) {
    case 'super_admin':
      return 'Super Administrateur';
    case 'admin_scs':
      return 'Administrateur SCS';
    case 'editeur_projet':
      return 'Éditeur de projet';
    case 'contributeur_partenaire':
      return 'Partenaire';
    case 'lecteur':
      return 'Lecteur';
    default:
      return '';
  }
}
