'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ArrowRight } from 'lucide-react';
import { LogoOIF } from '@/components/branding/logo-oif';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Header public 4 onglets — V2.4.0.
 *
 * Validé par André (Chef SCS) : refonte de la vitrine en
 * Accueil / Référentiels / Réalisations / Contacts. L'item actif est
 * surligné en bleu OIF, les inactifs sont en gris avec hover.
 *
 * Le bouton de droite change selon l'état d'auth :
 *   - non authentifié → « Demander un accès » + « Se connecter »
 *   - authentifié → « Accéder à mon espace » (raccourci vers /dashboard)
 *
 * Sticky en haut avec backdrop-blur pour un effet glassmorphism quand
 * le contenu scrolle.
 */
export function HeaderPublic({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();

  const onglets: Array<{ href: string; label: string; matches: (p: string) => boolean }> = [
    {
      href: '/',
      label: 'Accueil',
      matches: (p) => p === '/',
    },
    {
      href: '/referentiels',
      label: 'Référentiels',
      matches: (p) => p.startsWith('/referentiels'),
    },
    {
      href: '/realisations',
      label: 'Réalisations',
      matches: (p) => p.startsWith('/realisations'),
    },
    {
      href: '/contact',
      label: 'Contacts',
      matches: (p) => p.startsWith('/contact'),
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href="/" className="inline-flex items-center" aria-label="Accueil OIF Emploi Jeunes">
          <LogoOIF size="sm" withProtectedSpace={false} />
        </Link>

        {/* Onglets centrés (desktop), masqués sur mobile (menu burger en V2.5) */}
        <nav aria-label="Navigation publique" className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-center gap-1">
            {onglets.map((o) => {
              const active = o.matches(pathname);
              return (
                <li key={o.href}>
                  <Link
                    href={o.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-[#0E4F88] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-[#0E4F88]',
                    )}
                  >
                    {o.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1.5')}
            >
              <LayoutDashboard aria-hidden className="size-4" />
              <span className="hidden sm:inline">Mon espace</span>
              <ArrowRight aria-hidden className="size-3.5 sm:hidden" />
            </Link>
          ) : (
            <>
              <Link
                href="/demande-acces"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'hidden md:inline-flex',
                )}
              >
                Demander un accès
              </Link>
              <Link
                href="/connexion"
                className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
              >
                Se connecter
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Onglets mobile (sous le header) */}
      <nav aria-label="Navigation publique mobile" className="border-t bg-slate-50/80 md:hidden">
        <ul className="mx-auto flex max-w-7xl items-center justify-around px-2 py-1.5">
          {onglets.map((o) => {
            const active = o.matches(pathname);
            return (
              <li key={o.href}>
                <Link
                  href={o.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    active ? 'bg-[#0E4F88] text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {o.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
