// Client shell around the dashboard sidebar : ajoute un bouton de repli/dépli
// (façon Claude) et libère tout l'écran pour les modules larges. La barre est
// repliée automatiquement à l'arrivée sur l'Atelier d'analyse (SCS DataStudio),
// et l'utilisateur peut la ré-afficher à tout moment. Le choix est mémorisé.
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const STORAGE_KEY = 'scs-sidebar-collapsed';
// Routes qui replient la barre automatiquement pour exploiter tout l'écran.
const AUTO_COLLAPSE_PREFIXES = ['/atelier-analyse'];

export function SidebarShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const prevPath = useRef<string | null>(null);

  // Préférence mémorisée (per-navigateur).
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true);
    } catch {
      /* stockage indisponible : on garde la valeur par défaut */
    }
  }, []);

  // Repli automatique en arrivant sur une route « plein écran » (Atelier).
  useEffect(() => {
    const isAuto = (path: string | null) =>
      !!path && AUTO_COLLAPSE_PREFIXES.some((p) => path.startsWith(p));
    if (isAuto(pathname) && !isAuto(prevPath.current)) setCollapsed(true);
    prevPath.current = pathname ?? null;
  }, [pathname]);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className={collapsed ? 'hidden' : 'contents'}>{sidebar}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden items-center px-2 pt-3 md:flex md:px-4">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Afficher le menu latéral' : 'Réduire le menu latéral'}
            title={collapsed ? 'Afficher le menu' : 'Réduire le menu'}
            className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex size-8 items-center justify-center rounded-md transition-colors"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
