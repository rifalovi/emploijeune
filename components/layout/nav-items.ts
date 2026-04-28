import {
  Home,
  Users,
  Building2,
  ClipboardList,
  Upload,
  Settings,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { RoleUtilisateur } from '@/lib/supabase/auth';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rôles autorisés à voir l'item dans la sidebar. */
  roles: RoleUtilisateur[];
  /** Si défini, l'item n'apparaît que si ce flag conditionnel est TRUE. */
  conditional?: 'module_ia';
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Accueil',
    icon: Home,
    roles: ['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur'],
  },
  {
    href: '/beneficiaires',
    label: 'Bénéficiaires',
    icon: Users,
    roles: ['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur'],
  },
  {
    href: '/structures',
    label: 'Structures',
    icon: Building2,
    roles: ['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur'],
  },
  {
    href: '/enquetes',
    label: 'Enquêtes',
    icon: ClipboardList,
    roles: ['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur'],
  },
  {
    href: '/imports',
    label: 'Imports',
    icon: Upload,
    roles: ['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire'],
  },
  {
    href: '/admin',
    label: 'Administration',
    icon: Settings,
    roles: ['super_admin', 'admin_scs'],
  },
  {
    href: '/super-admin',
    label: 'Super Admin',
    icon: ShieldAlert,
    roles: ['super_admin'],
  },
  {
    href: '/assistant-ia',
    label: 'Assistant IA',
    icon: Sparkles,
    roles: ['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire', 'lecteur'],
    conditional: 'module_ia',
  },
];

/**
 * Filtre les items visibles pour un rôle. Le filtre `conditional` doit être
 * appliqué côté serveur en passant `flags` (ex. `{ module_ia: true }`).
 */
export function visibleNavItems(
  role: RoleUtilisateur,
  flags: { module_ia?: boolean } = {},
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.conditional === 'module_ia' && !flags.module_ia) return false;
    return true;
  });
}
