import Link from 'next/link';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Page 404 globale — V2.6.
 *
 * Affichée pour toute route non matchée. Next.js la sélectionne aussi
 * quand un Server Component appelle `notFound()` sans `not-found.tsx`
 * plus proche.
 */
export const metadata = {
  title: 'Page introuvable – OIF Emploi Jeunes',
};

export default function NotFound() {
  return (
    <main className="bg-background flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-slate-100 text-[#0E4F88]">
          <FileQuestion className="size-6" aria-hidden />
        </div>
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Erreur 404
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Page introuvable
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Cette page n&apos;existe pas ou a été déplacée. Utilisez le menu pour retrouver votre
          chemin.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button asChild variant="default" size="sm">
            <Link href="/dashboard">
              <Home className="mr-2 size-4" aria-hidden />
              Tableau de bord
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 size-4" aria-hidden />
              Accueil public
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
