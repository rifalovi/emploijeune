'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { NavLink } from './nav-link';
import { SignOutButton } from './sign-out-button';
import { visibleNavItems } from './nav-items';
import type { UtilisateurProfile } from '@/lib/supabase/auth';

type MobileHeaderProps = {
  utilisateur: UtilisateurProfile;
  notificationsCount?: number;
};

export function MobileHeader({ utilisateur, notificationsCount }: MobileHeaderProps) {
  const [open, setOpen] = useState(false);
  const items = visibleNavItems(utilisateur.role);

  return (
    <header className="bg-background sticky top-0 z-30 flex h-14 items-center justify-between border-b px-3 md:hidden">
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
            aria-label="Ouvrir le menu de navigation"
          >
            <Menu aria-hidden className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 px-4 py-5">
                <div
                  aria-hidden
                  className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-md font-bold"
                >
                  OIF
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Emploi Jeunes</p>
                  <p className="text-muted-foreground text-xs">{utilisateur.nom_complet}</p>
                </div>
              </div>
              <nav
                aria-label="Menu"
                className="flex-1 space-y-1 overflow-y-auto border-t px-3 py-4"
              >
                {items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    onNavigate={() => setOpen(false)}
                    badge={
                      item.href === '/admin' && utilisateur.role === 'admin_scs'
                        ? notificationsCount
                        : undefined
                    }
                  />
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="text-sm font-semibold">
          OIF Emploi Jeunes
        </Link>
      </div>
      <SignOutButton variant="mobile" />
    </header>
  );
}
