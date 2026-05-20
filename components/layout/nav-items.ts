import {
  Home,
  Users,
  Building2,
  ClipboardList,
  Upload,
  Settings,
  ShieldAlert,
  Sparkles,
  BarChart3,
  BookOpen,
  Link2,
  Database,
  LineChart,
  HelpCircle,
  type LucideIcon,
} from ‘lucide-react’;
import type { RoleUtilisateur } from ‘@/lib/supabase/auth’;

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rôles autorisés à voir l’item dans la sidebar. */
  roles: RoleUtilisateur[];
  /** Si défini, l’item n’apparaît que si ce flag conditionnel est TRUE. */
  conditional?: ‘module_ia’;
};

export type NavGroupDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

// ─── Item autonome (hors groupes) ────────────────────────────────────────────

export const HOME_NAV_ITEM: NavItem = {
  href: ‘/dashboard’,
  label: ‘Accueil’,
  icon: Home,
  roles: [‘super_admin’, ‘admin_scs’, ‘editeur_projet’, ‘contributeur_partenaire’, ‘lecteur’],
};

// ─── Groupes accordéon ───────────────────────────────────────────────────────

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: ‘donnees’,
    label: ‘Gestion des données’,
    icon: Database,
    items: [
      {
        href: ‘/beneficiaires’,
        label: ‘Bénéficiaires’,
        icon: Users,
        roles: [‘super_admin’, ‘admin_scs’, ‘editeur_projet’, ‘contributeur_partenaire’, ‘lecteur’],
      },
      {
        href: ‘/structures’,
        label: ‘Structures’,
        icon: Building2,
        roles: [‘super_admin’, ‘admin_scs’, ‘editeur_projet’, ‘contributeur_partenaire’, ‘lecteur’],
      },
      {
        href: ‘/enquetes’,
        label: ‘Enquêtes’,
        icon: ClipboardList,
        roles: [‘super_admin’, ‘admin_scs’, ‘editeur_projet’, ‘contributeur_partenaire’, ‘lecteur’],
      },
      {
        href: ‘/imports’,
        label: ‘Imports’,
        icon: Upload,
        roles: [‘super_admin’, ‘admin_scs’, ‘editeur_projet’, ‘contributeur_partenaire’],
      },
      {
        href: ‘/collecte-publique’,
        label: ‘Collecte publique’,
        icon: Link2,
        roles: [‘super_admin’, ‘admin_scs’, ‘editeur_projet’, ‘contributeur_partenaire’],
      },
    ],
  },
  {
    id: ‘analyse’,
    label: ‘Analyse & Suivi’,
    icon: LineChart,
    items: [
      {
        href: ‘/indicateurs’,
        label: ‘Indicateurs’,
        icon: BarChart3,
        roles: [‘super_admin’, ‘admin_scs’, ‘editeur_projet’, ‘contributeur_partenaire’, ‘lecteur’],
      },
      {
        href: ‘/assistant-ia’,
        label: ‘Assistant IA’,
        icon: Sparkles,
        roles: [‘super_admin’, ‘admin_scs’, ‘editeur_projet’, ‘contributeur_partenaire’, ‘lecteur’],
        conditional: ‘module_ia’,
      },
    ],
  },
  {
    id: ‘administration’,
    label: ‘Administration’,
    icon: Settings,
    items: [
      {
        href: ‘/admin’,
        label: ‘Administration’,
        icon: Settings,
        roles: [‘super_admin’, ‘admin_scs’],
      },
      {
        href: ‘/super-admin’,
        label: ‘Super Admin’,
        icon: ShieldAlert,
        roles: [‘super_admin’],
      },
    ],
  },
  {
    id: ‘ressources’,
    label: ‘Ressources’,
    icon: HelpCircle,
    items: [
      {
        href: ‘/guide’,
        label: "Guide d’utilisation",
        icon: BookOpen,
        roles: [‘super_admin’, ‘admin_scs’, ‘editeur_projet’, ‘contributeur_partenaire’, ‘lecteur’],
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Filtre les items d’un groupe par rôle + flags conditionnels.
 * Retourne null si le groupe n’a aucun item visible (groupe entier masqué).
 */
export function visibleGroupItems(
  group: NavGroupDef,
  role: RoleUtilisateur,
  flags: { module_ia?: boolean } = {},
): NavItem[] {
  return group.items.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.conditional === ‘module_ia’ && !flags.module_ia) return false;
    return true;
  });
}

/**
 * Retourne les groupes visibles (avec leurs items filtrés).
 * Les groupes vides (tous leurs items masqués pour ce rôle) sont exclus.
 */
export function visibleNavGroups(
  role: RoleUtilisateur,
  flags: { module_ia?: boolean } = {},
): Array<{ group: NavGroupDef; items: NavItem[] }> {
  return NAV_GROUPS.map((group) => ({
    group,
    items: visibleGroupItems(group, role, flags),
  })).filter(({ items }) => items.length > 0);
}

/**
 * @deprecated Utiliser visibleNavGroups() à la place.
 * Conservé pour compatibilité éventuelle.
 */
export const NAV_ITEMS: NavItem[] = [
  HOME_NAV_ITEM,
  ...NAV_GROUPS.flatMap((g) => g.items),
];

export function visibleNavItems(
  role: RoleUtilisateur,
  flags: { module_ia?: boolean } = {},
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.conditional === ‘module_ia’ && !flags.module_ia) return false;
    return true;
  });
}
