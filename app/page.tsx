import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Users,
  Building2,
  Globe2,
  Heart,
  ArrowRight,
  History,
  GraduationCap,
  Vote,
  Leaf,
  BookOpen,
  TrendingUp,
  Target,
  Mail,
  LayoutDashboard,
  Briefcase,
  Sparkles,
  Network,
} from 'lucide-react';

import { LogoOIF } from '@/components/branding/logo-oif';
import { CarrouselHero } from '@/components/landing/carrousel-hero';
import { HeaderPublic } from '@/components/landing/header-public';
import { CadreCommunFan } from '@/components/landing/cadre-commun-fan';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import { getKpisPublics, getIndicateursVitrine } from '@/lib/landing/queries';
import type { IndicateurVitrine } from '@/lib/landing/queries';
import { getAuthUser } from '@/lib/supabase/auth';
import { cn } from '@/lib/utils';

/**
 * Page racine `/` (V1.7.0) :
 *   - vitrine publique TOUJOURS visible (anonymes ET authentifiés)
 *   - bandeau « Accéder à mon espace » + bouton header dédié pour les
 *     utilisateurs authentifiés (au lieu de « Se connecter »)
 *
 * Décision produit : les bailleurs / États qui visitent l'URL doivent voir
 * la vitrine en premier, jamais une page de login. La route `/accueil` est
 * conservée comme alias historique et redirige désormais vers `/`.
 */

export const metadata: Metadata = {
  title: 'Plateforme OIF Emploi Jeunes : Suivi-évaluation des projets de la Francophonie',
  description:
    "Plateforme officielle du Service de Conception et Suivi (SCS) de l'Organisation Internationale de la Francophonie. Suivi-évaluation des projets emploi jeunes dans 50+ pays francophones.",
  openGraph: {
    title: 'Plateforme OIF Emploi Jeunes',
    description:
      'Suivi-évaluation des projets emploi jeunes de la Francophonie : 5 000+ personnes accompagnées dans 50+ pays.',
    locale: 'fr_FR',
    type: 'website',
  },
};

/** Couleur accent dorée (V1.5.0 polish) — utilisée pour les highlights chaleureux. */
const COULEUR_ACCENT = '#F5A623';

const SLIDES = [
  {
    src: '/assets/carrousel/dclic-1.jpg',
    alt: 'Formation D-CLIC PRO en présentiel',
    credit: '© OIF : DCLIC PRO Jour 1',
  },
  {
    src: '/assets/carrousel/dclic-2.jpg',
    alt: 'Apprenants D-CLIC PRO en activité collaborative',
    credit: '© OIF : DCLIC PRO Jour 1',
  },
  { src: '/assets/carrousel/oif-1.jpg', alt: 'Évènement institutionnel OIF', credit: '© OIF' },
  { src: '/assets/carrousel/oif-2.jpg', alt: 'Évènement institutionnel OIF', credit: '© OIF' },
  { src: '/assets/carrousel/oif-3.jpg', alt: 'Évènement institutionnel OIF', credit: '© OIF' },
  { src: '/assets/carrousel/oif-4.jpg', alt: 'Évènement institutionnel OIF', credit: '© OIF' },
];

export default async function VitrinePubliquePage() {
  const [kpis, indicateursVitrine, user] = await Promise.all([
    getKpisPublics(),
    getIndicateursVitrine(),
    getAuthUser(),
  ]);
  const isAuthenticated = Boolean(user);

  return (
    <div className="bg-background min-h-screen">
      {isAuthenticated && <BandeauAuthentifie />}
      <HeaderPublic isAuthenticated={isAuthenticated} />
      <HeroAvecCarrousel kpis={kpis} isAuthenticated={isAuthenticated} />
      <Programmes />
      <KpiCompteurs kpis={kpis} indicateurs={indicateursVitrine} />
      <Methodologie />
      <CadreCommun />
      <Pourquoi />
      <Citations />
      <CtaFinal isAuthenticated={isAuthenticated} />
      <FooterPublic />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bandeau utilisateur authentifié — V1.7.0
// ─────────────────────────────────────────────────────────────────────────────
function BandeauAuthentifie() {
  return (
    <div
      className="border-b text-white"
      style={{
        background: 'linear-gradient(90deg, #0E4F88 0%, #1565a8 100%)',
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-8">
        <p className="flex items-center gap-2 text-white/90">
          <LayoutDashboard aria-hidden className="size-4 shrink-0" />
          <span>
            Vous êtes connecté à votre espace de travail. Cette page reste publique pour vos
            partenaires.
          </span>
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1 font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          Accéder à mon espace
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header — réutilise le composant partagé V2.4.0 (4 onglets : Accueil,
// Résultats, Référentiel, Contact).
// Cf. components/landing/header-public.tsx.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Hero avec carrousel
// ─────────────────────────────────────────────────────────────────────────────
function HeroAvecCarrousel({
  kpis,
  isAuthenticated,
}: {
  kpis: Awaited<ReturnType<typeof getKpisPublics>>;
  isAuthenticated: boolean;
}) {
  return (
    <CarrouselHero slides={SLIDES} hauteurClass="h-[70vh] min-h-[560px]">
      <div className="relative z-10 mx-auto max-w-5xl text-center text-white">
        <Badge
          variant="outline"
          className="mb-6 border-white/40 bg-white/10 text-white backdrop-blur-sm"
        >
          Plateforme officielle SCS : Organisation Internationale de la Francophonie
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
          Suivi-évaluation des projets
          <br />
          <span style={{ color: COULEUR_ACCENT }}>emploi jeunes</span> de la Francophonie
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg text-white/90 md:text-xl">
          Une plateforme institutionnelle dédiée au pilotage opérationnel et stratégique des
          programmes OIF d&apos;insertion économique des jeunes francophones.
        </p>
        {kpis && (
          <p className="mt-4 text-base text-white/80">
            <strong className="text-white">
              {kpis.beneficiaires_total.toLocaleString('fr-FR')}
            </strong>{' '}
            personnes accompagnées dans <strong className="text-white">{kpis.pays_total}</strong>{' '}
            pays : période {kpis.annee_couverture_min} à {kpis.annee_couverture_max}.
          </p>
        )}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: 'default', size: 'lg' }),
                'gap-2 bg-white text-[#0E4F88] shadow-lg hover:bg-blue-50',
              )}
            >
              <LayoutDashboard aria-hidden className="size-4" />
              Accéder à mon espace
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/demande-acces"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'lg' }),
                  'gap-2 bg-white text-[#0E4F88] shadow-lg hover:bg-blue-50',
                )}
              >
                Demander un accès
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                href="/connexion"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'border-white bg-white/10 text-white backdrop-blur-sm hover:bg-white/25',
                )}
              >
                Se connecter
              </Link>
            </>
          )}
        </div>
      </div>
    </CarrouselHero>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI compteurs
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Couleurs cycliques pour les cartes d'indicateurs dynamiques.
 * Reprend la palette des programmes stratégiques + accent doré.
 */
const COULEURS_COMPTEURS = [
  PROGRAMMES_STRATEGIQUES.PS1.principale,
  PROGRAMMES_STRATEGIQUES.PS3.principale,
  PROGRAMMES_STRATEGIQUES.PS2.principale,
  COULEUR_ACCENT,
];

function iconePourCode(code: string): typeof Users {
  switch (code.charAt(0)) {
    case 'A':
      return GraduationCap;
    case 'B':
      return Briefcase;
    case 'C':
      return Network;
    case 'D':
      return Target;
    case 'F':
      return Sparkles;
    default:
      return Users;
  }
}

function KpiCompteurs({
  kpis,
  indicateurs,
}: {
  kpis: Awaited<ReturnType<typeof getKpisPublics>>;
  indicateurs: IndicateurVitrine[];
}) {
  if (!kpis) return null;
  const afficherIndicateurs = indicateurs.length > 0;
  const gridCols =
    indicateurs.length >= 6
      ? 'md:grid-cols-3 lg:grid-cols-6'
      : indicateurs.length === 5
        ? 'md:grid-cols-3 lg:grid-cols-5'
        : 'md:grid-cols-4';
  return (
    <section className="border-b bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Données agrégées des projets emploi Jeunes OIF
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Période {kpis.annee_couverture_min} à {kpis.annee_couverture_max}.
          </p>
        </div>
        {afficherIndicateurs ? (
          <div className={cn('mt-12 grid grid-cols-2 gap-4', gridCols)}>
            {indicateurs.map((ind, i) => (
              <CompteurCarte
                key={ind.code}
                valeur={ind.valeur !== null ? ind.valeur.toLocaleString('fr-FR') : '—'}
                libelle={ind.labelMetrique}
                icone={iconePourCode(ind.code)}
                couleur={COULEURS_COMPTEURS[i % COULEURS_COMPTEURS.length] ?? COULEUR_ACCENT}
              />
            ))}
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
            <CompteurCarte
              valeur={kpis.beneficiaires_total.toLocaleString('fr-FR')}
              libelle="Bénéficiaires accompagnés"
              icone={Users}
              couleur={PROGRAMMES_STRATEGIQUES.PS1.principale}
            />
            <CompteurCarte
              valeur={kpis.structures_total.toLocaleString('fr-FR')}
              libelle="Structures appuyées"
              icone={Building2}
              couleur={PROGRAMMES_STRATEGIQUES.PS3.principale}
            />
            <CompteurCarte
              valeur={kpis.pays_total.toString()}
              libelle="Pays d'intervention"
              icone={Globe2}
              couleur={PROGRAMMES_STRATEGIQUES.PS2.principale}
            />
            <CompteurCarte
              valeur={`${kpis.beneficiaires_femmes_pct}\u00a0%`}
              libelle="de femmes accompagnées"
              icone={Heart}
              couleur={COULEUR_ACCENT}
            />
          </div>
        )}
        <p className="text-muted-foreground mt-8 text-center text-xs">
          Aucune donnée nominative : chiffres anonymisés conformes RGPD.
        </p>
      </div>
    </section>
  );
}

function CompteurCarte({
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
    <Card className="group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="h-1 w-full" style={{ backgroundColor: couleur }} />
      <CardContent className="p-5 text-center">
        <div
          className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${couleur}1a`, color: couleur }}
        >
          <Icone aria-hidden className="size-6" />
        </div>
        <div
          className="text-xl leading-tight font-bold break-words tabular-nums sm:text-2xl md:text-3xl"
          style={{ color: couleur }}
        >
          {valeur}
        </div>
        <p className="text-muted-foreground mt-2 text-xs leading-snug font-medium">{libelle}</p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Programmes stratégiques
// ─────────────────────────────────────────────────────────────────────────────
function Programmes() {
  const programmes = [
    {
      code: 'PS1' as const,
      titre: 'Cultures et éducation',
      description: PROGRAMMES_STRATEGIQUES.PS1.libelle,
      icone: BookOpen,
    },
    {
      code: 'PS2' as const,
      titre: 'Démocratie et gouvernance',
      description: PROGRAMMES_STRATEGIQUES.PS2.libelle,
      icone: Vote,
    },
    {
      code: 'PS3' as const,
      titre: 'Développement durable',
      description: PROGRAMMES_STRATEGIQUES.PS3.libelle,
      icone: Leaf,
    },
  ];

  return (
    <section className="bg-gradient-to-b from-white via-blue-50/30 to-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            style={{ color: COULEUR_ACCENT, borderColor: `${COULEUR_ACCENT}66` }}
          >
            Programmation 2024-2027
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Les trois programmes stratégiques de l&apos;OIF
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Trois axes complémentaires qui structurent l&apos;action de la Francophonie.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {programmes.map((p) => {
            const couleur = PROGRAMMES_STRATEGIQUES[p.code].principale;
            return (
              <Card
                key={p.code}
                className="group overflow-hidden border-t-4 transition-all hover:-translate-y-1 hover:shadow-xl"
                style={{ borderTopColor: couleur }}
              >
                <CardContent className="p-6">
                  <div
                    className="mb-4 flex size-14 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${couleur}1a`, color: couleur }}
                  >
                    <p.icone aria-hidden className="size-7" />
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-xs"
                    style={{ borderColor: couleur, color: couleur }}
                  >
                    {p.code}
                  </Badge>
                  <h3 className="mt-3 text-xl font-semibold text-gray-900">{p.titre}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {p.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Méthodologie OIF (V1.5.0 — extraits de la note méthodologique V2)
// ─────────────────────────────────────────────────────────────────────────────
function Methodologie() {
  // Source : Cadre de mesure du rendement emploi V2, section 4 "Principes directeurs".
  const principes = [
    {
      titre: 'Cohérence',
      description:
        "Les indicateurs sont interprétés de manière homogène d'un projet à l'autre afin de permettre des comparaisons, des agrégations et des analyses transversales.",
      icone: Target,
    },
    {
      titre: 'Souplesse encadrée',
      description:
        "Le cadre commun fixe une structure partagée, mais laisse à chaque projet la possibilité de mobiliser les indicateurs les plus pertinents au regard de sa logique d'intervention, sans application uniforme ni mécanique.",
      icone: Leaf,
    },
    {
      titre: 'Traçabilité',
      description:
        'Tout résultat renseigné est adossé à des données vérifiables, à des définitions explicites et à des sources identifiables.',
      icone: History,
    },
    {
      titre: 'Fiabilisation progressive',
      description:
        "Respect de règles minimales d'harmonisation et de qualité des données, ainsi qu'un phasage des restitutions : première consolidation en juin, étape approfondie à l'automne, notamment pour les indicateurs C et D.",
      icone: TrendingUp,
    },
    {
      titre: 'Responsabilité partagée',
      description:
        "La collecte mobilise l'ensemble des parties prenantes : unités chefs de file pour les bases nominatives, partenaires de mise en œuvre, gestionnaires de plateformes de formation, et SCS pour les enquêtes d'approfondissement.",
      icone: Users,
    },
  ];
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            style={{ color: COULEUR_ACCENT, borderColor: `${COULEUR_ACCENT}66` }}
          >
            Principes directeurs
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Notre méthodologie de suivi-évaluation
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Cinq principes structurants pour la mise en œuvre du Cadre Commun de mesure du
            rendement.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {principes.map((p, i) => (
            <Card
              key={p.titre}
              className="group overflow-hidden border-0 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              style={{ background: `linear-gradient(145deg, ${COULEUR_ACCENT}07 0%, white 55%)` }}
            >
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  {/* Numéro d'étape */}
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${COULEUR_ACCENT} 0%, ${COULEUR_ACCENT}bb 100%)`,
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {/* Icône */}
                  <div
                    className="flex size-9 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${COULEUR_ACCENT}15`, color: COULEUR_ACCENT }}
                  >
                    <p.icone aria-hidden className="size-5" />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{p.titre}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {p.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cadre Commun — Architecture (4 catégories + marqueur transversal F1)
// Source : Cadre de mesure du rendement emploi V2, section 5.
// Diagramme en éventail SVG — reproduit l'illustration du document CMR.
//
// Coordonnées SVG (viewBox 0 0 480 280) :
//   Centre : (240, 265) | R externe : 225 | R interne : 78
//   Secteur A 180→135° | B 135→90° | C 90→45° | D 45→0°
// ─────────────────────────────────────────────────────────────────────────────
function CadreCommun() {
  const CATEGORIE_CMR = [
    {
      code: 'A',
      couleur: '#0098A0',
      fillSvg: '#A8D8D5',
      titre: 'Formation, compétences et insertion',
      description:
        "Indicateurs relatifs au nombre de personnes formées, à l'achèvement des formations, à la certification, au gain de compétences et à l'insertion professionnelle à moyen terme.",
      icone: GraduationCap,
    },
    {
      code: 'B',
      couleur: '#5BAD4E',
      fillSvg: '#B8E0B0',
      titre: 'Activités économiques, entrepreneuriat et emploi',
      description:
        'Indicateurs relatifs aux activités économiques appuyées, à la survie des structures soutenues, aux emplois créés ou maintenus et aux emplois indirects estimés.',
      icone: Building2,
    },
    {
      code: 'C',
      couleur: '#B8A000',
      fillSvg: '#E8D87A',
      titre: 'Intermédiation et accès aux opportunités',
      description:
        "Indicateurs relatifs aux mises en relation effectives, à leur conversion en opportunités, aux emplois obtenus, au délai d'accès à l'opportunité et à l'utilité perçue de l'appui.",
      icone: Network,
    },
    {
      code: 'D',
      couleur: '#D96030',
      fillSvg: '#F5C4A0',
      titre: "Écosystèmes et conditions de l'emploi",
      description:
        "Indicateurs relatifs aux projets visant à améliorer ou renforcer l'environnement et les dispositifs de l'emploi, en créant des conditions favorables au-delà du seul niveau des bénéficiaires directs.",
      icone: Globe2,
    },
  ];

  return (
    <section className="bg-gradient-to-b from-white via-amber-50/40 to-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Architecture du Cadre Commun
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Quatre catégories d&apos;indicateurs et un marqueur transversal, partagés par tous les
            projets emploi jeunes OIF.
          </p>
        </div>

        {/* ── Diagramme en éventail ── */}
        <div className="mx-auto mt-10 max-w-xl">
          {/* Labels au-dessus du diagramme */}
          <div className="mb-1 grid grid-cols-2 gap-x-4 px-4 text-center text-[11px] font-semibold">
            <span style={{ color: '#5BAD4E' }}>Activités Économiques</span>
            <span style={{ color: '#B8A000' }}>Intermédiation</span>
          </div>

          {/* SVG fan interactif (hover tooltips) */}
          <CadreCommunFan />

          {/* Labels bas du diagramme */}
          <div className="mt-1 grid grid-cols-2 gap-x-4 px-4 text-center text-[11px] font-semibold">
            <span style={{ color: '#0098A0' }}>Formation et Compétences</span>
            <span style={{ color: '#D96030' }}>Écosystèmes d&apos;Emploi</span>
          </div>

          {/* Marqueur transversal F1 */}
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-center shadow-sm">
            <p className="text-[10px] font-bold tracking-widest text-amber-600 uppercase">
              Marqueur transversal · F1
            </p>
            <p className="mt-0.5 text-sm font-semibold text-amber-900">
              Langue française et employabilité
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Améliorer l&apos;employabilité grâce à la maîtrise du français — angle d&apos;analyse
              intégrable à tous les projets.
            </p>
          </div>
        </div>

        {/* ── Grille des 4 catégories ── */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CATEGORIE_CMR.map((cat) => (
            <Card
              key={cat.code}
              className="group overflow-hidden border-t-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              style={{ borderTopColor: cat.couleur }}
            >
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: cat.couleur }}
                  >
                    {cat.code}
                  </span>
                  <div
                    className="flex size-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${cat.couleur}18`, color: cat.couleur }}
                  >
                    <cat.icone aria-hidden className="size-3.5" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{cat.titre}</h3>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  {cat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Portée du Cadre Commun — définitions OIF emploi / employabilité / jeunesse
// Source : Cadre de mesure du rendement emploi V2, section 2.
// ─────────────────────────────────────────────────────────────────────────────
function Pourquoi() {
  const definitions = [
    {
      icone: Users,
      titre: 'Jeunesse',
      description:
        "Le cadre s'applique conformément aux définitions adoptées par l'OIF en matière de jeunesse, dans le but d'assurer un langage commun et une cohérence d'action entre l'ensemble des projets.",
    },
    {
      icone: Briefcase,
      titre: 'Emploi',
      description:
        "Toute activité exercée en contrepartie d'une rémunération ou d'un profit (monétaire ou en nature), qu'elle soit salariée ou indépendante, formelle ou informelle, incluant l'auto-emploi et l'entrepreneuriat. Les dispositifs de formation rémunérés (apprentissage, alternance, stage rémunéré) sont inclus. Les expériences non rémunérées sont reconnues comme leviers d'employabilité sans être assimilées à de l'emploi.",
    },
    {
      icone: Sparkles,
      titre: 'Employabilité',
      description:
        "La capacité d'un jeune à accéder à un emploi, à s'y maintenir et à y progresser, grâce à un socle de compétences (fondamentales, techniques, numériques et transversales), d'expériences et de ressources (information, orientation, intermédiation, réseaux, accompagnement), dans un environnement favorable levant les principaux obstacles.",
    },
  ];
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Portée du Cadre Commun
          </h2>
          <p className="text-muted-foreground mt-3 text-base leading-relaxed">
            Référence commune pour tous les projets de l&apos;OIF qui contribuent à
            l&apos;amélioration de l&apos;employabilité des jeunes, à leur accès à l&apos;emploi, à
            l&apos;auto-emploi, aux activités génératrices de revenus ou à l&apos;environnement
            favorable à leur insertion économique.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {definitions.map((d) => (
            <Card key={d.titre} className="transition-all hover:-translate-y-1 hover:shadow-md">
              <CardContent className="p-6">
                <div
                  className="mb-4 flex size-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: '#0E4F881a', color: '#0E4F88' }}
                >
                  <d.icone aria-hidden className="size-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{d.titre}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {d.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Citations institutionnelles (V1.6.0 polish)
// ─────────────────────────────────────────────────────────────────────────────
function Citations() {
  const citations = [
    {
      texte:
        'Le suivi-évaluation rigoureux de nos projets emploi jeunes est la condition de leur impact mesurable et de leur soutenabilité dans la durée.',
      auteur: 'Cadre commun de mesure du rendement',
      fonction: 'Document méthodologique OIF',
    },
    {
      texte:
        "L'apport du français à l'employabilité reste un marqueur transversal de toutes nos interventions : c'est notre signature francophone.",
      auteur: 'Note mÃ©thodologique',
      fonction: 'Service de Conception et Suivi (SCS)',
    },
    {
      texte:
        "Cibler une strate précise – un projet, un pays, une cohorte – plutôt qu'envoyer en masse : c'est ce qui distingue une collecte propre d'un envoi en masse.",
      auteur: 'Méthodologie OIF',
      fonction: 'Approche stratifiée des collectes',
    },
  ];
  return (
    <section className="bg-gradient-to-b from-white via-amber-50/30 to-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            style={{ color: COULEUR_ACCENT, borderColor: `${COULEUR_ACCENT}66` }}
          >
            Méthodologie & vision
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Ce qui guide notre démarche
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Trois principes méthodologiques qui structurent notre approche du suivi-évaluation.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {citations.map((c) => (
            <Card
              key={c.auteur}
              className="relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <CardContent className="p-6">
                <div
                  aria-hidden
                  className="absolute -top-2 -left-1 text-[120px] leading-none opacity-10 select-none"
                  style={{ color: COULEUR_ACCENT, fontFamily: 'Georgia, serif' }}
                >
                  &ldquo;
                </div>
                <p className="relative z-10 text-sm leading-relaxed text-gray-800 italic">
                  &laquo;&nbsp;{c.texte}&nbsp;&raquo;
                </p>
                <div className="relative z-10 mt-6 border-t pt-4">
                  <p className="font-semibold text-[#0E4F88]">{c.auteur}</p>
                  <p className="text-muted-foreground text-xs">{c.fonction}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA final
// ─────────────────────────────────────────────────────────────────────────────
function CtaFinal({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section
      className="relative overflow-hidden py-20 text-white md:py-24"
      style={{
        background: 'linear-gradient(135deg, #0E4F88 0%, #0198E9 100%)',
      }}
    >
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-8">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          {isAuthenticated
            ? 'Reprenez votre travail dans votre espace'
            : 'Partenaire de mise en œuvre, bailleur ou représentant institutionnel\u00a0?'}
        </h2>
        <p className="mt-4 text-lg text-blue-50 md:text-xl">
          {isAuthenticated
            ? 'Tableaux de bord, indicateurs OIF, lancement de campagnes : tout est dans votre espace de travail.'
            : 'Demandez un accès pour piloter vos projets de mise en œuvre, ou consulter les indicateurs agrégés en lecture seule.'}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: 'default', size: 'lg' }),
                'gap-2 bg-white text-[#0E4F88] shadow-xl hover:bg-blue-50',
              )}
            >
              <LayoutDashboard aria-hidden className="size-4" />
              Accéder à mon espace
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/demande-acces"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'lg' }),
                  'gap-2 bg-white text-[#0E4F88] shadow-xl hover:bg-blue-50',
                )}
              >
                Demander un accès
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                href="/connexion"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'border-white bg-white/10 text-white backdrop-blur-sm hover:bg-white/25',
                )}
              >
                Se connecter
              </Link>
            </>
          )}
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'lg' }),
              'gap-2 text-white hover:bg-white/15',
            )}
          >
            <Mail aria-hidden className="size-4" />
            Nous contacter
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────
function FooterPublic() {
  return (
    <footer className="border-t bg-gray-50 py-12 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <LogoOIF size="sm" withProtectedSpace={false} />
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              Service de Conception et Suivi (SCS) : Organisation Internationale de la Francophonie.
              Plateforme officielle de suivi-évaluation des projets emploi jeunes.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Plateforme</h3>
            <ul className="text-muted-foreground mt-4 space-y-2 text-xs">
              <li>
                <Link href="/connexion" className="hover:text-foreground">
                  Se connecter
                </Link>
              </li>
              <li>
                <Link href="/demande-acces" className="hover:text-foreground">
                  Demander un accès
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  Nous contacter
                </Link>
              </li>
              <li>
                <Link href="/documents" className="hover:text-foreground">
                  Documents publics
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Contact RGPD</h3>
            <ul className="text-muted-foreground mt-4 space-y-2 text-xs">
              <li>SCS : Service de Conception et Suivi des projets</li>
              <li>
                <a href="mailto:projets@francophonie.org" className="hover:text-foreground">
                  projets@francophonie.org
                </a>
              </li>
              <li>
                Données traitées conformément au RGPD : accès limité aux personnes habilitées.
              </li>
            </ul>
          </div>
        </div>
        <div className="text-muted-foreground mt-10 border-t pt-6 text-center text-xs">
          © {new Date().getFullYear()} OIF : Plateforme Emploi Jeunes : Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
