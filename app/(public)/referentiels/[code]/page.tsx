import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calculator,
  Calendar,
  Database,
  FileText,
  ListChecks,
  ShieldAlert,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  PILIERS,
  INDICATEURS,
  indicateurParCode,
  indicateurPrecedent,
  indicateurSuivant,
} from '@/lib/referentiels/indicateurs';

type Props = {
  params: Promise<{ code: string }>;
};

export async function generateStaticParams() {
  return INDICATEURS.map((i) => ({ code: i.code.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const ind = indicateurParCode(code);
  if (!ind) return { title: 'Indicateur introuvable' };
  return {
    title: `${ind.code} — ${ind.intitule} · Référentiels OIF`,
    description: ind.definition,
  };
}

export default async function FicheIndicateurPage({ params }: Props) {
  const { code } = await params;
  const ind = indicateurParCode(code);
  if (!ind) notFound();

  const pilier = PILIERS[ind.pilier];
  const precedent = indicateurPrecedent(ind.code);
  const suivant = indicateurSuivant(ind.code);

  return (
    <article className="space-y-8">
      {/* En-tête fiche */}
      <header
        className="rounded-xl p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${pilier.couleur} 0%, ${pilier.couleur}cc 100%)`,
        }}
      >
        <Link
          href="/referentiels"
          className="inline-flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Retour au référentiel
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex h-12 items-center rounded-lg bg-white/15 px-4 font-mono text-2xl font-bold backdrop-blur-sm">
            {ind.code}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-tight font-bold md:text-3xl">{ind.intitule}</h1>
            <p className="mt-1 text-sm text-white/85">
              {pilier.titre} — {pilier.sousTitre}
            </p>
          </div>
        </div>
      </header>

      {/* Lien vers les réalisations chiffrées */}
      <div className="flex items-center justify-end">
        <Link
          href={`/realisations/${ind.pilier.toLowerCase()}/${ind.code.toLowerCase()}`}
          className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50"
          style={{ color: pilier.couleur, borderColor: `${pilier.couleur}44` }}
        >
          <ArrowUpRight className="size-4" aria-hidden />
          Voir les réalisations chiffrées
        </Link>
      </div>

      {/* Définition */}
      <Section icon={BookOpen} titre="Définition">
        <p>{ind.definition}</p>
      </Section>

      {/* Variables */}
      <Section icon={ListChecks} titre="Variables collectées">
        <ul className="list-disc space-y-1 pl-6">
          {ind.variables.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </Section>

      {/* Méthode de calcul */}
      <Section icon={Calculator} titre="Méthode de calcul">
        <p>{ind.calcul}</p>
      </Section>

      {/* Collecte */}
      <Section icon={Database} titre="Collecte">
        <p>{ind.collecte}</p>
      </Section>

      {/* Sources */}
      <Section icon={FileText} titre="Sources">
        <ul className="list-disc space-y-1 pl-6">
          {ind.sources.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>

      {/* Fréquence */}
      <Section icon={Calendar} titre="Fréquence de collecte">
        <p>{ind.frequence}</p>
      </Section>

      {/* Projets concernés */}
      <Section icon={Tag} titre="Projets concernés">
        <div className="flex flex-wrap gap-2">
          {ind.projetsConcernes.map((proj) => (
            <Badge
              key={proj}
              variant="outline"
              className="text-xs"
              style={{ borderColor: `${pilier.couleur}55`, color: pilier.couleur }}
            >
              {proj}
            </Badge>
          ))}
        </div>
      </Section>

      {/* Précautions */}
      <Section icon={ShieldAlert} titre="Précautions méthodologiques" couleurAccent="#dc2626">
        <ul className="list-disc space-y-1 pl-6">
          {ind.precautions.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </Section>

      {/* Navigation prev / next */}
      <nav className="flex items-center justify-between border-t border-slate-200 pt-6">
        {precedent ? (
          <Link
            href={`/referentiels/${precedent.code.toLowerCase()}`}
            className="group flex items-center gap-2 text-sm text-slate-600 hover:text-[#0E4F88]"
          >
            <ArrowLeft
              className="size-4 transition-transform group-hover:-translate-x-0.5"
              aria-hidden
            />
            <span>
              <span className="text-muted-foreground block text-xs">Indicateur précédent</span>
              <span className="font-mono font-semibold">{precedent.code}</span> ·{' '}
              <span>{precedent.intitule}</span>
            </span>
          </Link>
        ) : (
          <span></span>
        )}
        {suivant ? (
          <Link
            href={`/referentiels/${suivant.code.toLowerCase()}`}
            className="group ml-auto flex items-center gap-2 text-right text-sm text-slate-600 hover:text-[#0E4F88]"
          >
            <span>
              <span className="text-muted-foreground block text-xs">Indicateur suivant</span>
              <span className="font-mono font-semibold">{suivant.code}</span> ·{' '}
              <span>{suivant.intitule}</span>
            </span>
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ) : (
          <span></span>
        )}
      </nav>

      {/* Lien vers documentation OIF */}
      <p className="text-muted-foreground border-t border-slate-200 pt-6 text-xs">
        <ArrowUpRight className="mr-1 inline size-3" aria-hidden />
        Source officielle : <em>Cadre commun de mesure du rendement V2</em>, OIF — Service de
        Conception et Suivi des projets.
      </p>
    </article>
  );
}

function Section({
  icon: Icon,
  titre,
  children,
  couleurAccent = '#0E4F88',
}: {
  icon: typeof BookOpen;
  titre: string;
  children: React.ReactNode;
  couleurAccent?: string;
}) {
  return (
    <section>
      <h2
        className="mb-3 flex items-center gap-2 text-lg font-semibold"
        style={{ color: couleurAccent }}
      >
        <Icon className="size-5" aria-hidden />
        {titre}
      </h2>
      <div className="text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}
