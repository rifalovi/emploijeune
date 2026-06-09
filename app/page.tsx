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
import { getContenuPage } from '@/lib/contenu-pages/queries';
import type { ContenuMap } from '@/lib/contenu-pages/queries';
import { renderCms } from '@/lib/contenu-pages/render';
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

/** Lit un bloc de contenu avec fallback. Ignore le statut masqué → toujours une string. */
function c(contenu: ContenuMap, key: string, fallback: string): string {
  return contenu.get(key) ?? fallback;
}

/**
 * Comme c() mais retourne null si le bloc est explicitement masqué (actif=false).
 * Utiliser pour les éléments qui doivent disparaître du front quand cachés dans le CMS.
 */
function cH(contenu: ContenuMap, key: string, fallback: string): string | null {
  if (!contenu.has(key)) return fallback;      // n'existe pas → fallback
  const val = contenu.get(key);
  if (val === null || val === undefined) return null; // masqué → hide
  return val;                                         // actif → valeur
}

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
  const [kpis, indicateursVitrine, user, contenu] = await Promise.all([
    getKpisPublics(),
    getIndicateursVitrine(),
    getAuthUser(),
    getContenuPage('accueil'),
  ]);
  const isAuthenticated = Boolean(user);

  return (
    <div className="bg-background min-h-screen">
      {isAuthenticated && <BandeauAuthentifie />}
      <HeaderPublic isAuthenticated={isAuthenticated} />
      <HeroAvecCarrousel kpis={kpis} isAuthenticated={isAuthenticated} contenu={contenu} />
      <Programmes contenu={contenu} />
      <Methodologie contenu={contenu} />
      <CadreCommun contenu={contenu} />
      <Pourquoi contenu={contenu} />
      <Citations contenu={contenu} />
      <KpiCompteurs kpis={kpis} indicateurs={indicateursVitrine} contenu={contenu} />
      <CtaFinal isAuthenticated={isAuthenticated} contenu={contenu} />
      <FooterPublic contenu={contenu} />
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
  contenu,
}: {
  kpis: Awaited<ReturnType<typeof getKpisPublics>>;
  isAuthenticated: boolean;
  contenu: ContenuMap;
}) {
  const titre = c(contenu, 'hero.titre', 'Suivi-évaluation des projets emploi jeunes de la Francophonie');
  const accent = c(contenu, 'hero.accent', 'emploi jeunes');
  const sousTitre = c(contenu, 'hero.sous_titre', 'Une plateforme institutionnelle dédiée au pilotage opérationnel et stratégique des programmes OIF d\'insertion économique des jeunes francophones.');
  const ctaPrincipal = c(contenu, 'hero.cta_principal', 'Demander un accès');
  const ctaSecondaire = c(contenu, 'hero.cta_secondaire', 'Se connecter');
  const badge = c(contenu, 'hero.badge', 'Plateforme OIF · Emploi Jeunes Francophones');

  // Reconstruit le titre en repérant l'accent dans le texte
  const accentIdx = titre.toLowerCase().indexOf(accent.toLowerCase());
  const titreParts = accentIdx >= 0
    ? [titre.slice(0, accentIdx), accent, titre.slice(accentIdx + accent.length)]
    : [titre, '', ''];

  return (
    <CarrouselHero slides={SLIDES} hauteurClass="h-[70vh] min-h-[560px]">
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 text-center text-white">
        <Badge
          variant="outline"
          className="mb-6 max-w-xs whitespace-normal border-white/40 bg-white/10 text-center text-white backdrop-blur-sm sm:max-w-none sm:whitespace-nowrap"
        >
          {badge}
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
          {titreParts[0]}
          {titreParts[1] && <span style={{ color: COULEUR_ACCENT }}>{titreParts[1]}</span>}
          {titreParts[2]}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-white/90 sm:text-lg md:text-xl">
          {sousTitre}
        </p>
        {kpis && (
          <p className="mt-4 text-sm text-white/80 sm:text-base">
            <strong className="text-white">
              {kpis.beneficiaires_total.toLocaleString('fr-FR')}
            </strong>{' '}
            personnes accompagnées dans <strong className="text-white">{kpis.pays_total}</strong>{' '}
            pays · période {kpis.annee_couverture_min}–{kpis.annee_couverture_max}.
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
                {ctaPrincipal}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                href="/connexion"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'border-white bg-white/10 text-white backdrop-blur-sm hover:bg-white/25',
                )}
              >
                {ctaSecondaire}
              </Link>
            </>
          )}
        </div>
      </div>
    </CarrouselHero>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI compteurs — Design institutionnel stat-bar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Couleurs cycliques pour les statistiques (palette OIF).
 */
const COULEURS_COMPTEURS = [
  PROGRAMMES_STRATEGIQUES.PS1.principale,
  PROGRAMMES_STRATEGIQUES.PS3.principale,
  PROGRAMMES_STRATEGIQUES.PS2.principale,
  COULEUR_ACCENT,
];

/**
 * Icône associée à la catégorie d'indicateur (lettre du code CMR).
 */
function iconePourCode(code: string): typeof Users {
  switch (code.charAt(0)) {
    case 'A': return GraduationCap;
    case 'B': return Briefcase;
    case 'C': return Network;
    case 'D': return Target;
    case 'F': return Sparkles;
    default:  return Users;
  }
}

/**
 * Formate un nombre vers une forme compacte pour éviter les retours à la ligne
 * dans une grille étroite à 6 colonnes.
 *
 *   16 179 538  →  { principal: "16,2", suffixe: "M" }
 *    5 531      →  { principal: "5 531", suffixe: "" }
 *
 * Concept : le séparateur de milliers français est un espace insécable
 * (\u00a0 ou \u202f). On les retire pour parser proprement, puis on
 * réapplique une notation abrégée uniquement si ≥ 1 000 000.
 */
function formatCompact(valeur: string): { principal: string; suffixe: string } {
  if (valeur === '—') return { principal: '—', suffixe: '' };
  const n = parseFloat(valeur.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  if (isNaN(n)) return { principal: valeur, suffixe: '' };
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const fmt = m % 1 < 0.05
      ? m.toFixed(0)
      : m.toFixed(1).replace('.', ',');
    return { principal: fmt, suffixe: '\u202fM' };
  }
  return { principal: valeur, suffixe: '' };
}

function KpiCompteurs({
  kpis,
  indicateurs,
  contenu,
}: {
  kpis: Awaited<ReturnType<typeof getKpisPublics>>;
  indicateurs: IndicateurVitrine[];
  contenu: ContenuMap;
}) {
  if (!kpis) return null;
  const afficherIndicateurs = indicateurs.length > 0;

  /* Grille de repli si aucun indicateur dynamique configuré */
  const fallback: Array<{ valeur: string; libelle: string; icone: typeof Users; couleur: string }> = [
    { valeur: kpis.beneficiaires_total.toLocaleString('fr-FR'), libelle: c(contenu, 'kpi_compteurs.label_benef', 'Bénéficiaires accompagnés'), icone: Users, couleur: PROGRAMMES_STRATEGIQUES.PS1.principale },
    { valeur: kpis.structures_total.toLocaleString('fr-FR'),    libelle: c(contenu, 'kpi_compteurs.label_struct', 'Structures appuyées'),       icone: Building2, couleur: PROGRAMMES_STRATEGIQUES.PS3.principale },
    { valeur: kpis.pays_total.toString(),                        libelle: c(contenu, 'kpi_compteurs.label_pays', "Pays d'intervention"),       icone: Globe2,    couleur: PROGRAMMES_STRATEGIQUES.PS2.principale },
    { valeur: `${kpis.beneficiaires_femmes_pct}\u00a0%`,         libelle: c(contenu, 'kpi_compteurs.label_femmes', 'de femmes accompagnées'),    icone: Heart,     couleur: COULEUR_ACCENT },
  ];

  const items = afficherIndicateurs
    ? indicateurs.map((ind, i) => {
        /* Concept : si l'indicateur est un taux (unite = '%'), on affiche
         * la valeur avec son suffixe pourcentage et SANS abréviation compacte
         * (un taux ne peut pas dépasser 100, donc pas besoin de 'M'/'K'). */
        const estTaux = ind.unite === '%';
        let valeur: string;
        if (ind.valeur === null) {
          valeur = '—';
        } else if (estTaux) {
          valeur = `${ind.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}\u00a0%`;
        } else {
          valeur = ind.valeur.toLocaleString('fr-FR');
        }
        return {
          valeur,
          libelle: ind.labelMetrique,
          icone: iconePourCode(ind.code),
          couleur: COULEURS_COMPTEURS[i % COULEURS_COMPTEURS.length] ?? COULEUR_ACCENT,
        };
      })
    : fallback;

  /* Grille responsive : 2 cols mobile → 3 cols md → n cols lg */
  const lgCols =
    items.length >= 6 ? 'lg:grid-cols-6'
    : items.length === 5 ? 'lg:grid-cols-5'
    : 'lg:grid-cols-4';

  return (
    <section className="border-b bg-[#F8FAFC] py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">

        {/* En-tête */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0E4F88]/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#0E4F88]">
            <span className="size-1.5 rounded-full bg-[#0E4F88]" aria-hidden />
            Résultats consolidés OIF
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            {c(contenu, 'kpi_compteurs.titre', 'Données agrégées des projets emploi Jeunes')}
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Période {kpis.annee_couverture_min}–{kpis.annee_couverture_max} · Chiffres anonymisés conformes RGPD.
          </p>
        </div>

        {/* Panneau stat-bar institutionnel */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">

          {/* Barre de couleur dégradée en haut — signature OIF */}
          <div
            className="h-1 w-full"
            style={{
              background: `linear-gradient(to right, ${PROGRAMMES_STRATEGIQUES.PS1.principale} 0%, ${PROGRAMMES_STRATEGIQUES.PS3.principale} 40%, ${PROGRAMMES_STRATEGIQUES.PS2.principale} 70%, ${COULEUR_ACCENT} 100%)`,
            }}
          />

          {/* Grille des statistiques avec séparateurs */}
          <div
            className={cn(
              'grid grid-cols-2 md:grid-cols-3',
              lgCols,
              '[&>*]:border-b [&>*]:border-slate-100',
              'lg:[&>*]:border-b-0',
              '[&>*:nth-child(2n)]:border-r-0 [&>*]:border-r [&>*]:border-slate-100',
              'md:[&>*:nth-child(2n)]:border-r md:[&>*:nth-child(3n)]:border-r-0',
              'lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0',
            )}
          >
            {items.map(({ valeur, libelle, icone, couleur }, i) => (
              <CompteurCarte
                key={i}
                valeur={valeur}
                libelle={libelle}
                icone={icone}
                couleur={couleur}
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

/**
 * Cellule de statistique — design institutionnel.
 *
 * Concept :
 *   • `formatCompact` abrège les grands nombres (16 M) pour éviter le retour
 *     à la ligne dans la grille étroite.
 *   • L'icône est dans un carré arrondi (rounded-xl) plutôt qu'un cercle :
 *     plus proche du style des rapports institutionnels ONU/OIF.
 *   • `tabular-nums` aligne les chiffres sur la même largeur de colonne.
 *   • `tracking-widest` sur le libellé donne le registre "légende de rapport".
 */
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
  const { principal, suffixe } = formatCompact(valeur);
  return (
    <div className="group flex flex-col items-center gap-3 px-4 py-8 text-center transition-colors duration-150 hover:bg-slate-50">

      {/* Icône */}
      <div
        className="flex size-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
        style={{ backgroundColor: `${couleur}18`, color: couleur }}
      >
        <Icone aria-hidden className="size-5" />
      </div>

      {/* Valeur compacte + suffixe M/K */}
      <div className="flex items-baseline leading-none" style={{ color: couleur }}>
        <span className="text-3xl font-extrabold tabular-nums tracking-tight">
          {principal}
        </span>
        {suffixe && (
          <span className="text-xl font-bold">{suffixe}</span>
        )}
      </div>

      {/* Libellé style "légende rapport" */}
      <p className="max-w-[120px] text-[10px] font-semibold uppercase leading-tight tracking-widest text-slate-400">
        {libelle}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Programmes stratégiques
// ─────────────────────────────────────────────────────────────────────────────
function Programmes({ contenu }: { contenu: ContenuMap }) {
  const programmes = [
    {
      code: 'PS1' as const,
      titre: c(contenu, 'programmes.ps1_titre', 'Cultures et éducation'),
      description: PROGRAMMES_STRATEGIQUES.PS1.libelle,
      icone: BookOpen,
    },
    {
      code: 'PS2' as const,
      titre: c(contenu, 'programmes.ps2_titre', 'Démocratie et gouvernance'),
      description: PROGRAMMES_STRATEGIQUES.PS2.libelle,
      icone: Vote,
    },
    {
      code: 'PS3' as const,
      titre: c(contenu, 'programmes.ps3_titre', 'Développement durable'),
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
            {c(contenu, 'programmes.badge', 'Programmation 2024-2027')}
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            {c(contenu, 'programmes.titre', "Les trois programmes stratégiques de l'OIF")}
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            {c(contenu, 'programmes.sous_titre', "Trois axes complémentaires qui structurent l'action de la Francophonie.")}
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
function Methodologie({ contenu }: { contenu: ContenuMap }) {
  // Source : Cadre de mesure du rendement emploi V2, section 4 "Principes directeurs".
  const principes = [
    {
      titre: c(contenu, 'methodologie.p1_titre', 'Cohérence'),
      description: c(contenu, 'methodologie.p1_texte', "Les indicateurs sont interprétés de manière homogène d'un projet à l'autre afin de permettre des comparaisons, des agrégations et des analyses transversales."),
      icone: Target,
    },
    {
      titre: c(contenu, 'methodologie.p2_titre', 'Souplesse encadrée'),
      description: c(contenu, 'methodologie.p2_texte', "Le cadre commun fixe une structure partagée, mais laisse à chaque projet la possibilité de mobiliser les indicateurs les plus pertinents au regard de sa logique d'intervention, sans application uniforme ni mécanique."),
      icone: Leaf,
    },
    {
      titre: c(contenu, 'methodologie.p3_titre', 'Traçabilité'),
      description: c(contenu, 'methodologie.p3_texte', 'Tout résultat renseigné est adossé à des données vérifiables, à des définitions explicites et à des sources identifiables.'),
      icone: History,
    },
    {
      titre: c(contenu, 'methodologie.p4_titre', 'Fiabilisation progressive'),
      description: c(contenu, 'methodologie.p4_texte', "Respect de règles minimales d'harmonisation et de qualité des données, ainsi qu'un phasage des restitutions : première consolidation en juin, étape approfondie à l'automne, notamment pour les indicateurs C et D."),
      icone: TrendingUp,
    },
    {
      titre: c(contenu, 'methodologie.p5_titre', 'Responsabilité partagée'),
      description: c(contenu, 'methodologie.p5_texte', "La collecte mobilise l'ensemble des parties prenantes : unités chefs de file pour les bases nominatives, partenaires de mise en œuvre, gestionnaires de plateformes de formation, et SCS pour les enquêtes d'approfondissement."),
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
            {c(contenu, 'methodologie.badge', 'Principes directeurs')}
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            {c(contenu, 'methodologie.titre', 'Notre méthodologie de suivi-évaluation')}
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            {c(contenu, 'methodologie.sous_titre', 'Cinq principes structurants pour la mise en œuvre du Cadre Commun de mesure du rendement.')}
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
function CadreCommun({ contenu }: { contenu: ContenuMap }) {
  const CATEGORIE_CMR = [
    {
      code: 'A',
      couleur: '#0098A0',
      fillSvg: '#A8D8D5',
      titre: c(contenu, 'cadre_commun.cat_a_titre', 'Formation, compétences et insertion'),
      description:
        "Indicateurs relatifs au nombre de personnes formées, à l'achèvement des formations, à la certification, au gain de compétences et à l'insertion professionnelle à moyen terme.",
      icone: GraduationCap,
    },
    {
      code: 'B',
      couleur: '#5BAD4E',
      fillSvg: '#B8E0B0',
      titre: c(contenu, 'cadre_commun.cat_b_titre', 'Activités économiques, entrepreneuriat et emploi'),
      description: c(contenu, 'cadre_commun.cat_b_texte', "Indicateurs relatifs aux activités économiques appuyées, à la survie des structures soutenues, aux emplois créés ou maintenus et aux emplois indirects estimés."),
      icone: Building2,
    },
    {
      code: 'C',
      couleur: '#B8A000',
      fillSvg: '#E8D87A',
      titre: c(contenu, 'cadre_commun.cat_c_titre', 'Intermédiation et accès aux opportunités'),
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
            {c(contenu, 'cadre_commun.titre', 'Architecture du Cadre Commun')}
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            {c(contenu, 'cadre_commun.sous_titre', "Quatre catégories d'indicateurs et un marqueur transversal, partagés par tous les projets emploi jeunes OIF.")}
          </p>
        </div>

        {/* ── Diagramme en éventail avec légendes latérales ──
            Le composant CadreCommunFan gère lui-même la mise en page en
            3 colonnes (label A gauche / SVG centre / label D droite) avec
            les labels B et C au-dessus du SVG. Sur mobile, bascule en
            colonne unique. La max-w est élargie pour donner de la place
            aux labels sur les côtés. */}
        <div className="mx-auto mt-10 max-w-4xl">
          <CadreCommunFan />

          {/* Marqueur transversal F1 */}
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-center shadow-sm">
            <p className="text-[10px] font-bold tracking-widest text-amber-600 uppercase">
              {c(contenu, 'cadre_commun.f1_badge', 'Marqueur transversal · F1')}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-amber-900">
              {c(contenu, 'cadre_commun.f1_titre', 'Langue française et employabilité')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {c(contenu, 'cadre_commun.f1_texte', "Améliorer l'employabilité grâce à la maîtrise du français — angle d'analyse intégrable à tous les projets.")}
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
function Pourquoi({ contenu }: { contenu: ContenuMap }) {
  const definitions = [
    {
      icone: Users,
      titre: c(contenu, 'portee.def1_titre', 'Jeunesse'),
      description: c(contenu, 'portee.def1_texte', "Le cadre s'applique conformément aux définitions adoptées par l'OIF en matière de jeunesse, dans le but d'assurer un langage commun et une cohérence d'action entre l'ensemble des projets."),
    },
    {
      icone: Briefcase,
      titre: c(contenu, 'portee.def2_titre', 'Emploi'),
      description: c(contenu, 'portee.def2_texte', "Toute activité exercée en contrepartie d'une rémunération ou d'un profit (monétaire ou en nature), qu'elle soit salariée ou indépendante, formelle ou informelle, incluant l'auto-emploi et l'entrepreneuriat. Les dispositifs de formation rémunérés (apprentissage, alternance, stage rémunéré) sont inclus. Les expériences non rémunérées sont reconnues comme leviers d'employabilité sans être assimilées à de l'emploi."),
    },
    {
      icone: Sparkles,
      titre: c(contenu, 'portee.def3_titre', 'Employabilité'),
      description: c(contenu, 'portee.def3_texte', "La capacité d'un jeune à accéder à un emploi, à s'y maintenir et à y progresser, grâce à un socle de compétences (fondamentales, techniques, numériques et transversales), d'expériences et de ressources (information, orientation, intermédiation, réseaux, accompagnement), dans un environnement favorable levant les principaux obstacles."),
    },
  ];
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            {c(contenu, 'portee.titre', 'Portée du Cadre Commun')}
          </h2>
          <p className="text-muted-foreground mt-3 text-base leading-relaxed">
            {c(contenu, 'portee.sous_titre', "Référence commune pour tous les projets de l'OIF qui contribuent à l'amélioration de l'employabilité des jeunes, à leur accès à l'emploi, à l'auto-emploi, aux activités génératrices de revenus ou à l'environnement favorable à leur insertion économique.")}
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
function Citations({ contenu }: { contenu: ContenuMap }) {
  const citationsRaw = [
    {
      texte:  cH(contenu, 'citations.c1_texte', "Le suivi-évaluation rigoureux de nos projets emploi jeunes est la condition de leur impact mesurable et de leur soutenabilité dans la durée."),
      auteur: cH(contenu, 'citations.c1_auteur', 'Cadre commun de mesure du rendement'),
      fonction: cH(contenu, 'citations.c1_fonction', 'Document méthodologique OIF'),
    },
    {
      texte:    cH(contenu, 'citations.c2_texte', "L'apport du français à l'employabilité reste un marqueur transversal de toutes nos interventions : c'est notre signature francophone."),
      auteur:   cH(contenu, 'citations.c2_auteur', 'Note méthodologique'),
      fonction: cH(contenu, 'citations.c2_fonction', 'Service de Conception et Suivi (SCS)'),
    },
    {
      texte:    cH(contenu, 'citations.c3_texte', "Cibler une strate précise – un projet, un pays, une cohorte – plutôt qu'envoyer en masse : c'est ce qui distingue une collecte propre d'un envoi en masse."),
      auteur:   cH(contenu, 'citations.c3_auteur', 'Méthodologie OIF'),
      fonction: cH(contenu, 'citations.c3_fonction', 'Approche stratifiée des collectes'),
    },
  ];
  // Une citation entière est cachée si son texte est masqué
  const citations = citationsRaw.filter((c) => c.texte !== null);
  return (
    <section className="bg-gradient-to-b from-white via-amber-50/30 to-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            style={{ color: COULEUR_ACCENT, borderColor: `${COULEUR_ACCENT}66` }}
          >
            {c(contenu, 'citations.badge', 'Méthodologie & vision')}
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            {c(contenu, 'citations.titre', 'Ce qui guide notre démarche')}
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            {c(contenu, 'citations.sous_titre', 'Trois principes méthodologiques qui structurent notre approche du suivi-évaluation.')}
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {citations.map((cit, i) => (
            <Card
              key={i}
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
                  &laquo;&nbsp;{renderCms(cit.texte)}&nbsp;&raquo;
                </p>
                <div className="relative z-10 mt-6 border-t pt-4">
                  {cit.auteur !== null && (
                    <p className="font-semibold text-[#0E4F88]">{renderCms(cit.auteur)}</p>
                  )}
                  {cit.fonction !== null && (
                    <p className="text-muted-foreground text-xs">{renderCms(cit.fonction)}</p>
                  )}
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
function CtaFinal({ isAuthenticated, contenu }: { isAuthenticated: boolean; contenu: ContenuMap }) {
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
            ? c(contenu, 'cta_final.titre_auth', 'Reprenez votre travail dans votre espace')
            : 'Partenaire de mise en œuvre, bailleur ou représentant institutionnel\u00a0?'}
        </h2>
        <p className="mt-4 text-lg text-blue-50 md:text-xl">
          {isAuthenticated
            ? c(contenu, 'cta_final.sous_titre_auth', 'Tableaux de bord, indicateurs OIF, lancement de campagnes : tout est dans votre espace de travail.')
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
function FooterPublic({ contenu }: { contenu: ContenuMap }) {
  return (
    <footer className="border-t bg-gray-50 py-12 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <LogoOIF size="sm" withProtectedSpace={false} />
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              {c(contenu, 'footer.description', 'Service de Conception et Suivi (SCS) : Organisation Internationale de la Francophonie. Plateforme officielle de suivi-évaluation des projets emploi jeunes.')}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{c(contenu, 'footer.nav_titre', 'Plateforme')}</h3>
            <ul className="text-muted-foreground mt-4 space-y-2 text-xs">
              <li>
                <Link href="/connexion" className="hover:text-foreground">
                  {c(contenu, 'footer.nav_connexion', 'Se connecter')}
                </Link>
              </li>
              <li>
                <Link href="/demande-acces" className="hover:text-foreground">
                  {c(contenu, 'footer.nav_demande', 'Demander un accès')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  {c(contenu, 'footer.nav_contact', 'Nous contacter')}
                </Link>
              </li>
              <li>
                <Link href="/documents" className="hover:text-foreground">
                  {c(contenu, 'footer.nav_documents', 'Documents publics')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{c(contenu, 'footer.rgpd_titre', 'Contact RGPD')}</h3>
            <ul className="text-muted-foreground mt-4 space-y-2 text-xs">
              {cH(contenu, 'footer.rgpd_ligne1', 'SCS : Service de Conception et Suivi des projets') !== null && (
                <li>{renderCms(cH(contenu, 'footer.rgpd_ligne1', 'SCS : Service de Conception et Suivi des projets'))}</li>
              )}
              {cH(contenu, 'footer.rgpd_email', 'projets@francophonie.org') !== null && (
                <li>
                  <a href={`mailto:${cH(contenu, 'footer.rgpd_email', 'projets@francophonie.org') ?? 'projets@francophonie.org'}`} className="hover:text-foreground">
                    {renderCms(cH(contenu, 'footer.rgpd_email', 'projets@francophonie.org'))}
                  </a>
                </li>
              )}
              {cH(contenu, 'footer.rgpd_ligne2', 'Données traitées conformément au RGPD : accès limité aux personnes habilitées.') !== null && (
                <li>{renderCms(cH(contenu, 'footer.rgpd_ligne2', 'Données traitées conformément au RGPD : accès limité aux personnes habilitées.'))}</li>
              )}
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
