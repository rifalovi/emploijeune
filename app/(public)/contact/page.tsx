import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, ShieldCheck } from 'lucide-react';

import { LogoOIF } from '@/components/branding/logo-oif';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { FormulaireContact } from '@/components/landing/formulaire-contact';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Nous contacter : Plateforme OIF Emploi Jeunes',
  description:
    "Contactez le Service de Conception et Suivi (SCS) de l'Organisation Internationale de la Francophonie pour toute question, demande d'accès ou partenariat.",
};

export default function ContactPage() {
  return (
    <div className="bg-background min-h-screen">
      {/* Header public minimal */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link href="/accueil" className="inline-flex items-center" aria-label="Accueil">
            <LogoOIF size="sm" withProtectedSpace={false} />
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/connexion"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
            >
              Se connecter
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-8 md:py-16">
        <Link
          href="/accueil"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour à l&apos;accueil
        </Link>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Nous contacter
          </h1>
          <p className="text-muted-foreground text-base md:text-lg">
            Une question, une demande d&apos;accès, un partenariat ? L&apos;équipe SCS vous répond
            sous 48h ouvrées.
          </p>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Carte contact */}
          <aside className="space-y-4 md:col-span-1">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div>
                  <div className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-[#0E4F88]/10 text-[#0E4F88]">
                    <Mail aria-hidden className="size-5" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Email</h2>
                  <a
                    href="mailto:projets@francophonie.org"
                    className="text-sm text-[#0198E9] hover:underline"
                  >
                    projets@francophonie.org
                  </a>
                </div>
                <hr />
                <div>
                  <div className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-[#0E4F88]/10 text-[#0E4F88]">
                    <MapPin aria-hidden className="size-5" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Service</h2>
                  <p className="text-muted-foreground text-sm">
                    Service de Conception et Suivi des projets (SCS)
                    <br />
                    Organisation Internationale de la Francophonie
                  </p>
                </div>
                <hr />
                <div>
                  <div className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-[#0E4F88]/10 text-[#0E4F88]">
                    <ShieldCheck aria-hidden className="size-5" />
                  </div>
                  <h2 className="font-semibold text-gray-900">RGPD</h2>
                  <p className="text-muted-foreground text-sm">
                    Données traitées exclusivement pour le suivi-évaluation des projets OIF. Accès
                    limité aux personnes habilitées.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Formulaire */}
          <div className="md:col-span-2">
            <Card>
              <CardContent className="p-6 md:p-8">
                <FormulaireContact />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t bg-gray-50 py-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} OIF : Plateforme Emploi Jeunes
      </footer>
    </div>
  );
}
