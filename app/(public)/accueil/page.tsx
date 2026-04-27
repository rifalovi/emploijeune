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
} from 'lucide-react';

import { LogoOIF } from '@/components/branding/logo-oif';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import { getKpisPublics } from '@/lib/landing/queries';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Plateforme OIF Emploi Jeunes — Suivi-évaluation des projets de la Francophonie',
  description:
    "Plateforme officielle du Service de Conception et Suivi (SCS) de l'Organisation Internationale de la Francophonie. Suivi-évaluation des projets emploi jeunes dans 50+ pays francophones.",
  openGraph: {
    title: 'Plateforme OIF Emploi Jeunes',
    description:
      'Suivi-évaluation des projets emploi jeunes de la Francophonie — 5 000+ jeunes accompagnés dans 50+ pays.',
    locale: 'fr_FR',
    type: 'website',
  },
};

/**
 * Vitrine publique institutionnelle (Sprint 3 — V1.4.0).
 *
 * Server Component — accessible sans authentification. Charge les KPI
 * agrégés via la fonction RPC `get_kpis_publics_v1()` (exposée au rôle
 * anon, RGPD compatible).
 *
 * Architecture :
 *   1. Header (logo + CTA connexion)
 *   2. Hero (titre + sous-titre + 2 CTA)
 *   3. KPI compteurs (4 chiffres clés)
 *   4. Programmes stratégiques (PS1/PS2/PS3 couleurs officielles)
 *   5. Cadre Commun (4 piliers)
 *   6. Pourquoi cette plateforme
 *   7. À qui s'adresse-t-elle
 *   8. Pays d'intervention (top 10)
 *   9. CTA final
 *   10. Footer institutionnel
 */
export default async function VitrinePubliquePage() {
  const kpis = await getKpisPublics();

  return (
    <div className="bg-background min-h-screen">
      <HeaderPublic />
      <Hero kpis={kpis} />
      <KpiCompteurs kpis={kpis} />
      <Programmes />
      <CadreCommun />
      <Pourquoi />
      <Audiences />
      <PaysIntervention kpis={kpis} />
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
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <LogoOIF size="sm" withProtectedSpace={false} />
        <nav className="flex items-center gap-2">
          <Link
            href="/connexion"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Espace partenaire
          </Link>
          <Link
            href="/demande-acces"
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
          >
            Demander un accès
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────
function Hero({ kpis }: { kpis: Awaited<ReturnType<typeof getKpisPublics>> }) {
  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-br from-white via-blue-50/40 to-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-8">
        <Badge variant="outline" className="mb-6">
          Plateforme officielle SCS — Organisation Internationale de la Francophonie
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight text-[#0E4F88] md:text-6xl">
          Suivi-évaluation des projets
          <br />
          <span className="text-[#0198E9]">emploi jeunes</span> de la Francophonie
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-3xl text-lg md:text-xl">
          Une plateforme institutionnelle dédiée au pilotage opérationnel et stratégique des
          programmes OIF d&apos;insertion économique des jeunes francophones.
        </p>
        {kpis && (
          <p className="mt-4 text-base text-gray-700">
            <strong className="text-[#0E4F88]">
              {kpis.beneficiaires_total.toLocaleString('fr-FR')}
            </strong>{' '}
            jeunes accompagnés dans <strong className="text-[#0E4F88]">{kpis.pays_total}</strong>{' '}
            pays — données {kpis.annee_couverture_min}–{kpis.annee_couverture_max}
          </p>
        )}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/demande-acces"
            className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'gap-2')}
          >
            Demander un accès
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link
            href="/connexion"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
          >
            Espace partenaire
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI compteurs
// ─────────────────────────────────────────────────────────────────────────────
function KpiCompteurs({ kpis }: { kpis: Awaited<ReturnType<typeof getKpisPublics>> }) {
  if (!kpis) return null;
  return (
    <section className="border-b py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-[#0E4F88] md:text-3xl">
          L&apos;impact de nos interventions en chiffres
        </h2>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
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
            couleur="#0E4F88"
          />
        </div>
        <p className="text-muted-foreground mt-8 text-center text-sm">
          Données agrégées des projets emploi jeunes OIF, période {kpis.annee_couverture_min}–
          {kpis.annee_couverture_max}. Aucune donnée nominative — chiffres anonymisés conformes
          RGPD.
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
    <Card>
      <CardContent className="p-6 text-center">
        <div
          className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full"
          style={{ backgroundColor: `${couleur}1a`, color: couleur }}
        >
          <Icone aria-hidden className="size-6" />
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
    <section className="bg-gray-50/60 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[#0E4F88] md:text-3xl">
            Les trois programmes stratégiques de l&apos;OIF
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            La programmation 2024-2027 articule trois axes complémentaires.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {programmes.map((p) => {
            const couleur = PROGRAMMES_STRATEGIQUES[p.code].principale;
            return (
              <Card key={p.code} className="border-t-4" style={{ borderTopColor: couleur }}>
                <CardContent className="p-6">
                  <div
                    className="mb-4 flex size-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${couleur}1a`, color: couleur }}
                  >
                    <p.icone aria-hidden className="size-6" />
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
// Cadre Commun
// ─────────────────────────────────────────────────────────────────────────────
function CadreCommun() {
  const piliers = [
    {
      titre: 'Insertion professionnelle',
      description: 'Formation, employabilité, accès à l\u2019emploi durable.',
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
      titre: 'Apport du français',
      description:
        'Indicateur F1 — contribution du français à l\u2019employabilité (questionnaire D3).',
    },
  ];
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[#0E4F88] md:text-3xl">
            Le Cadre Commun de mesure
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Quatre piliers communs à tous les projets emploi jeunes OIF, alignés sur le Cadre de
            mesure du rendement V2.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {piliers.map((p, i) => (
            <Card key={p.titre}>
              <CardContent className="p-5">
                <div className="text-3xl font-bold text-[#0198E9]">{`0${i + 1}`}</div>
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
        'Historique des affectations projet, journal d\u2019audit immuable, transferts contextualisés.',
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
    <section className="bg-gray-50/60 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[#0E4F88] md:text-3xl">
            Pourquoi cette plateforme
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Conçue pour les exigences institutionnelles d&apos;un opérateur multilatéral.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {valeurs.map((v) => (
            <Card key={v.titre}>
              <CardContent className="p-5">
                <div className="mb-3 text-[#0E4F88]">
                  <v.icone aria-hidden className="size-6" />
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
      description:
        'Saisie terrain, complétion des dossiers, génération d\u2019enquêtes longitudinales.',
    },
    {
      icone: Vote,
      titre: 'Bailleurs et États',
      description: 'Reporting agrégé, indicateurs stratégiques, exports pour rapports annuels.',
    },
  ];
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[#0E4F88] md:text-3xl">
            À qui s&apos;adresse cette plateforme
          </h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {audiences.map((a) => (
            <Card key={a.titre} className="border-t-4 border-t-[#0198E9]">
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
    <section className="border-t bg-gray-50/60 py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[#0E4F88] md:text-3xl">
            Présence francophone — Top {kpis.top_pays.length} pays
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Sur {kpis.pays_total} pays d&apos;intervention au total. Données agrégées, anonymes.
          </p>
        </div>
        <ol className="mt-10 space-y-3">
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
                <div className="flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-2 rounded-full bg-[#0198E9]" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-20 text-right text-gray-900 tabular-nums">
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
function CtaFinal() {
  return (
    <section className="bg-[#0E4F88] py-16 text-white md:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-8">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          Vous êtes partenaire ou bailleur OIF&nbsp;?
        </h2>
        <p className="mt-4 text-lg text-blue-100">
          Demandez un accès partenaire pour piloter vos projets ou consulter les indicateurs
          agrégés.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/demande-acces"
            className={cn(
              buttonVariants({ variant: 'default', size: 'lg' }),
              'gap-2 bg-white text-[#0E4F88] hover:bg-blue-50',
            )}
          >
            Demander un accès
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link
            href="/connexion"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'border-white text-white hover:bg-white/10',
            )}
          >
            Se connecter
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
    <footer className="border-t bg-gray-50 py-10 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <LogoOIF size="sm" withProtectedSpace={false} />
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Service de Conception et Suivi (SCS) — Organisation Internationale de la Francophonie.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Plateforme</h3>
            <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
              <li>
                <Link href="/connexion" className="hover:text-foreground">
                  Espace partenaire
                </Link>
              </li>
              <li>
                <Link href="/demande-acces" className="hover:text-foreground">
                  Demander un accès
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Contact &amp; RGPD</h3>
            <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
              <li>SCS — Direction Programmation OIF</li>
              <li>
                <a
                  href="mailto:carlos.hounsinou@francophonie.org"
                  className="hover:text-foreground"
                >
                  carlos.hounsinou@francophonie.org
                </a>
              </li>
              <li>
                Données traitées conformément au RGPD — accès limité aux personnes habilitées.
              </li>
            </ul>
          </div>
        </div>
        <div className="text-muted-foreground mt-8 border-t pt-4 text-center text-xs">
          © {new Date().getFullYear()} OIF — Plateforme Emploi Jeunes — Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
