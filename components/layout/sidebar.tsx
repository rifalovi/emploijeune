import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { NavLink } from './nav-link';
import { SignOutButton } from './sign-out-button';
import { visibleNavItems } from './nav-items';
import type { UtilisateurProfile } from '@/lib/supabase/auth';

type SidebarProps = {
  utilisateur: UtilisateurProfile;
  organisationLibelle?: string | null;
  notificationsCount?: number;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Sidebar({ utilisateur, organisationLibelle, notificationsCount }: SidebarProps) {
  const items = visibleNavItems(utilisateur.role);

  return (
    <aside
      aria-label="Navigation principale"
      className="bg-sidebar text-sidebar-foreground hidden min-h-screen w-64 flex-col border-r md:flex"
    >
      <div className="flex items-center gap-2 px-4 py-5">
        <div
          aria-hidden
          className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-md font-bold"
        >
          OIF
        </div>
        <div className="leading-tight">
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
              item.href === '/admin' && utilisateur.role === 'admin_scs'
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
        <SignOutButton variant="sidebar" />
      </div>
    </aside>
  );
}

function roleLibelle(role: UtilisateurProfile['role']): string {
  switch (role) {
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
