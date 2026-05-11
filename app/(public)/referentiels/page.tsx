import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  BarChart2,
  ClipboardList,
  Calculator,
  Database,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PILIERS,
  INDICATEURS,
  indicateursParPilier,
  type CodePilier,
} from '@/lib/referentiels/indicateurs';

export const metadata: Metadata = {
  title: 'Référentiels — Cadre Commun OIF V2',
  description:
    'Fiches détaillées des 18 indicateurs du Cadre Commun de mesure du rendement OIF V2 pour le suivi-évaluation des projets emploi jeunes.',
};

function SectionLabel({
  icon: Icon,
  label,
  couleur,
}: {
  icon: React.ElementType;
  label: string;
  couleur: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0" style={{ color: couleur }} aria-hidden />
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
    </div>
  );
}

function IndicateurFiche({
  indicateur,
  couleur,
}: {
  indicateur: (typeof INDICATEURS)[number];
  couleur: string;
}) {
  return (
    <Card
      id={indicateur.code.toLowerCase()}
      className="overflow-hidden border-l-4 scroll-mt-24"
      style={{ borderLeftColor: couleur }}
    >
      <CardHeader className="pb-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-mono text-sm font-bold text-white"
              style={{ backgroundColor: couleur }}
            >
              {indicateur.code}
            </span>
            <h3 className="text-base font-semibold text-slate-900">{indicateur.intitule}</h3>
          </div>
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{ color: couleur, borderColor: `${couleur}55` }}
          >
            {indicateur.frequence}
          </Badge>
        </div>

        {/* Définition */}
        <div className="mt-3 flex items-start gap-2">
          <BookOpen className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
          <p className="text-sm leading-relaxed text-slate-700">{indicateur.definition}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Variables */}
        <div>
          <SectionLabel icon={BarChart2} label="Variables" couleur={couleur} />
          <ul className="mt-2 space-y-0.5">
            {indicateur.variables.map((v) => (
              <li key={v} className="flex items-start gap-2 text-xs text-slate-600">
                <span
                  className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `${couleur}88` }}
                />
                {v}
              </li>
            ))}
          </ul>
        </div>

        {/* Collecte + Calcul côte à côte */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <SectionLabel icon={ClipboardList} label="Méthode de collecte" couleur={couleur} />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{indicateur.collecte}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <SectionLabel icon={Calculator} label="Mode de calcul" couleur={couleur} />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{indicateur.calcul}</p>
          </div>
        </div>

        {/* Sources */}
        <div>
          <SectionLabel icon={Database} label="Sources de données" couleur={couleur} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {indicateur.sources.map((s) => (
              <span
                key={s}
                className="rounded border px-2 py-0.5 text-[11px] text-slate-600"
                style={{ borderColor: `${couleur}33`, backgroundColor: `${couleur}08` }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Précautions */}
        {indicateur.precautions.length > 0 && (
          <div>
            <SectionLabel icon={AlertTriangle} label="Précautions" couleur={couleur} />
            <ul className="mt-2 space-y-0.5">
              {indicateur.precautions.map((p) => (
                <li key={p} className="flex items-start gap-2 text-xs text-slate-600">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-400" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Lien vers les réalisations */}
        <div className="flex justify-end border-t border-slate-100 pt-2">
          <Link
            href={`/realisations/${indicateur.pilier.toLowerCase()}/${indicateur.code.toLowerCase()}`}
            className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
            style={{ color: couleur }}
          >
            Voir les réalisations →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReferentielsAccueil() {
  return (
    <div className="space-y-14">
      {/* En-tête */}
      <section>
        <Badge
          variant="outline"
          className="text-xs"
          style={{ color: '#F5A623', borderColor: '#F5A62366' }}
        >
          Cadre Commun de mesure du rendement V2
        </Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
          Référentiel OIF — Fiches indicateurs
        </h1>
        <p className="text-muted-foreground mt-4 max-w-3xl text-base">
          Définitions officielles issues de la{' '}
          <em>
            Note méthodologique du Cadre Commun pour le suivi et la documentation des résultats de
            l&apos;emploi des jeunes
          </em>{' '}
          validée par le Service de Conception et Suivi (SCS) de l&apos;OIF. Aucune définition
          n&apos;a été modifiée.
        </p>
      </section>

      {/* Sommaire rapide — ancres par pilier */}
      <nav aria-label="Navigation par pilier" className="flex flex-wrap gap-2">
        {(Object.keys(PILIERS) as CodePilier[]).map((code) => {
          const p = PILIERS[code];
          return (
            <a
              key={code}
              href={`#pilier-${code.toLowerCase()}`}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-slate-50"
              style={{ borderColor: `${p.couleur}55`, color: p.couleur }}
            >
              <span
                className="inline-flex size-4 items-center justify-center rounded-sm font-bold text-white text-[10px]"
                style={{ backgroundColor: p.couleur }}
              >
                {code}
              </span>
              {p.sousTitre}
            </a>
          );
        })}
      </nav>

      {/* Fiches par pilier */}
      {(Object.keys(PILIERS) as CodePilier[]).map((code) => {
        const p = PILIERS[code];
        const indicateurs = indicateursParPilier(code);
        return (
          <section key={code} id={`pilier-${code.toLowerCase()}`} className="scroll-mt-8 space-y-6">
            {/* En-tête du pilier */}
            <div
              className="flex items-start gap-4 rounded-xl p-5"
              style={{ backgroundColor: `${p.couleur}0d` }}
            >
              <span
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white"
                style={{ backgroundColor: p.couleur }}
              >
                {code}
              </span>
              <div>
                <h2 className="text-lg font-bold" style={{ color: p.couleur }}>
                  {p.titre} — {p.sousTitre}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {p.description}
                </p>
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="size-3" aria-hidden />
                  {indicateurs.length} indicateur{indicateurs.length > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Fiches des indicateurs du pilier */}
            <div className="space-y-4">
              {indicateurs.map((ind) => (
                <IndicateurFiche key={ind.code} indicateur={ind} couleur={p.couleur} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Note méthodologique */}
      <section className="rounded-xl bg-[#0E4F88]/5 p-6">
        <div className="flex items-start gap-3">
          <BookOpen className="size-5 shrink-0 text-[#0E4F88]" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-[#0E4F88]">Source officielle</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              Ces fiches reproduisent fidèlement les variables, méthodes de collecte, modes de
              calcul, sources et précautions documentées dans le{' '}
              <em>Cadre commun pour le suivi et la documentation des résultats de l&apos;emploi des
              jeunes dans les projets — Note méthodologique V2</em>, validé par le Service de
              Conception et Suivi (SCS) de l&apos;Organisation Internationale de la Francophonie.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
