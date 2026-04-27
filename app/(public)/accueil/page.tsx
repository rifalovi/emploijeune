import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Users,
  Building2,
  Globe2,
  Heart,
  ArrowRight,
  ShieldCheck,
  History,
  Briefcase,
  GraduationCap,
  Vote,
  Leaf,
  BookOpen,
  TrendingUp,
  Target,
  BarChart3,
  Mail,
} from 'lucide-react';

import { LogoOIF } from '@/components/branding/logo-oif';
import { CarrouselHero } from '@/components/landing/carrousel-hero';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import { getKpisPublics } from '@/lib/landing/queries';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Plateforme OIF Emploi Jeunes : Suivi-évaluation des projets de la Francophonie',
  description:
    "Plateforme officielle du Service de Conception et Suivi (SCS) de l'Organisation Internationale de la Francophonie. Suivi-évaluation des projets emploi jeunes dans 50+ pays francophones.",
  openGraph: {
    title: 'Plateforme OIF Emploi Jeunes',
    description:
      'Suivi-évaluation des projets emploi jeunes de la Francophonie : 5 000+ jeunes accompagnés dans 50+ pays.',
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
  const kpis = await getKpisPublics();

  return (
    <div className="bg-background min-h-screen">
      <HeaderPublic />
      <HeroAvecCarrousel kpis={kpis} />
      <KpiCompteurs kpis={kpis} />
      <Programmes />
      <Methodologie />
      <CadreCommun />
      <Pourquoi />
      <Audiences />
      <PaysIntervention kpis={kpis} />
      <Citations />
      <CtaFinal />
      <FooterPublic />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────
function HeaderPublic() {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href="/accueil" className="inline-flex items-center" aria-label="Accueil">
          <LogoOIF size="sm" withProtectedSpace={false} />
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/contact" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Contact
          </Link>
          <Link
            href="/demande-acces"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Demander un accès
          </Link>
          <Link
            href="/connexion"
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
          >
            Se connecter
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero avec carrousel
// ─────────────────────────────────────────────────────────────────────────────
function HeroAvecCarrousel({ kpis }: { kpis: Awaited<ReturnType<typeof getKpisPublics>> }) {
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
            jeunes accompagnés dans <strong className="text-white">{kpis.pays_total}</strong> pays :
            période {kpis.annee_couverture_min} à {kpis.annee_couverture_max}.
          </p>
        )}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
        </div>
      </div>
    </CarrouselHero>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI compteurs
// ─────────────────────────────────────────────────────────────────────────────
function KpiCompteurs({ kpis }: { kpis: Awaited<ReturnType<typeof getKpisPublics>> }) {
  if (!kpis) return null;
  return (
    <section className="border-b bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            style={{ color: COULEUR_ACCENT, borderColor: `${COULEUR_ACCENT}66` }}
          >
            En chiffres
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            L&apos;impact de nos interventions
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Données agrégées des projets emploi jeunes OIF : période {kpis.annee_couverture_min} à{' '}
            {kpis.annee_couverture_max}.
          </p>
        </div>
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
    <Card className="group transition-all hover:-translate-y-1 hover:shadow-lg">
      <CardContent className="p-6 text-center">
        <div
          className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${couleur}1a`, color: couleur }}
        >
          <Icone aria-hidden className="size-7" />
        </div>
        <div className="text-3xl font-bold tabular-nums md:text-4xl" style={{ color: couleur }}>
          {valeur}
        </div>
        <p className="text-muted-foreground mt-2 text-sm">{libelle}</p>
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
  const points = [
    {
      titre: 'Cadre Commun de mesure',
      description:
        "Tous les projets emploi jeunes OIF s'appuient sur un référentiel d'indicateurs partagé : A1 (jeunes formés), A4 (gain de compétences), B1 (activités économiques appuyées), B4 (emplois indirects), F1 (apport du français à l'employabilité).",
      icone: Target,
    },
    {
      titre: 'Approche stratifiée',
      description:
        'Les collectes ciblent des strates précises (projet, pays, période, profil) plutôt que des envois en masse. Cette méthodologie garantit la délivrabilité, la qualité des réponses et la pertinence des analyses.',
      icone: BarChart3,
    },
    {
      titre: 'Marqueur F1 transversal',
      description:
        "L'apport du français à l'employabilité est suivi sur tous les projets : usage professionnel, accès à l'emploi, valorisation des compétences linguistiques dans les parcours.",
      icone: GraduationCap,
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
            Note méthodologique V2
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Notre méthodologie de suivi-évaluation
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Une démarche rigoureuse alignée sur les standards des bailleurs internationaux.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {points.map((p) => (
            <Card key={p.titre} className="border-l-4" style={{ borderLeftColor: COULEUR_ACCENT }}>
              <CardContent className="p-6">
                <div
                  className="mb-3 flex size-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${COULEUR_ACCENT}1a`, color: COULEUR_ACCENT }}
                >
                  <p.icone aria-hidden className="size-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{p.titre}</h3>
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
// Cadre Commun (4 piliers)
// ─────────────────────────────────────────────────────────────────────────────
function CadreCommun() {
  const piliers = [
    {
      titre: 'Insertion professionnelle',
      description: "Formation, employabilité, accès à l'emploi durable.",
    },
    {
      titre: 'Entrepreneuriat',
      description:
        'Soutien aux activités économiques portées par les jeunes (AGR, micro-entreprises).',
    },
    {
      titre: 'Égalité femmes-hommes',
      description: 'Marqueur transversal (89% de femmes accompagnées sur la base de sondage).',
    },
    {
      titre: 'Apport du français (F1)',
      description:
        "Contribution du français à l'accès à l'emploi et à la valorisation professionnelle.",
    },
  ];
  return (
    <section className="bg-gradient-to-b from-white via-amber-50/40 to-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Les 4 piliers du Cadre Commun
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Un référentiel partagé par tous les projets emploi jeunes OIF.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {piliers.map((p, i) => (
            <Card key={p.titre} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div
                  className="text-3xl font-bold"
                  style={{ color: i % 2 === 0 ? '#0198E9' : COULEUR_ACCENT }}
                >
                  {`0${i + 1}`}
                </div>
                <h3 className="mt-2 font-semibold text-gray-900">{p.titre}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
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
// Pourquoi
// ─────────────────────────────────────────────────────────────────────────────
function Pourquoi() {
  const valeurs = [
    {
      icone: ShieldCheck,
      titre: 'RGPD natif',
      description:
        'Consentement obligatoire à tous les niveaux, soft-delete avec audit, RLS Supabase 4 rôles.',
    },
    {
      icone: History,
      titre: 'Traçabilité complète',
      description:
        "Historique des affectations projet, journal d'audit immuable, transferts contextualisés.",
    },
    {
      icone: TrendingUp,
      titre: 'Pilotage stratégique',
      description:
        'Indicateurs OIF (A1, A4, B1, B4, F1), tableaux de bord par rôle, exports Excel ré-importables.',
    },
    {
      icone: GraduationCap,
      titre: 'Cohérence méthodologique',
      description: 'Aligné sur le Cadre Commun de mesure V2 et les questionnaires officiels SCS.',
    },
  ];
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Pourquoi cette plateforme
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Conçue pour les exigences institutionnelles d&apos;un opérateur multilatéral.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {valeurs.map((v) => (
            <Card key={v.titre} className="transition-all hover:-translate-y-1 hover:shadow-md">
              <CardContent className="p-5">
                <div
                  className="mb-3 flex size-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: '#0E4F881a', color: '#0E4F88' }}
                >
                  <v.icone aria-hidden className="size-5" />
                </div>
                <h3 className="font-semibold text-gray-900">{v.titre}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {v.description}
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
// Audiences
// ─────────────────────────────────────────────────────────────────────────────
function Audiences() {
  const audiences = [
    {
      icone: Briefcase,
      titre: 'Coordonnateurs de projet OIF',
      description:
        'Tableau de bord opérationnel, suivi des cohortes, lancement de campagnes ciblées.',
    },
    {
      icone: Building2,
      titre: 'Partenaires de mise en œuvre',
      description: "Saisie terrain, complétion des dossiers, génération d'enquêtes longitudinales.",
    },
    {
      icone: Vote,
      titre: 'Bailleurs et États',
      description: 'Reporting agrégé, indicateurs stratégiques, exports pour rapports annuels.',
    },
  ];
  return (
    <section className="bg-gradient-to-b from-white via-blue-50/30 to-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            À qui s&apos;adresse cette plateforme
          </h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {audiences.map((a) => (
            <Card
              key={a.titre}
              className="border-t-4 border-t-[#0198E9] transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#0198E9]/10 text-[#0198E9]">
                  <a.icone aria-hidden className="size-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{a.titre}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {a.description}
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
// Pays d'intervention
// ─────────────────────────────────────────────────────────────────────────────
function PaysIntervention({ kpis }: { kpis: Awaited<ReturnType<typeof getKpisPublics>> }) {
  if (!kpis || kpis.top_pays.length === 0) return null;
  const max = kpis.top_pays[0]?.beneficiaires ?? 1;
  return (
    <section className="border-t bg-white py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        <div className="text-center">
          <Badge
            variant="outline"
            style={{ color: COULEUR_ACCENT, borderColor: `${COULEUR_ACCENT}66` }}
          >
            Présence francophone
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Top {kpis.top_pays.length} pays
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Sur {kpis.pays_total} pays d&apos;intervention au total. Données agrégées, anonymes.
          </p>
        </div>
        <ol className="mt-12 space-y-3">
          {kpis.top_pays.map((p, i) => {
            const pct = Math.round((p.beneficiaires / max) * 100);
            return (
              <li key={p.code} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground w-6 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="w-40 truncate font-medium text-gray-900">
                  {p.libelle ?? p.code}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, #0198E9 0%, #0E4F88 100%)`,
                    }}
                  />
                </div>
                <span className="w-20 text-right font-semibold text-gray-900 tabular-nums">
                  {p.beneficiaires.toLocaleString('fr-FR')}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA final
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Citations institutionnelles (V1.6.0 polish)
// ─────────────────────────────────────────────────────────────────────────────
function Citations() {
  const citations = [
    {
      texte:
        'Le suivi-évaluation rigoureux de nos projets emploi jeunes est la condition de leur impact mesurable et de leur soutenabilité dans la durée.',
      auteur: 'Cadre commun de mesure du rendement V2',
      fonction: 'Document méthodologique OIF',
    },
    {
      texte:
        "L'apport du français à l'employabilité reste un marqueur transversal de toutes nos interventions : c'est notre signature francophone.",
      auteur: 'Note méthodologique V2',
      fonction: 'Service de Conception et Suivi (SCS)',
    },
    {
      texte:
        "Cibler une strate précise — un projet, un pays, une cohorte — plutôt qu'envoyer en masse : c'est ce qui distingue une collecte propre d'un envoi en masse.",
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

function CtaFinal() {
  return (
    <section
      className="relative overflow-hidden py-20 text-white md:py-24"
      style={{
        background: 'linear-gradient(135deg, #0E4F88 0%, #0198E9 100%)',
      }}
    >
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-8">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Vous êtes partenaire ou bailleur OIF&nbsp;?
        </h2>
        <p className="mt-4 text-lg text-blue-50 md:text-xl">
          Demandez un accès partenaire pour piloter vos projets ou consulter les indicateurs
          agrégés.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
