'use client';

import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SignOutButtonProps = {
  variant?: 'sidebar' | 'mobile';
  className?: string;
};

/**
 * Bouton « Se déconnecter » avec AlertDialog de confirmation.
 *
 * Variantes :
 *   - sidebar : pleine largeur, icône + texte, en bas de la sidebar desktop
 *   - mobile : compact, dans le header mobile, toujours visible même quand le
 *     menu hamburger est fermé
 *
 * Accessibilité : raccourci clavier Ctrl+Shift+Q (tooltip indicatif sur desktop).
 */
export function SignOutButton({ variant = 'sidebar', className }: SignOutButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const triggerClasses =
    variant === 'sidebar'
      ? cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start', className)
      : cn(buttonVariants({ variant: 'ghost', size: 'sm' }), className);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        className={triggerClasses}
        aria-label="Se déconnecter de la plateforme OIF"
        title={variant === 'sidebar' ? 'Se déconnecter (Ctrl+Shift+Q)' : undefined}
      >
        <LogOut aria-hidden className="size-4" />
        {variant === 'sidebar' ? (
          <span>Se déconnecter</span>
        ) : (
          <span className="hidden sm:inline">Déconnexion</span>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
          <AlertDialogDescription>
            Vous allez être déconnecté de la plateforme. Pour revenir, vous devrez à nouveau cliquer
            sur un lien magique reçu par courriel (délai jusqu'à 1 heure selon votre messagerie).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <form action="/api/auth/sign-out" method="post">
            <button type="submit" className={cn(buttonVariants({ variant: 'destructive' }))}>
              Confirmer la déconnexion
            </button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
