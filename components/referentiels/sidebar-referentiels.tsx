'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import { PILIERS, INDICATEURS, type CodePilier } from '@/lib/referentiels/indicateurs';
import { cn } from '@/lib/utils';

/**
 * Sidebar sticky pour la section /referentiels — V2.4.0.
 *
 * 5 piliers (A/B/C/D/F) avec leurs indicateurs en sous-niveaux.
 * Item actif surligné en couleur du pilier.
 */
export function SidebarReferentiels() {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-24">
      <nav aria-label="Référentiels — navigation" className="space-y-4 text-sm">
        <Link
          href="/referentiels"
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
            pathname === '/referentiels'
              ? 'bg-[#0E4F88] text-white'
              : 'text-slate-700 hover:bg-slate-100',
          )}
        >
          <LayoutGrid className="size-4" aria-hidden />
          Vue d&apos;ensemble
        </Link>

        {(Object.keys(PILIERS) as CodePilier[]).map((codePilier) => {
          const pilier = PILIERS[codePilier];
          const indicateurs = INDICATEURS.filter((i) => i.pilier === codePilier);
          return (
            <div key={codePilier}>
              <p
                className="mb-1 flex items-center gap-2 px-3 text-[11px] font-semibold tracking-wide uppercase"
                style={{ color: pilier.couleur }}
              >
                <span
                  className="inline-flex size-5 items-center justify-center rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: pilier.couleur }}
                >
                  {codePilier}
                </span>
                {pilier.sousTitre}
              </p>
              <ul className="space-y-0.5">
                {indicateurs.map((ind) => {
                  const href = `/referentiels/${ind.code.toLowerCase()}`;
                  const active = pathname === href;
                  return (
                    <li key={ind.code}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-start gap-2 rounded-md px-3 py-1.5 text-xs transition-colors',
                          active
                            ? 'bg-slate-100 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50',
                        )}
                        style={active ? { color: pilier.couleur } : undefined}
                      >
                        <span
                          className="font-mono text-[10px] font-bold tabular-nums"
                          style={{ color: pilier.couleur }}
                        >
                          {ind.code}
                        </span>
                        <span className="line-clamp-2 leading-snug">{ind.intitule}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
