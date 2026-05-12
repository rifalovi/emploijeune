import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Heart,
  TrendingUp,
  Globe2,
  Briefcase,
  AlertCircle,
  Baby,
  UserCheck,
  Percent,
  BarChart3,
  Euro,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderPublic } from '@/components/landing/header-public';
import { getAuthUser } from '@/lib/supabase/auth';
import {
  PILIERS,
  INDICATEURS,
  indicateurParCode,
  type CodePilier,
} from '@/lib/referentiels/indicateurs';
import { getKpisPublics, getRepartitionTrancheAge } from '@/lib/landing/queries';
import { getAnalysePubliee } from '@/lib/analyses-indicateurs/queries';
import { BlocAnalytiqueIA } from '@/components/realisations/bloc-analytique-ia';

type Props = { params: Promise<{ pilier: string; indicateur: string }> };

export async function generateStaticParams() {
  return INDICATEURS.map((i) => ({
    pilier: i.pilier.toLowerCase(),
    indicateur: i.code.toLowerCase(),
  }));
}

/**
 * ISR : régénération automatique toutes les heures.
 * La page reste statique (rapide) mais une analyse publiée après le build
 * devient visible au prochain hit ≥ 1h après publication. Pour rendre une
 * publication visible immédiatement, server-actions.ts:publierAnalyse
 * appelle revalidatePath('/realisations').
 */
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { indicateur } = await params;
  const ind = indicateurParCode(indicateur);
  if (!ind) return { title: 'Indicateur introuvable – OIF' };
  return { title: `${ind.code} – ${ind.intitule} · Réalisations OIF` };
}

// ─── Types d'indicateurs ──────────────────────────────────────────────────────
type TypeIndicateur = 'count' | 'rate' | 'score' | 'amount';

const INDICATEUR_TYPE: Record<string, TypeIndicateur> = {
  A1: 'count',
  A2: 'rate',
  A3: 'rate',
  A4: 'score',
  A5: 'rate',
  B1: 'count',
  // B2 = Taux de survie à 12/24 mois (rate), B3 = Emplois créés ou maintenus
  // (count). Source : lib/referentiels/indicateurs.ts. Précédemment inversés.
  B2: 'rate',
  B3: 'count',
  B4: 'amount',
  C1: 'count',
  C2: 'rate',
  C3: 'count',
  // C4 = Délai d'accès à l'opportunité (rendu en jours via count + unite='jours').
  // Pas de ventilation personnes (cf. afficherVentilateurPersonne=false dans le réf).
  C4: 'count',
  D1: 'count',
  D2: 'count',
  D3: 'rate',
  F1: 'count',
};

// ─── Données fictives réalistes par type ─────────────────────────────────────

/** Indicateurs de type COUNT (effectifs). */
type DonneesCount = {
  total: number;
  femmes: number;
  jeunes: number;
  adultes: number;
  pays: number;
};
const FICTIF_COUNT: Record<string, DonneesCount> = {
  // Indicateurs qui comptent des « entités » (emplois, structures,
  // dispositifs) : ventilation femmes/jeunes/adultes mise à 0 — elle
  // serait ininterprétable sur ces objets. Le rendu masque les
  // sous-cartes via `afficherVentilateurPersonne: false` côté référentiel.
  B3: { total: 612, femmes: 0, jeunes: 0, adultes: 0, pays: 11 }, // emplois
  C1: { total: 1240, femmes: 0, jeunes: 0, adultes: 0, pays: 16 }, // mises en relation
  C3: { total: 87, femmes: 0, jeunes: 0, adultes: 0, pays: 13 }, // emplois/stages
  C4: { total: 65, femmes: 0, jeunes: 0, adultes: 0, pays: 12 }, // jours moyens d'accès
  D1: { total: 14, femmes: 0, jeunes: 0, adultes: 0, pays: 8 }, // dispositifs politiques
  // Indicateurs qui comptent des PERSONNES — ventilation femmes/jeunes/adultes
  // affichée (`afficherVentilateurPersonne: true`).
  D2: { total: 92, femmes: 51, jeunes: 22, adultes: 70, pays: 6 }, // acteurs publics formés
  F1: { total: 3421, femmes: 2327, jeunes: 2052, adultes: 1231, pays: 15 },
};

/** Indicateurs de type RATE (pourcentages). */
type DonneesRate = {
  taux: number;
  numerateur: number;
  denominateur: number;
  labelNumerateur: string;
  labelDenominateur: string;
  femmes: number; // dans le numérateur
  pays: number;
};
const FICTIF_RATE: Record<string, DonneesRate> = {
  A2: {
    taux: 87.3,
    numerateur: 3825,
    denominateur: 4381,
    labelNumerateur: 'Ayant achevé la formation',
    labelDenominateur: 'Inscrits au total',
    femmes: 2604,
    pays: 18,
  },
  A3: {
    taux: 76.4,
    numerateur: 3347,
    denominateur: 4381,
    labelNumerateur: 'Certifiés ou attestés',
    labelDenominateur: 'Jeunes formés',
    femmes: 2276,
    pays: 18,
  },
  A5: {
    taux: 68.7,
    numerateur: 2515,
    denominateur: 3661,
    labelNumerateur: 'En emploi ou AGR à 6 mois',
    labelDenominateur: 'Suivis post-formation',
    femmes: 1711,
    pays: 15,
  },
  // B2 = Taux de survie à 12/24 mois (cf. lib/referentiels/indicateurs.ts).
  // Labels alignés sur la sémantique "structures appuyées encore actives".
  B2: {
    taux: 71.2,
    numerateur: 141,
    denominateur: 198,
    labelNumerateur: 'Structures actives à 12 mois',
    labelDenominateur: 'Structures appuyées',
    femmes: 79,
    pays: 9,
  },
  C2: {
    taux: 63.8,
    numerateur: 559,
    denominateur: 876,
    labelNumerateur: 'Mises en relation réussies',
    labelDenominateur: 'Mises en relation initiées',
    femmes: 380,
    pays: 11,
  },
  D3: {
    taux: 58.3,
    numerateur: 39,
    denominateur: 67,
    labelNumerateur: 'Recommandations adoptées',
    labelDenominateur: 'Recommandations émises',
    femmes: 0,
    pays: 10,
  },
};

/** Indicateurs de type SCORE (gain / progression). */
type DonneesScore = {
  scoreMoyen: number; // % ou points
  labelScore: string;
  participantsTotal: number;
  ayantProgresse: number;
  gainMoyen: number; // points de progression moyens
  femmes: number;
  pays: number;
};
const FICTIF_SCORE: Record<string, DonneesScore> = {
  A4: {
    scoreMoyen: 78,
    labelScore: '% ayant progressé significativement',
    participantsTotal: 4381,
    ayantProgresse: 3417,
    gainMoyen: 23,
    femmes: 2325,
    pays: 18,
  },
};

/** Indicateurs de type AMOUNT (volumes financiers). */
type DonneesAmount = {
  montant: number; // en milliers €
  montantLibelle: string;
  sourcesPublic: number; // %
  sourcesPrive: number; // %
  pays: number;
};
const FICTIF_AMOUNT: Record<string, DonneesAmount> = {
  B4: {
    montant: 3820,
    montantLibelle: '3,8 M€',
    sourcesPublic: 62,
    sourcesPrive: 38,
    pays: 11,
  },
};

// ─── Page principale ──────────────────────────────────────────────────────────

export default async function IndicateurRealisationPage({ params }: Props) {
  const { pilier, indicateur } = await params;
  const ind = indicateurParCode(indicateur);
  if (!ind) notFound();

  const pilierData = PILIERS[ind.pilier as CodePilier];
  const user = await getAuthUser();
  const typeInd: TypeIndicateur = INDICATEUR_TYPE[ind.code] ?? 'count';

  // Données réelles pour A1 et B1 uniquement
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

  const fictif = !donneesReelles;

  // Analyse IA publiée (si disponible)
  const analyseIA = await getAnalysePubliee(ind.code);

  return (
    <div className="bg-background min-h-screen">
      <HeaderPublic isAuthenticated={Boolean(user)} />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-8 md:py-16">
        {/* Fil d'Ariane */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/realisations" className="hover:text-[#0E4F88] hover:underline">
            Réalisations
          </Link>
          <span>/</span>
          <Link
            href={`/realisations/${pilier}`}
            className="hover:text-[#0E4F88] hover:underline"
            style={{ color: pilierData.couleur }}
          >
            Catégorie {ind.pilier}
          </Link>
          <span>/</span>
          <span className="font-bold" style={{ color: pilierData.couleur }}>
            {ind.code}
          </span>
        </nav>

        {/* Bandeau indicateur */}
        <header
          className="rounded-2xl p-6 text-white"
          style={{
            background: `linear-gradient(135deg, ${pilierData.couleur} 0%, ${pilierData.couleur}cc 100%)`,
          }}
        >
          <Badge className="mb-3 border-white/30 bg-white/20 text-xs text-white">{ind.code}</Badge>
          <h1 className="text-2xl font-bold md:text-3xl">{ind.intitule}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/90">{ind.definition}</p>
        </header>

        {/* Avertissement données fictives */}
        {fictif && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            <p className="text-xs leading-relaxed text-slate-400">
              <span className="font-semibold">Données indicatives</span> – Les chiffres ci-dessous
              sont fictifs et présentés à des fins de présentation. Ils seront remplacés par les
              données réelles dès l&apos;alimentation des questionnaires de collecte.
            </p>
          </div>
        )}

        {/* ── KPIs selon le type d'indicateur ── */}
        <section className="mt-8">
          <h2 className="mb-5 text-lg font-semibold text-[#0E4F88]">Chiffres clés</h2>

          {/* TYPE : COUNT */}
          {typeInd === 'count' && (
            <KpisCount
              ind={ind}
              pilierData={pilierData}
              kpisReels={kpisReels}
              trancheAge={trancheAge}
              fictifCount={FICTIF_COUNT[ind.code]}
              fictif={fictif}
            />
          )}

          {/* TYPE : RATE */}
          {typeInd === 'rate' && FICTIF_RATE[ind.code] && (
            <KpisRate
              data={FICTIF_RATE[ind.code]!}
              couleur={pilierData.couleur}
              fictif={fictif}
              afficherFemmes={ind.code !== 'D3'}
            />
          )}

          {/* TYPE : SCORE */}
          {typeInd === 'score' && FICTIF_SCORE[ind.code] && (
            <KpisScore
              data={FICTIF_SCORE[ind.code]!}
              couleur={pilierData.couleur}
              fictif={fictif}
            />
          )}

          {/* TYPE : AMOUNT */}
          {typeInd === 'amount' && FICTIF_AMOUNT[ind.code] && (
            <KpisAmount
              data={FICTIF_AMOUNT[ind.code]!}
              couleur={pilierData.couleur}
              fictif={fictif}
            />
          )}

          {/* Projets (commun à tous les types) */}
          <div className="mt-4">
            <KpiCard
              icone={TrendingUp}
              label="Projets concernés"
              valeur={ind.projetsConcernes.length}
              couleur="#F5A623"
              fictif={false}
              sousTitre="selon le CMR"
            />
          </div>
        </section>

        {/* Top pays si disponible (A1) */}
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
                      <span className="text-muted-foreground w-5 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="w-44 truncate font-medium text-slate-900">
                        {p.libelle ?? p.code}
                      </span>
                      <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-3 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: pilierData.couleur }}
                        />
                      </div>
                      <span className="w-16 text-right font-semibold text-slate-900 tabular-nums">
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
              <span
                key={proj}
                className="rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold"
                style={{ borderColor: `${pilierData.couleur}55`, color: pilierData.couleur }}
              >
                {proj}
              </span>
            ))}
          </div>
        </section>

        {/* ── Bloc analytique IA ── */}
        <BlocAnalytiqueIA analyse={analyseIA} couleur={pilierData.couleur} />

        {/* Collecte et calcul */}
        <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">
                Méthode de collecte
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-slate-600">
              {ind.collecte}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">
                Formule de calcul
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-slate-600">
              {ind.calcul}
            </CardContent>
          </Card>
        </section>

        {/* Retour */}
        <div className="mt-12">
          <Link
            href={`/realisations/${pilier}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#0E4F88] hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Retour – Catégorie {ind.pilier}
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

// ─── Grilles KPI par type ─────────────────────────────────────────────────────

function KpisCount({
  ind,
  pilierData,
  kpisReels,
  trancheAge,
  fictifCount,
  fictif,
}: {
  ind: ReturnType<typeof indicateurParCode> & object;
  pilierData: (typeof PILIERS)[CodePilier];
  kpisReels: Awaited<ReturnType<typeof getKpisPublics>>;
  trancheAge: Awaited<ReturnType<typeof getRepartitionTrancheAge>>;
  fictifCount: DonneesCount | undefined;
  fictif: boolean;
}) {
  // Configuration métier issue du référentiel — fallback rétro-compatible
  // (« Bénéficiaires » / « personnes » / ventilation visible) pour les
  // indicateurs non encore qualifiés.
  const labelPrincipal = ind.labelMetrique ?? 'Bénéficiaires';
  const uniteAffichee = ind.unitePrincipale ?? 'personnes';
  const afficherVentilateur = ind.afficherVentilateurPersonne ?? true;
  const isB1 = ind.code === 'B1';

  const total = fictif
    ? (fictifCount?.total ?? 0)
    : isB1
      ? (kpisReels?.structures_total ?? 0)
      : (kpisReels?.beneficiaires_total ?? 0);
  const femmes = fictif ? (fictifCount?.femmes ?? 0) : (kpisReels?.beneficiaires_femmes ?? 0);
  const jeunes = fictif ? (fictifCount?.jeunes ?? 0) : (trancheAge?.jeunes ?? 0);
  const adultes = fictif ? (fictifCount?.adultes ?? 0) : (trancheAge?.adultes ?? 0);
  const paysCount = fictif ? (fictifCount?.pays ?? 0) : (kpisReels?.pays_total ?? 0);
  const femmesPct = total > 0 ? Math.round((femmes / total) * 100) : 0;
  const jeunesAdultes = jeunes + adultes;
  const jeunesPct = jeunesAdultes > 0 ? Math.round((jeunes / jeunesAdultes) * 100) : 0;
  const afficherSexeAge = afficherVentilateur && femmes > 0;

  // Icône principale : structure-like pour B1, par défaut Users pour les
  // autres comptages (personnes ou entités).
  const IconePrincipale = isB1 ? Briefcase : Users;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      <KpiCard
        icone={IconePrincipale}
        label={labelPrincipal}
        valeur={total}
        couleur={pilierData.couleur}
        fictif={fictif}
        unite={uniteAffichee}
      />
      {afficherSexeAge && (
        <>
          <KpiCard
            icone={Heart}
            label="Femmes"
            valeur={femmes}
            couleur="#e91e8c"
            fictif={fictif}
            sousTitre={`${femmesPct}\u00a0% du total`}
          />
          <KpiCard
            icone={Baby}
            label="Jeunes (18-34 ans)"
            valeur={jeunes}
            couleur="#0198E9"
            fictif={fictif}
            sousTitre={`${jeunesPct}\u00a0% des jeunes+adultes`}
          />
          <KpiCard
            icone={UserCheck}
            label="Adultes (35 ans et +)"
            valeur={adultes}
            couleur="#5D0073"
            fictif={fictif}
            sousTitre={`${100 - jeunesPct}\u00a0% des jeunes+adultes`}
          />
        </>
      )}
      <KpiCard
        icone={Globe2}
        label="Pays couverts"
        valeur={paysCount}
        couleur="#7EB301"
        fictif={fictif}
      />
    </div>
  );
}

function KpisRate({
  data,
  couleur,
  fictif,
  afficherFemmes,
}: {
  data: DonneesRate;
  couleur: string;
  fictif: boolean;
  afficherFemmes?: boolean;
}) {
  const femmesPct = data.numerateur > 0 ? Math.round((data.femmes / data.numerateur) * 100) : 0;
  return (
    <div className="space-y-4">
      {/* KPI principal — le taux en grand */}
      <Card className="relative overflow-hidden border-2" style={{ borderColor: couleur }}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tabular-nums" style={{ color: couleur }}>
                  {data.taux.toFixed(1).replace('.', ',')}
                </span>
                <span className="text-2xl font-bold" style={{ color: couleur }}>
                  %
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-700">Taux</p>
            </div>
            <div
              className="flex size-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${couleur}1a` }}
            >
              <Percent className="size-6" style={{ color: couleur }} aria-hidden />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-sm">
            <span className="font-semibold text-slate-800">
              {data.numerateur.toLocaleString('fr-FR')}
            </span>
            <span className="text-slate-500">{data.labelNumerateur}</span>
            <span className="text-slate-400">sur</span>
            <span className="font-semibold text-slate-800">
              {data.denominateur.toLocaleString('fr-FR')}
            </span>
            <span className="text-slate-500">{data.labelDenominateur}</span>
          </div>
          {fictif && (
            <span className="absolute top-3 right-3 text-[9px] text-slate-400 italic">fictif</span>
          )}
        </CardContent>
      </Card>
      {/* KPIs secondaires */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {afficherFemmes !== false && data.femmes > 0 && (
          <KpiCard
            icone={Heart}
            label="Femmes (dans le numérateur)"
            valeur={data.femmes}
            couleur="#e91e8c"
            fictif={fictif}
            sousTitre={`${femmesPct}\u00a0% du groupe`}
          />
        )}
        <KpiCard
          icone={Globe2}
          label="Pays couverts"
          valeur={data.pays}
          couleur="#7EB301"
          fictif={fictif}
        />
      </div>
    </div>
  );
}

function KpisScore({
  data,
  couleur,
  fictif,
}: {
  data: DonneesScore;
  couleur: string;
  fictif: boolean;
}) {
  const progressionPct =
    data.participantsTotal > 0
      ? Math.round((data.ayantProgresse / data.participantsTotal) * 100)
      : 0;
  const femmesPct =
    data.participantsTotal > 0 ? Math.round((data.femmes / data.participantsTotal) * 100) : 0;
  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden border-2" style={{ borderColor: couleur }}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tabular-nums" style={{ color: couleur }}>
                  {progressionPct}
                </span>
                <span className="text-2xl font-bold" style={{ color: couleur }}>
                  %
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-700">{data.labelScore}</p>
            </div>
            <div
              className="flex size-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${couleur}1a` }}
            >
              <BarChart3 className="size-6" style={{ color: couleur }} aria-hidden />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-sm">
            <span>Gain moyen :</span>
            <span className="font-bold" style={{ color: couleur }}>
              +{data.gainMoyen} points
            </span>
            <span className="text-slate-400">·</span>
            <span>
              {data.ayantProgresse.toLocaleString('fr-FR')} /{' '}
              {data.participantsTotal.toLocaleString('fr-FR')} participants
            </span>
          </div>
          {fictif && (
            <span className="absolute top-3 right-3 text-[9px] text-slate-400 italic">fictif</span>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard
          icone={Heart}
          label="Femmes participantes"
          valeur={data.femmes}
          couleur="#e91e8c"
          fictif={fictif}
          sousTitre={`${femmesPct}\u00a0% du total`}
        />
        <KpiCard
          icone={Globe2}
          label="Pays couverts"
          valeur={data.pays}
          couleur="#7EB301"
          fictif={fictif}
        />
        <KpiCard
          icone={Target}
          label="Participants évalués"
          valeur={data.participantsTotal}
          couleur={couleur}
          fictif={fictif}
        />
      </div>
    </div>
  );
}

function KpisAmount({
  data,
  couleur,
  fictif,
}: {
  data: DonneesAmount;
  couleur: string;
  fictif: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden border-2" style={{ borderColor: couleur }}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tabular-nums" style={{ color: couleur }}>
                  {data.montantLibelle}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                Volume de financements mobilisés
              </p>
            </div>
            <div
              className="flex size-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${couleur}1a` }}
            >
              <Euro className="size-6" style={{ color: couleur }} aria-hidden />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-4 text-sm">
            <div>
              <span className="font-bold text-slate-800">{data.sourcesPublic}%</span>
              <span className="ml-1 text-slate-500">Fonds publics</span>
            </div>
            <div>
              <span className="font-bold text-slate-800">{data.sourcesPrive}%</span>
              <span className="ml-1 text-slate-500">Secteur privé</span>
            </div>
          </div>
          {fictif && (
            <span className="absolute top-3 right-3 text-[9px] text-slate-400 italic">fictif</span>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          icone={Globe2}
          label="Pays couverts"
          valeur={data.pays}
          couleur="#7EB301"
          fictif={fictif}
        />
      </div>
    </div>
  );
}

// ─── Composant KPI générique ──────────────────────────────────────────────────

function KpiCard({
  icone: Icone,
  label,
  valeur,
  couleur,
  fictif,
  sousTitre,
  unite,
}: {
  icone: typeof Users;
  label: string;
  valeur: number;
  couleur: string;
  fictif?: boolean;
  sousTitre?: string;
  unite?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div
            className="flex size-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${couleur}1a` }}
          >
            <Icone className="size-4" style={{ color: couleur }} aria-hidden />
          </div>
          {fictif && <span className="text-[9px] font-medium text-slate-400 italic">fictif</span>}
        </div>
        <div className="mt-3 text-2xl font-bold tabular-nums" style={{ color: couleur }}>
          {valeur.toLocaleString('fr-FR')}
          {unite && <span className="ml-1 text-xs font-normal text-slate-400">{unite}</span>}
        </div>
        <p className="mt-1 text-xs font-medium text-slate-700">{label}</p>
        {sousTitre && <p className="text-muted-foreground mt-0.5 text-[11px]">{sousTitre}</p>}
      </CardContent>
    </Card>
  );
}
