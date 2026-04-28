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

  // V2.2.2 — Sidebar sticky avec profil utilisateur toujours visible.
  //
  // Architecture flex column en 3 zones :
  //   1. Header logo + sous-marque (shrink-0)
  //   2. Nav items (flex-1 overflow-y-auto min-h-0) — scrollable si trop d'items
  //   3. Profil utilisateur (shrink-0) — sticky en bas par construction flex
  //
  // Le `sticky top-0 h-screen` sur le <aside> détache la sidebar du flux du
  // layout : la sidebar reste ancrée au viewport quand on scrolle le contenu
  // principal, et sa hauteur est plafonnée à 100vh pour que le profil reste
  // visible quelle que soit la longueur de la liste d'items.
  return (
    <aside
      aria-label="Navigation principale"
      className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r md:flex"
    >
      {/* Header logo + sous-marque (shrink-0 pour ne pas être compressé) */}
      <div className="shrink-0 px-3 py-4">
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

      {/*
        Nav items scrollable si trop nombreux. `min-h-0` est OBLIGATOIRE pour
        que `overflow-y-auto` fonctionne dans un flex container : sans lui,
        l'enfant flex prend sa taille de contenu et déborde.
      */}
      <nav aria-label="Menu" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
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

      {/* Bloc profil utilisateur — toujours visible (shrink-0 + bg fond pour
          masquer un éventuel overflow de la nav au-dessus). */}
      <div className="bg-sidebar shrink-0 space-y-3 px-4 py-4">
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
