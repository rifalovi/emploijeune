import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Users,
  Building2,
  Globe2,
  Heart,
  Briefcase,
  GraduationCap,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { HeaderPublic } from '@/components/landing/header-public';
import { getAuthUser } from '@/lib/supabase/auth';
import { getKpisPublics } from '@/lib/landing/queries';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import { PROJETS_EMBLEMATIQUES, PILIERS } from '@/lib/referentiels/indicateurs';

export const metadata: Metadata = {
  title: 'Réalisations — Plateforme OIF Emploi Jeunes',
  description:
    'Projets emblématiques, répartition géographique et chiffres-clés des résultats de l’OIF en matière d’emploi des jeunes francophones.',
};

const COULEUR_DORE = '#F5A623';

export default async function RealisationsPage() {
  const [user, kpis] = await Promise.all([getAuthUser(), getKpisPublics()]);
  const isAuthenticated = Boolean(user);

  return (
    <div className="bg-background min-h-screen">
      <HeaderPublic isAuthenticated={isAuthenticated} />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-8 md:py-16">
        {/* Approche globale + KPI */}
        <header className="space-y-2">
          <Badge
            variant="outline"
            className="text-xs"
            style={{ color: COULEUR_DORE, borderColor: `${COULEUR_DORE}66` }}
          >
            Réalisations · 2018-2025
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Une plateforme institutionnelle au service des jeunes francophones
          </h1>
          {kpis && (
            <p className="text-muted-foreground max-w-3xl text-base">
              {kpis.beneficiaires_total.toLocaleString('fr-FR')} jeunes accompagnés dans{' '}
              {kpis.pays_total} pays, sur {PROJETS_EMBLEMATIQUES.length} projets emblématiques
              suivis selon le Cadre Commun OIF V2.
            </p>
          )}
        </header>

        {/* Section KPI animés */}
        {kpis && (
          <section className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard
              valeur={kpis.beneficiaires_total.toLocaleString('fr-FR')}
              libelle="Bénéficiaires accompagnés"
              icone={Users}
              couleur={PROGRAMMES_STRATEGIQUES.PS1.principale}
            />
            <KpiCard
              valeur={kpis.structures_total.toLocaleString('fr-FR')}
              libelle="Structures appuyées"
              icone={Building2}
              couleur={PROGRAMMES_STRATEGIQUES.PS3.principale}
            />
            <KpiCard
              valeur={kpis.pays_total.toString()}
              libelle="Pays d'intervention"
              icone={Globe2}
              couleur={PROGRAMMES_STRATEGIQUES.PS2.principale}
            />
            <KpiCard
              valeur={`${kpis.beneficiaires_femmes_pct}\u00a0%`}
              libelle="de femmes accompagnées"
              icone={Heart}
              couleur={COULEUR_DORE}
            />
          </section>
        )}

        {/* Projets emblématiques */}
        <section className="mt-16">
          <header>
            <h2 className="text-2xl font-bold tracking-tight text-[#0E4F88]">
              Projets emblématiques OIF
            </h2>
            <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
              Les {PROJETS_EMBLEMATIQUES.length} projets actifs sur la thématique emploi-jeunes,
              identifiés dans le tableau de catégorisation des indicateurs du Cadre Commun OIF V2.
            </p>
          </header>

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PROJETS_EMBLEMATIQUES.map((p) => {
              const pilier = PILIERS[p.pilierPrincipal];
              return (
                <Card
                  key={p.code}
                  className="group overflow-hidden border-t-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ borderTopColor: pilier.couleur }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] font-bold"
                        style={{ borderColor: `${pilier.couleur}66`, color: pilier.couleur }}
                      >
                        {p.code}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-slate-600">
                        {p.thematique}
                      </Badge>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-900">{p.libelle}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {p.description}
                    </p>
                    <p className="mt-3 text-xs font-medium" style={{ color: pilier.couleur }}>
                      Pilier principal : {pilier.sousTitre}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Répartition géographique */}
        {kpis && kpis.top_pays.length > 0 && (
          <section className="mt-16">
            <header>
              <h2 className="text-2xl font-bold tracking-tight text-[#0E4F88]">
                Répartition géographique
              </h2>
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
                Sur {kpis.pays_total} pays d&apos;intervention. Présence francophone dans toutes les
                régions du monde.
              </p>
            </header>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Top {kpis.top_pays.length} pays par bénéficiaires accompagnés
              </h3>
              <ol className="mt-4 space-y-2.5">
                {kpis.top_pays.map((p, i) => {
                  const max = kpis.top_pays[0]?.beneficiaires ?? 1;
                  const pct = Math.round((p.beneficiaires / max) * 100);
                  return (
                    <li key={p.code} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-6 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="w-40 truncate font-medium text-slate-900">
                        {p.libelle ?? p.code}
                      </span>
                      <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-3 rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, #0198E9 0%, #0E4F88 100%)`,
                          }}
                        />
                      </div>
                      <span className="w-20 text-right font-semibold text-slate-900 tabular-nums">
                        {p.beneficiaires.toLocaleString('fr-FR')}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        )}

        {/* Citations institutionnelles */}
        <section className="mt-16">
          <header>
            <h2 className="text-2xl font-bold tracking-tight text-[#0E4F88]">
              Ce qui guide notre démarche
            </h2>
            <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
              Trois principes méthodologiques tirés directement de la Note méthodologique V2.
            </p>
          </header>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Citation
              icone={GraduationCap}
              texte="Le cadre commun ne se limite pas à un outil technique de collecte de données. Il constitue un cadre transversal permettant d'harmoniser les approches et de consolider les informations produites par plusieurs projets."
              attribution="Note méthodologique V2 — section 1"
            />
            <Citation
              icone={Briefcase}
              texte="L'OIF adopte une approche à deux cercles : une tranche institutionnelle élargie (15-35 ans) pour le plaidoyer, et un cœur opérationnel (15-29 ans) prioritaire pour les dispositifs d'insertion."
              attribution="Note méthodologique V2 — section 2"
            />
            <Citation
              icone={TrendingUp}
              texte="Les indicateurs sont structurés en 4 catégories d'agrégation et 1 marqueur transversal — pour faciliter l'agrégation des résultats produits par des projets différents mais complémentaires."
              attribution="Cadre Commun V2 — synthèse"
            />
          </div>
        </section>

        {/* CTA */}
        <section
          className="mt-20 overflow-hidden rounded-2xl bg-gradient-to-br p-8 text-center text-white md:p-12"
          style={{ background: 'linear-gradient(135deg, #0E4F88 0%, #0198E9 100%)' }}
        >
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Découvrez les indicateurs en détail
          </h2>
          <p className="mt-3 text-base text-white/90">
            18 fiches méthodologiques complètes : définition, variables, méthode de calcul, sources,
            précautions.
          </p>
          <Link
            href="/referentiels"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-[#0E4F88] shadow-lg hover:bg-blue-50"
          >
            Voir le référentiel
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      </main>

      <footer className="border-t bg-slate-50 py-8 text-sm text-slate-500">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs sm:px-8">
          © {new Date().getFullYear()} OIF · Service de Conception et Suivi · Données issues de la
          base de la plateforme.
        </div>
      </footer>
    </div>
  );
}

function KpiCard({
  valeur,
  libelle,
  icone: Icone,
  couleur,
}: {
  valeur: string;
  libelle: string;
  icone: typeof Users;
  couleur: string;
}) {
  return (
    <Card className="group transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-5 text-center">
        <div
          className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full"
          style={{ backgroundColor: `${couleur}1a`, color: couleur }}
        >
          <Icone aria-hidden className="size-6" />
        </div>
        <div className="text-2xl font-bold tabular-nums md:text-3xl" style={{ color: couleur }}>
          {valeur}
        </div>
        <p className="text-muted-foreground mt-1.5 text-xs">{libelle}</p>
      </CardContent>
    </Card>
  );
}

function Citation({
  icone: Icone,
  texte,
  attribution,
}: {
  icone: typeof Users;
  texte: string;
  attribution: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <Icone className="mb-3 size-5 text-[#F5A623]" aria-hidden />
        <p className="text-sm leading-relaxed text-slate-700 italic">«&nbsp;{texte}&nbsp;»</p>
        <p className="mt-3 border-t pt-3 text-xs font-semibold text-[#0E4F88]">{attribution}</p>
      </CardContent>
    </Card>
  );
}
