import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { HeaderPublic } from '@/components/landing/header-public';
import { getAuthUser } from '@/lib/supabase/auth';
import { PILIERS, indicateursParPilier, type CodePilier } from '@/lib/referentiels/indicateurs';

type Props = { params: Promise<{ pilier: string }> };

export async function generateStaticParams() {
  return Object.keys(PILIERS).map((code) => ({ pilier: code.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pilier } = await params;
  const code = pilier.toUpperCase() as CodePilier;
  const p = PILIERS[code];
  if (!p) return { title: 'Réalisations – OIF' };
  return { title: `Catégorie ${code} – ${p.sousTitre} · Réalisations OIF` };
}

export default async function PilierPage({ params }: Props) {
  const { pilier } = await params;
  const code = pilier.toUpperCase() as CodePilier;
  const pilierData = PILIERS[code];
  if (!pilierData) notFound();

  const indicateurs = indicateursParPilier(code);
  const user = await getAuthUser();

  return (
    <div className="bg-background min-h-screen">
      <HeaderPublic isAuthenticated={Boolean(user)} />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-8 md:py-16">

        {/* Fil d'Ariane */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/realisations" className="hover:text-[#0E4F88] hover:underline">Réalisations</Link>
          <span>/</span>
          <span className="font-medium" style={{ color: pilierData.couleur }}>
            Catégorie {code}
          </span>
        </nav>

        {/* En-tête pilier */}
        <header className="flex items-start gap-5">
          <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold text-white shadow-lg" style={{ backgroundColor: pilierData.couleur }}>
            {code}
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: pilierData.couleur }}>
              {pilierData.titre}
            </h1>
            <p className="mt-1 text-lg font-medium text-slate-900">{pilierData.sousTitre}</p>
            <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
              {pilierData.description}
            </p>
          </div>
        </header>

        {/* Liste des indicateurs */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[#0E4F88]">
            {indicateurs.length} indicateur{indicateurs.length > 1 ? 's' : ''} – cliquez pour voir les réalisations
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {indicateurs.map((ind) => (
              <Link
                key={ind.code}
                href={`/realisations/${pilier}/${ind.code.toLowerCase()}`}
                className="group block"
              >
                <Card className="h-full border-l-4 transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ borderLeftColor: pilierData.couleur }}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <Badge
                        variant="outline"
                        className="font-mono text-sm font-bold"
                        style={{ borderColor: `${pilierData.couleur}66`, color: pilierData.couleur }}
                      >
                        {ind.code}
                      </Badge>
                      {ind.donneeLiveCle && (
                        <Badge className="text-[10px]" style={{ backgroundColor: `${pilierData.couleur}1a`, color: pilierData.couleur, border: 'none' }}>
                          <BarChart3 className="mr-1 size-3" aria-hidden />
                          Données réelles
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-900">{ind.intitule}</h3>
                    <p className="text-muted-foreground mt-1.5 line-clamp-3 text-sm leading-relaxed">
                      {ind.definition}
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-sm font-medium" style={{ color: pilierData.couleur }}>
                      Voir les réalisations
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Retour */}
        <div className="mt-12">
          <Link href="/realisations" className="inline-flex items-center gap-2 text-sm font-medium text-[#0E4F88] hover:underline">
            <ArrowLeft className="size-4" aria-hidden />
            Toutes les catégories
          </Link>
        </div>
      </main>
      <footer className="border-t bg-slate-50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-8">
          © {new Date().getFullYear()} OIF · Service de Conception et Suivi
        </div>
      </footer>
    </div>
  );
}
