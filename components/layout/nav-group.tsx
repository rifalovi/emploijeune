'use client';

/**
 * NavGroup — groupe accordéon de la sidebar.
 *
 * Comportement :
 * - S'ouvre automatiquement si l'URL courante correspond à l'un de ses items.
 * - Clic sur le header toggle l'ouverture/fermeture.
 * - Animation CSS `max-height` pour un rendu fluide sans dépendance externe.
 * - Badge de notification transmis au(x) item(s) concerné(s).
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavGroupDef, NavItem } from './nav-items';

type NavGroupProps = {
  group: NavGroupDef;
  items: NavItem[];
  /** href → badge count (ex. { '/admin': 3 }) */
  badges?: Record<string, number | undefined>;
};

export function NavGroup({ group, items, badges = {} }: NavGroupProps) {
  const pathname = usePathname();
  const Icon = group.icon;

  // Un item du groupe est-il actif ?
  const hasActive = items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  // Auto-ouverture si route active dans le groupe
  const [open, setOpen] = useState(hasActive);

  // Rouvrir automatiquement si navigation externe change la route active
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <div>
      {/* ── Header du groupe ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          hasActive
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {/* Icône du groupe */}
        <Icon aria-hidden className="size-4 shrink-0" />

        {/* Label */}
        <span className="flex-1 truncate text-left">{group.label}</span>

        {/* Chevron animé */}
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
      </button>

      {/* ── Items enfants — animation max-height ─────────────────── */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          open ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-100 pl-3 pb-1">
          {items.map((item) => (
            <NavSubLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={badges[item.href]}
              siblingHrefs={items.map((i) => i.href)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sous-lien (item enfant dans un groupe) ───────────────────────────────────

type NavSubLinkProps = {
  href: string;
  label: string;
  icon: NavItem['icon'];
  badge?: number;
  siblingHrefs?: string[];
};

function NavSubLink({ href, label, icon: Icon, badge, siblingHrefs = [] }: NavSubLinkProps) {
  const pathname = usePathname();
  const exactMatch = pathname === href;
  const prefixMatch = pathname.startsWith(`${href}/`);
  const siblingMoreSpecific = siblingHrefs.some(
    (h) => h !== href && (pathname === h || pathname.startsWith(`${h}/`)),
  );
  const active = exactMatch || (prefixMatch && !siblingMoreSpecific);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span
          className={cn(
            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
            active
              ? 'bg-primary-foreground text-primary'
              : 'bg-destructive text-destructive-foreground',
          )}
          aria-label={`${badge} en attente`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
