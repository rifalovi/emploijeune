import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users, Heart, TrendingUp, Globe2, Briefcase, AlertCircle, Baby, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderPublic } from '@/components/landing/header-public';
import { getAuthUser } from '@/lib/supabase/auth';
import { PILIERS, INDICATEURS, indicateurParCode, type CodePilier } from '@/lib/referentiels/indicateurs';
import { getKpisPublics, getRepartitionTrancheAge } from '@/lib/landing/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ pilier: string; indicateur: string }> };

export async function generateStaticParams() {
  return INDICATEURS.map((i) => ({
    pilier: i.pilier.toLowerCase(),
    indicateur: i.code.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { indicateur } = await params;
  const ind = indicateurParCode(indicateur);
  if (!ind) return { title: 'Indicateur introuvable — OIF' };
  return { title: `${ind.code} — ${ind.intitule} · Réalisations OIF` };
}

/** Données fictives réalistes pour les indicateurs sans données live. */
const DONNEES_FICTIVES: Record<string, { total: number; femmes: number; jeunes: number; adultes: number; pays: number; projets: number }> = {
  A2: { total: 4381, femmes: 2981, jeunes: 2628, adultes: 1621, pays: 18, projets: 4 },
  A3: { total: 3654, femmes: 2485, jeunes: 2192, adultes: 1352, pays: 15, projets: 4 },
  A4: { total: 2891, femmes: 1966, jeunes: 1735, adultes: 1040, pays: 14, projets: 5 },
  A5: { total: 2103, femmes: 1430, jeunes: 1262, adultes: 757, pays: 12, projets: 4 },
  B2: { total: 198,  femmes: 112,  jeunes: 98,  adultes: 91,  pays: 9,  projets: 3 },
  B3: { total: 387,  femmes: 210,  jeunes: 178, adultes: 189, pays: 11, projets: 3 },
  B4: { total: 523,  femmes: 298,  jeunes: 251, adultes: 243, pays: 13, projets: 4 },
  C1: { total: 1240, femmes: 844,  jeunes: 744, adultes: 446, pays: 16, projets: 5 },
  C2: { total: 876,  femmes: 596,  jeunes: 526, adultes: 315, pays: 11, projets: 4 },
  C3: { total: 654,  femmes: 445,  jeunes: 392, adultes: 235, pays: 9,  projets: 3 },
  D1: { total: 42,   femmes: 24,   jeunes: 18,  adultes: 24,  pays: 8,  projets: 4 },
  D2: { total: 28,   femmes: 16,   jeunes: 11,  adultes: 17,  pays: 6,  projets: 3 },
  D3: { total: 67,   femmes: 38,   jeunes: 28,  adultes: 39,  pays: 10, projets: 5 },
  F1: { total: 3421, femmes: 2327, jeunes: 2052, adultes: 1231, pays: 15, projets: 6 },
};

export default async function IndicateurRealisationPage({ params }: Props) {
  const { pilier, indicateur } = await params;
  const ind = indicateurParCode(indicateur);
  if (!ind) notFound();

  const pilierData = PILIERS[ind.pilier as CodePilier];
  const user = await getAuthUser();

  // Récupération des données réelles selon l'indicateur
  let kpisReels = null;
  let trancheAge = null;
  let topPays: { code: string; libelle: string | null; beneficiaires: number }[] = [];
  let donneesReelles = false;

  if (ind.code === 'A1') {
    const [kpis, ta] = await Promise.all([getKpisPublics(), getRepartitionTrancheAge()]);
    kpisReels = kpis;
    trancheAge = ta;
    topPays = kpis?.top_pays?.slice(0, 6) ?? [];
    donneesReelles = true;
  } else if (ind.code === 'B1') {
    kpisReels = await getKpisPublics();
    donneesReelles = true;
  }

  // Données à afficher (réelles ou fictives)
  const fictif = !donneesReelles;
  const d = fictif
    ? DONNEES_FICTIVES[ind.code] ?? { total: 0, femmes: 0, jeunes: 0, adultes: 0, pays: 0, projets: 0 }
    : null;

  const total = donneesReelles
    ? (ind.code === 'B1' ? (kpisReels?.structures_total ?? 0) : (kpisReels?.beneficiaires_total ?? 0))
    : (d?.total ?? 0);
  const femmes = donneesReelles
    ? (kpisReels?.beneficiaires_femmes ?? 0)
    : (d?.femmes ?? 0);
  const jeunes = donneesReelles
    ? (trancheAge?.jeunes ?? 0)
    : (d?.jeunes ?? 0);
  const adultes = donneesReelles
    ? (trancheAge?.adultes ?? 0)
    : (d?.adultes ?? 0);
  const paysCount = donneesReelles
    ? (kpisReels?.pays_total ?? 0)
    : (d?.pays ?? 0);

  const femmesPct = total > 0 ? Math.round((femmes / total) * 100) : 0;
  const jeunesPct = (jeunes + adultes) > 0 ? Math.round((jeunes / (jeunes + adultes)) * 100) : 0;

  return (
    <div className="bg-background min-h-screen">
      <HeaderPublic isAuthenticated={Boolean(user)} />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-8 md:py-16">

        {/* Fil d'Ariane */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/realisations" className="hover:text-[#0E4F88] hover:underline">Réalisations</Link>
          <span>/</span>
          <Link href={`/realisations/${pilier}`} className="hover:text-[#0E4F88] hover:underline" style={{ color: pilierData.couleur }}>
            Catégorie {ind.pilier}
          </Link>
          <span>/</span>
          <span className="font-bold" style={{ color: pilierData.couleur }}>{ind.code}</span>
        </nav>

        {/* Bandeau indicateur */}
        <header className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${pilierData.couleur} 0%, ${pilierData.couleur}cc 100%)` }}>
          <Badge className="mb-3 bg-white/20 text-white border-white/30 text-xs">{ind.code}</Badge>
          <h1 className="text-2xl font-bold md:text-3xl">{ind.intitule}</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/90 leading-relaxed">{ind.definition}</p>
        </header>

        {/* Avertissement données fictives */}
        {fictif && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold">Données indicatives</span> — Les chiffres ci-dessous sont fictifs et présentés à des fins de présentation.
              Ils seront remplacés par les données réelles dès l&apos;alimentation des questionnaires de collecte.
            </p>
          </div>
        )}

        {/* Grille KPI */}
        <section className="mt-8">
          <h2 className="mb-5 text-lg font-semibold text-[#0E4F88]">Chiffres clés</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">

            {/* Total */}
            <KpiCard
              icone={ind.code === 'B1' ? Briefcase : Users}
              label={ind.code === 'B1' ? 'Structures appuyées' : 'Bénéficiaires'}
              valeur={total}
              couleur={pilierData.couleur}
              fictif={fictif}
              unite="personnes"
            />

            {/* Femmes */}
            {ind.code !== 'B1' && (
              <KpiCard
                icone={Heart}
                label="Femmes"
                valeur={femmes}
                couleur="#e91e8c"
                fictif={fictif}
                sousTitre={`${femmesPct}\u00a0% du total`}
              />
            )}

            {/* Jeunes 18-34 */}
            {ind.code !== 'B1' && (
              <KpiCard
                icone={Baby}
                label="Jeunes (18-34 ans)"
                valeur={jeunes}
                couleur="#0198E9"
                fictif={fictif}
                sousTitre={`${jeunesPct}\u00a0% des jeunes+adultes`}
              />
            )}

            {/* Adultes 35+ */}
            {ind.code !== 'B1' && (
              <KpiCard
                icone={UserCheck}
                label="Adultes (35 ans et +)"
                valeur={adultes}
                couleur="#5D0073"
                fictif={fictif}
                sousTitre={`${100 - jeunesPct}\u00a0% des jeunes+adultes`}
              />
            )}

            {/* Pays */}
            <KpiCard
              icone={Globe2}
              label="Pays couverts"
              valeur={paysCount}
              couleur="#7EB301"
              fictif={fictif}
            />

            {/* Projets */}
            <KpiCard
              icone={TrendingUp}
              label="Projets concernés"
              valeur={ind.projetsConcernes.length}
              couleur="#F5A623"
              fictif={false}
              sousTitre="selon le CMR V2"
            />
          </div>
        </section>

        {/* Top pays si disponible */}
        {topPays.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold text-[#0E4F88]">Top pays</h2>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <ol className="space-y-2.5">
                {topPays.map((p, i) => {
                  const max = topPays[0]?.beneficiaires ?? 1;
                  const pct = Math.round((p.beneficiaires / max) * 100);
                  return (
                    <li key={p.code} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      <span className="w-44 truncate font-medium text-slate-900">{p.libelle ?? p.code}</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-3 rounded-full" style={{ width: `${pct}%`, backgroundColor: pilierData.couleur }} />
                      </div>
                      <span className="w-16 text-right font-semibold tabular-nums text-slate-900">
                        {p.beneficiaires.toLocaleString('fr-FR')}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        )}

        {/* Projets concernés */}
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-[#0E4F88]">Projets concernés</h2>
          <div className="flex flex-wrap gap-2">
            {ind.projetsConcernes.map((proj) => (
              <span key={proj} className="rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold" style={{ borderColor: `${pilierData.couleur}55`, color: pilierData.couleur }}>
                {proj}
              </span>
            ))}
          </div>
        </section>

        {/* Collecte et calcul */}
        <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Méthode de collecte</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 leading-relaxed">{ind.collecte}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Formule de calcul</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 leading-relaxed">{ind.calcul}</CardContent>
          </Card>
        </section>

        {/* Retour */}
        <div className="mt-12">
          <Link href={`/realisations/${pilier}`} className="inline-flex items-center gap-2 text-sm font-medium text-[#0E4F88] hover:underline">
            <ArrowLeft className="size-4" aria-hidden />
            Retour — Catégorie {ind.pilier}
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

function KpiCard({ icone: Icone, label, valeur, couleur, fictif, sousTitre, unite }: {
  icone: typeof Users; label: string; valeur: number; couleur: string;
  fictif?: boolean; sousTitre?: string; unite?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${couleur}1a` }}>
            <Icone className="size-4" style={{ color: couleur }} aria-hidden />
          </div>
          {fictif && (
            <span className="text-[9px] font-medium text-slate-400 italic">fictif</span>
          )}
        </div>
        <div className="mt-3 text-2xl font-bold tabular-nums" style={{ color }}>
          {valeur.toLocaleString('fr-FR')}
          {unite && <span className="ml-1 text-xs font-normal text-slate-400">{unite}</span>}
        </div>
        <p className="mt-1 text-xs font-medium text-slate-700">{label}</p>
        {sousTitre && <p className="text-muted-foreground mt-0.5 text-[11px]">{sousTitre}</p>}
      </CardContent>
    </Card>
  );
}
