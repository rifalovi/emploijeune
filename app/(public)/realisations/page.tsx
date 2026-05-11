import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { HeaderPublic } from '@/components/landing/header-public';
import { getAuthUser } from '@/lib/supabase/auth';
import { PILIERS, indicateursParPilier, type CodePilier } from '@/lib/referentiels/indicateurs';

export const metadata: Metadata = {
  title: 'Réalisations — Plateforme OIF Emploi Jeunes',
  description:
    'Résultats des projets OIF en matière d\u2019emploi des jeunes francophones — indicateurs A, B, C, D et marqueur F.',
};

export default async function RealisationsPage() {
  const user = await getAuthUser();
  const isAuthenticated = Boolean(user);
  const piliers = Object.values(PILIERS) as (typeof PILIERS)[CodePilier][];

  return (
    <div className="bg-background min-h-screen">
      <HeaderPublic isAuthenticated={isAuthenticated} />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-8 md:py-16">

        <header className="space-y-2">
          <Badge variant="outline" className="text-xs" style={{ color: '#F5A623', borderColor: '#F5A62366' }}>
            Réalisations · Cadre Commun OIF V2
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Résultats par catégorie d&apos;indicateurs
          </h1>
          <p className="text-muted-foreground max-w-3xl text-base">
            Sélectionnez une catégorie pour explorer les indicateurs et leurs réalisations.
          </p>
        </header>

        <section className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {piliers.map((p) => {
            const indicateurs = indicateursParPilier(p.code as CodePilier);
            return (
              <Link key={p.code} href={`/realisations/${p.code.toLowerCase()}`} className="group block">
                <Card className="h-full overflow-hidden border-t-4 transition-all hover:-translate-y-1 hover:shadow-xl" style={{ borderTopColor: p.couleur }}>
                  <CardContent className="flex h-full flex-col p-6">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex size-12 items-center justify-center rounded-xl text-xl font-extrabold text-white shadow" style={{ backgroundColor: p.couleur }}>
                        {p.code}
                      </span>
                      <Badge variant="outline" className="text-[11px] tabular-nums" style={{ borderColor: `${p.couleur}55`, color: p.couleur }}>
                        {indicateurs.length} indicateur{indicateurs.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <h2 className="mt-4 text-lg font-bold" style={{ color: p.couleur }}>{p.titre}</h2>
                    <p className="text-sm font-medium text-slate-900">{p.sousTitre}</p>
                    <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">{p.description}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {indicateurs.map((i) => (
                        <span key={i.code} className="rounded border px-2 py-0.5 font-mono text-[11px] font-semibold" style={{ borderColor: `${p.couleur}44`, color: p.couleur }}>
                          {i.code}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 flex items-center gap-1 text-sm font-semibold" style={{ color: p.couleur }}>
                      Voir les réalisations
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>

        <section className="mt-14 rounded-xl bg-[#0E4F88]/5 p-6 text-sm">
          <p className="font-semibold text-[#0E4F88]">Cadre méthodologique</p>
          <p className="text-muted-foreground mt-1 leading-relaxed">
            Les indicateurs sont structurés selon le <em>Cadre Commun OIF V2</em>, validé par le SCS.
            Données réelles disponibles pour A1 et B1. Les autres sont en cours d&apos;alimentation.
          </p>
        </section>
      </main>
      <footer className="border-t bg-slate-50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-8">
          © {new Date().getFullYear()} OIF · Service de Conception et Suivi
        </div>
      </footer>
    </div>
  );
}
