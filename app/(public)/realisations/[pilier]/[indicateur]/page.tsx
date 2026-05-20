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
import {
  getValeursPubliees,
  getKpisContexte,
  getKpisContexteAuto,
  mergerKpisContexte,
  agregerTaux,
  agregerTotal,
  type ValeurPubliee,
} from '@/lib/realisations/queries';

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
  // C5 = Satisfaction / utilité : taux de jeunes jugeant l'appui déterminant.
  C5: 'rate',
  D1: 'count',
  D2: 'count',
  D3: 'rate',
  F1: 'count',
};

// ─── Labels métier pour indicateurs de type RATE ──────────────────────────────
// Utilisés même pour les données réelles (numérateur / dénominateur labels).
const LABELS_RATE: Record<string, { labelNumerateur: string; labelDenominateur: string }> = {
  A2: { labelNumerateur: 'Ayant achevé la formation', labelDenominateur: 'Inscrits au total' },
  A3: { labelNumerateur: 'Certifiés ou attestés', labelDenominateur: 'Personnes formées' },
  A5: { labelNumerateur: 'En emploi ou AGR à 6 mois', labelDenominateur: 'Suivis post-formation' },
  B2: {
    labelNumerateur: 'Structures actives à 12 mois',
    labelDenominateur: 'Structures appuyées',
  },
  C2: {
    labelNumerateur: 'Mises en relation réussies',
    labelDenominateur: 'Mises en relation initiées',
  },
  C5: { labelNumerateur: "Jugeant l'appui déterminant", labelDenominateur: 'Répondants au total' },
  D3: { labelNumerateur: 'Recommandations adoptées', labelDenominateur: 'Recommandations émises' },
};

// ─── Labels métier pour indicateurs de type SCORE ────────────────────────────
const LABELS_SCORE: Record<string, string> = {
  A4: '% ayant progressé significativement',
};

// ─── Types locaux ─────────────────────────────────────────────────────────────

type DonneesCount = {
  total: number;
  femmes: number;
  jeunes: number;
  adultes: number;
  pays: number;
};

type DonneesRate = {
  taux: number;
  numerateur: number;
  denominateur: number;
  labelNumerateur: string;
  labelDenominateur: string;
  femmes: number;
  pays: number;
};

type DonneesScore = {
  scoreMoyen: number;
  labelScore: string;
  participantsTotal: number;
  ayantProgresse: number;
  gainMoyen: number;
  femmes: number;
  pays: number;
};

type DonneesAmount = {
  montant: number;
  montantLibelle: string;
  sourcesPublic: number;
  sourcesPrive: number;
  pays: number;
};

// ─── Page principale ──────────────────────────────────────────────────────────

export default async function IndicateurRealisationPage({ params }: Props) {
  const { pilier, indicateur } = await params;
  const ind = indicateurParCode(indicateur);
  if (!ind) notFound();

  const pilierData = PILIERS[ind.pilier as CodePilier];
  const user = await getAuthUser();
  const typeInd: TypeIndicateur = INDICATEUR_TYPE[ind.code] ?? 'count';

  // Données réelles :
  //  - A1 / B1 → calcul automatique BDD (bénéficiaires / structures)
  //  - Autres   → saisies manuelles publiées (valeurs_indicateurs_saisies WHERE publie = TRUE)
  // KPIs contextuels chargés pour TOUS les indicateurs — ils servent de
  // complément / fallback même pour A1/B1 quand certains champs auto sont absents.
  let kpisReels = null;
  let trancheAge = null;
  let topPays: { code: string; libelle: string | null; beneficiaires: number }[] = [];
  let valeursPubliees: ValeurPubliee[] = [];

  if (ind.code === 'A1') {
    const [kpis, ta] = await Promise.all([getKpisPublics(), getRepartitionTrancheAge()]);
    kpisReels = kpis;
    trancheAge = ta;
    topPays = kpis?.top_pays?.slice(0, 6) ?? [];
  } else if (ind.code === 'B1') {
    kpisReels = await getKpisPublics();
  } else {
    valeursPubliees = await getValeursPubliees(ind.code);
  }

  // Brief 3.3 : pour les autres indicateurs du pilier A (A2-A5), on récupère
  // aussi les agrégats globaux pour pouvoir afficher la répartition par sexe
  // et tranche d'âge — qui s'applique à l'ensemble des bénéficiaires formés.
  if (ind.pilier === 'A' && ind.code !== 'A1') {
    const [kpis, ta] = await Promise.all([getKpisPublics(), getRepartitionTrancheAge()]);
    kpisReels = kpisReels ?? kpis;
    trancheAge = ta;
  }

  // KPIs contextuels — source déterminée par le flag forcer_manuel de l'admin.
  // forcer_manuel=FALSE (défaut) : auto BDD prioritaire, saisie manuelle en fallback.
  // forcer_manuel=TRUE           : saisie manuelle prioritaire, auto BDD en fallback.
  const [kpisContexte, kpisAuto] = await Promise.all([
    getKpisContexte(ind.code),
    getKpisContexteAuto(ind.code),
  ]);
  const kpisFusion = mergerKpisContexte(
    kpisAuto,
    kpisContexte,
    kpisContexte?.forcer_manuel ?? false,
  );

  // ── Calcul des métriques réelles depuis les saisies publiées ──────────────
  const dataRateReelle: DonneesRate | undefined =
    typeInd === 'rate' && valeursPubliees.length > 0
      ? (() => {
          const m = agregerTaux(valeursPubliees);
          if (!m) return undefined;
          const labels = LABELS_RATE[ind.code];
          return {
            taux: m.taux,
            numerateur: m.numerateur,
            denominateur: m.denominateur,
            labelNumerateur: labels?.labelNumerateur ?? 'Réalisés',
            labelDenominateur: labels?.labelDenominateur ?? 'Prévus',
            femmes: kpisFusion.femmes_count ?? 0,
            pays: kpisFusion.pays_count ?? 0,
          };
        })()
      : undefined;

  const dataCountReelle: DonneesCount | undefined =
    typeInd === 'count' && valeursPubliees.length > 0
      ? (() => {
          const total = agregerTotal(valeursPubliees);
          return total !== null
            ? {
                total,
                femmes: kpisFusion.femmes_count ?? 0,
                jeunes: kpisFusion.nb_jeunes ?? 0,
                adultes: kpisFusion.nb_adultes ?? 0,
                pays: kpisFusion.pays_count ?? 0,
              }
            : undefined;
        })()
      : undefined;

  const dataAmountReelle: DonneesAmount | undefined =
    typeInd === 'amount' && valeursPubliees.length > 0
      ? (() => {
          const montant = valeursPubliees.reduce((s, v) => s + (v.valeur_directe ?? 0), 0);
          if (montant === 0) return undefined;
          const montantLibelle =
            montant >= 1000
              ? `${(montant / 1000).toFixed(1).replace('.', ',')} M€`
              : `${montant.toLocaleString('fr-FR')} €`;
          return {
            montant,
            montantLibelle,
            sourcesPublic: kpisContexte?.sources_public_pct ?? 0,
            sourcesPrive: kpisContexte?.sources_prive_pct ?? 0,
            pays: kpisFusion.pays_count ?? 0,
          };
        })()
      : undefined;

  // Pour A4 (score) : score depuis la dernière saisie publiée, contexte depuis kpisContexte
  const dataScoreReelle: DonneesScore | undefined =
    typeInd === 'score' && valeursPubliees.length > 0
      ? (() => {
          const derniere = valeursPubliees[valeursPubliees.length - 1];
          const scoreMoyen = derniere?.valeur_directe ?? null;
          if (scoreMoyen === null) return undefined;
          return {
            scoreMoyen,
            labelScore: LABELS_SCORE[ind.code] ?? '% ayant progressé',
            participantsTotal: kpisContexte?.participants_count ?? 0,
            ayantProgresse: kpisContexte?.ayant_progresse ?? 0,
            gainMoyen: kpisContexte?.gain_moyen ?? 0,
            femmes: kpisFusion.femmes_count ?? 0,
            pays: kpisFusion.pays_count ?? 0,
          };
        })()
      : undefined;

  // Détermine si un type non-auto (count non-A1/B1) a des données publiées
  const isAutoBDD = ind.code === 'A1' || ind.code === 'B1';
  const aDesDonn =
    isAutoBDD ||
    dataRateReelle !== undefined ||
    dataCountReelle !== undefined ||
    dataAmountReelle !== undefined ||
    dataScoreReelle !== undefined;

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

        {/* ── KPIs selon le type d'indicateur ── */}
        <section className="mt-8">
          <h2 className="mb-5 text-lg font-semibold text-[#0E4F88]">Chiffres clés</h2>

          {/* TYPE : COUNT */}
          {typeInd === 'count' &&
            (isAutoBDD || dataCountReelle ? (
              <KpisCount
                ind={ind}
                pilierData={pilierData}
                kpisReels={kpisReels}
                trancheAge={trancheAge}
                dataCount={dataCountReelle}
                kpisFusion={kpisFusion}
              />
            ) : (
              <EmptyState />
            ))}

          {/* TYPE : RATE */}
          {typeInd === 'rate' &&
            (dataRateReelle ? (
              <KpisRate
                data={dataRateReelle}
                couleur={pilierData.couleur}
                afficherFemmes={(dataRateReelle.femmes ?? 0) > 0}
              />
            ) : (
              <EmptyState />
            ))}

          {/* TYPE : SCORE */}
          {typeInd === 'score' &&
            (dataScoreReelle ? (
              <KpisScore data={dataScoreReelle} couleur={pilierData.couleur} />
            ) : (
              <EmptyState />
            ))}

          {/* TYPE : AMOUNT */}
          {typeInd === 'amount' &&
            (dataAmountReelle ? (
              <KpisAmount data={dataAmountReelle} couleur={pilierData.couleur} />
            ) : (
              <EmptyState />
            ))}

          {/* Projets (commun à tous les types) */}
          {aDesDonn && (
            <div className="mt-4">
              <KpiCard
                icone={TrendingUp}
                label="Projets concernés"
                valeur={ind.projetsConcernes.length}
                couleur="#F5A623"
                sousTitre="selon le CMR"
              />
            </div>
          )}
        </section>

        {/* Brief 3.3 : Répartition globale (sexe + tranche d'âge) — pilier A uniquement.
            Les données sont agrégées sur l'ensemble des bénéficiaires formés. */}
        {ind.pilier === 'A' && (
          <BlocRepartition
            kpisReels={kpisReels}
            trancheAge={trancheAge}
            couleur={pilierData.couleur}
          />
        )}

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

// ─── Bloc Répartition globale — Brief 3.3 (pilier A uniquement) ────────────

function BlocRepartition({
  kpisReels,
  trancheAge,
  couleur,
}: {
  kpisReels: Awaited<ReturnType<typeof getKpisPublics>>;
  trancheAge: Awaited<ReturnType<typeof getRepartitionTrancheAge>>;
  couleur: string;
}) {
  const femmes = kpisReels?.beneficiaires_femmes ?? 0;
  const hommes = kpisReels?.beneficiaires_hommes ?? 0;
  const totalSexe = femmes + hommes;
  const femmesPct = totalSexe > 0 ? Math.round((femmes / totalSexe) * 100) : 0;
  const hommesPct = totalSexe > 0 ? 100 - femmesPct : 0;

  const jeunes = trancheAge?.jeunes ?? 0;
  const adultes = trancheAge?.adultes ?? 0;
  const totalAge = jeunes + adultes;
  const jeunesPct = totalAge > 0 ? Math.round((jeunes / totalAge) * 100) : 0;
  const adultesPct = totalAge > 0 ? 100 - jeunesPct : 0;

  if (totalSexe === 0 && totalAge === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-5 text-lg font-semibold text-[#0E4F88]">Répartition globale</h2>
      <p className="text-muted-foreground mb-4 text-xs">
        Données agrégées sur l&apos;ensemble des bénéficiaires formés — toutes années et tous
        projets confondus.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {totalSexe > 0 && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                <span>Sexe</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {totalSexe.toLocaleString('fr-FR')} bénéficiaires
                </span>
              </div>
              <BarreRepartition
                gauche={{ label: 'Femmes', valeur: femmes, pct: femmesPct, couleur: '#e91e8c' }}
                droite={{ label: 'Hommes', valeur: hommes, pct: hommesPct, couleur }}
              />
            </CardContent>
          </Card>
        )}
        {totalAge > 0 && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                <span>Tranche d&apos;âge</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {totalAge.toLocaleString('fr-FR')} bénéficiaires
                </span>
              </div>
              <BarreRepartition
                gauche={{
                  label: 'Jeunes (18-34 ans)',
                  valeur: jeunes,
                  pct: jeunesPct,
                  couleur: '#0198E9',
                }}
                droite={{
                  label: 'Adultes (35 ans et +)',
                  valeur: adultes,
                  pct: adultesPct,
                  couleur: '#5D0073',
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}

function BarreRepartition({
  gauche,
  droite,
}: {
  gauche: { label: string; valeur: number; pct: number; couleur: string };
  droite: { label: string; valeur: number; pct: number; couleur: string };
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        <div style={{ width: `${gauche.pct}%`, backgroundColor: gauche.couleur }} />
        <div style={{ width: `${droite.pct}%`, backgroundColor: droite.couleur }} />
      </div>
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: gauche.couleur }}
          />
          <span className="font-medium text-slate-700">{gauche.label}</span>
          <span className="text-muted-foreground tabular-nums">
            {gauche.valeur.toLocaleString('fr-FR')} · {gauche.pct}&nbsp;%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground tabular-nums">
            {droite.valeur.toLocaleString('fr-FR')} · {droite.pct}&nbsp;%
          </span>
          <span className="font-medium text-slate-700">{droite.label}</span>
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: droite.couleur }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── État vide — aucune donnée publiée ────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8">
      <AlertCircle className="size-5 shrink-0 text-slate-300" aria-hidden />
      <div>
        <p className="text-sm font-medium text-slate-500">Données en cours de collecte</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Les résultats seront publiés dès l&apos;alimentation des questionnaires de collecte.
        </p>
      </div>
    </div>
  );
}

// ─── Grilles KPI par type ─────────────────────────────────────────────────────

function KpisCount({
  ind,
  pilierData,
  kpisReels,
  trancheAge,
  dataCount,
  kpisFusion,
}: {
  ind: ReturnType<typeof indicateurParCode> & object;
  pilierData: (typeof PILIERS)[CodePilier];
  kpisReels: Awaited<ReturnType<typeof getKpisPublics>>;
  trancheAge: Awaited<ReturnType<typeof getRepartitionTrancheAge>>;
  dataCount: DonneesCount | undefined;
  kpisFusion: Awaited<ReturnType<typeof getKpisContexteAuto>>;
}) {
  // Configuration métier issue du référentiel — fallback rétro-compatible
  // (« Bénéficiaires » / « personnes » / ventilation visible) pour les
  // indicateurs non encore qualifiés.
  const labelPrincipal = ind.labelMetrique ?? 'Bénéficiaires';
  const uniteAffichee = ind.unitePrincipale ?? 'personnes';
  const afficherVentilateur = ind.afficherVentilateurPersonne ?? true;
  const isB1 = ind.code === 'B1';
  const isA1 = ind.code === 'A1';

  // Pour A1 / B1 : données auto BDD en priorité, kpisFusion en fallback si null.
  // Pour les autres : dataCount (calculé depuis saisies publiées).
  const total = isB1
    ? (kpisReels?.structures_total ?? 0)
    : isA1
      ? (kpisReels?.beneficiaires_total ?? 0)
      : (dataCount?.total ?? 0);
  const femmes = isA1
    ? (kpisReels?.beneficiaires_femmes ?? kpisFusion.femmes_count ?? 0)
    : (dataCount?.femmes ?? 0);
  const jeunes = isA1
    ? (trancheAge?.jeunes ?? kpisFusion.nb_jeunes ?? 0)
    : (dataCount?.jeunes ?? 0);
  const adultes = isA1
    ? (trancheAge?.adultes ?? kpisFusion.nb_adultes ?? 0)
    : (dataCount?.adultes ?? 0);
  // paysCount — règle plateforme : auto BDD > saisie manuelle > 0.
  //  - A1 réel → kpisReels.pays_total (auto) puis fusion
  //  - B1 réel → kpisFusion (auto structures puis manuel)
  //  - Autres  → dataCount.pays (déjà fusionné en amont)
  const paysCount = isA1
    ? (kpisReels?.pays_total ?? kpisFusion.pays_count ?? 0)
    : isB1
      ? (kpisFusion.pays_count ?? dataCount?.pays ?? 0)
      : (dataCount?.pays ?? 0);
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
        unite={uniteAffichee}
      />
      {afficherSexeAge && (
        <>
          <KpiCard
            icone={Heart}
            label="Femmes"
            valeur={femmes}
            couleur="#e91e8c"
            sousTitre={`${femmesPct}\u00a0% du total`}
          />
          <KpiCard
            icone={Baby}
            label="Jeunes (18-34 ans)"
            valeur={jeunes}
            couleur="#0198E9"
            sousTitre={`${jeunesPct}\u00a0% des jeunes+adultes`}
          />
          <KpiCard
            icone={UserCheck}
            label="Adultes (35 ans et +)"
            valeur={adultes}
            couleur="#5D0073"
            sousTitre={`${100 - jeunesPct}\u00a0% des jeunes+adultes`}
          />
        </>
      )}
      <KpiCard icone={Globe2} label="Pays couverts" valeur={paysCount} couleur="#7EB301" />
    </div>
  );
}

function KpisRate({
  data,
  couleur,
  afficherFemmes,
}: {
  data: DonneesRate;
  couleur: string;
  afficherFemmes?: boolean;
}) {
  const femmesPct = data.numerateur > 0 ? Math.round((data.femmes / data.numerateur) * 100) : 0;
  return (
    <div className="space-y-4">
      {/* KPI principal — le taux en grand */}
      <Card className="overflow-hidden border-2" style={{ borderColor: couleur }}>
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
            sousTitre={`${femmesPct}\u00a0% du groupe`}
          />
        )}
        <KpiCard icone={Globe2} label="Pays couverts" valeur={data.pays} couleur="#7EB301" />
      </div>
    </div>
  );
}

function KpisScore({ data, couleur }: { data: DonneesScore; couleur: string }) {
  const progressionPct =
    data.participantsTotal > 0
      ? Math.round((data.ayantProgresse / data.participantsTotal) * 100)
      : 0;
  const femmesPct =
    data.participantsTotal > 0 ? Math.round((data.femmes / data.participantsTotal) * 100) : 0;
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-2" style={{ borderColor: couleur }}>
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
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard
          icone={Heart}
          label="Femmes participantes"
          valeur={data.femmes}
          couleur="#e91e8c"
          sousTitre={`${femmesPct}\u00a0% du total`}
        />
        <KpiCard icone={Globe2} label="Pays couverts" valeur={data.pays} couleur="#7EB301" />
        <KpiCard
          icone={Target}
          label="Participants évalués"
          valeur={data.participantsTotal}
          couleur={couleur}
        />
      </div>
    </div>
  );
}

function KpisAmount({ data, couleur }: { data: DonneesAmount; couleur: string }) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-2" style={{ borderColor: couleur }}>
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
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <KpiCard icone={Globe2} label="Pays couverts" valeur={data.pays} couleur="#7EB301" />
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
  sousTitre,
  unite,
}: {
  icone: typeof Users;
  label: string;
  valeur: number;
  couleur: string;
  sousTitre?: string;
  unite?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div
            className="flex size-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${couleur}1a` }}
          >
            <Icone className="size-4" style={{ color: couleur }} aria-hidden />
          </div>
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
