import {
  Home,
  Users,
  Building2,
  ClipboardList,
  Upload,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { RoleUtilisateur } from '@/lib/supabase/auth';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: RoleUtilisateur[]; // rôles autorisés à voir l'item
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Accueil',
    icon: Home,
    roles: ['admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur'],
  },
  {
    href: '/beneficiaires',
    label: 'Bénéficiaires',
    icon: Users,
    roles: ['admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur'],
  },
  {
    href: '/structures',
    label: 'Structures',
    icon: Building2,
    roles: ['admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur'],
  },
  {
    href: '/enquetes',
    label: 'Enquêtes',
    icon: ClipboardList,
    roles: ['admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur'],
  },
  {
    href: '/imports',
    label: 'Imports',
    icon: Upload,
    roles: ['admin_scs', 'editeur_projet', 'contributeur_partenaire'],
  },
  {
    href: '/admin',
    label: 'Administration',
    icon: Settings,
    roles: ['admin_scs'],
  },
];

export function visibleNavItems(role: RoleUtilisateur): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
