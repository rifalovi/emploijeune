import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookMarked } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
    'Architecture du Cadre Commun de mesure du rendement OIF V2 : 5 catégories, 18 indicateurs pour le suivi-évaluation des projets emploi jeunes.',
};

export default function ReferentielsAccueil() {
  return (
    <div className="space-y-12">
      <section>
        <Badge
          variant="outline"
          className="text-xs"
          style={{ color: '#F5A623', borderColor: '#F5A62366' }}
        >
          Cadre Commun de mesure du rendement V2
        </Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
          Architecture du référentiel OIF
        </h1>
        <p className="text-muted-foreground mt-4 max-w-3xl text-base">
          Référentiel partagé pour le suivi, la mesure et la documentation des résultats des projets
          OIF contribuant au renforcement de l&apos;emploi des jeunes —
          <strong> 4 catégories thématiques</strong> + <strong>1 marqueur transversal</strong>, pour
          un total de <strong>{INDICATEURS.length} indicateurs</strong> validés par le Service de
          Conception et Suivi.
        </p>
      </section>

      {/* Cards des 5 piliers */}
      <section>
        <h2 className="text-xl font-semibold text-[#0E4F88]">Les 5 piliers du Cadre Commun</h2>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          Chaque pilier regroupe des indicateurs qui partagent une logique d&apos;observation
          commune et permettent l&apos;agrégation des résultats à l&apos;échelle de tous les projets
          OIF.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {(Object.keys(PILIERS) as CodePilier[]).map((code) => {
            const p = PILIERS[code];
            const indicateurs = indicateursParPilier(code);
            return (
              <Card
                key={code}
                className="group overflow-hidden border-l-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ borderLeftColor: p.couleur }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="inline-flex size-10 items-center justify-center rounded-lg font-bold text-white"
                      style={{ backgroundColor: p.couleur }}
                    >
                      {code}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] tabular-nums"
                      style={{ borderColor: `${p.couleur}66`, color: p.couleur }}
                    >
                      {indicateurs.length} indicateur{indicateurs.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold" style={{ color: p.couleur }}>
                    {p.titre}
                  </h3>
                  <p className="text-sm font-medium text-slate-900">{p.sousTitre}</p>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {p.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {indicateurs.map((i) => (
                      <Link
                        key={i.code}
                        href={`/referentiels/${i.code.toLowerCase()}`}
                        className="inline-flex items-center rounded border px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors hover:bg-slate-50"
                        style={{ borderColor: `${p.couleur}55`, color: p.couleur }}
                      >
                        {i.code}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Tableau récap des 18 indicateurs */}
      <section>
        <h2 className="text-xl font-semibold text-[#0E4F88]">Liste exhaustive des indicateurs</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Pilier</th>
                <th className="px-4 py-2 text-left">Intitulé</th>
                <th className="px-4 py-2 text-left">Projets concernés</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {INDICATEURS.map((i) => {
                const p = PILIERS[i.pilier];
                return (
                  <tr key={i.code} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className="font-mono text-xs"
                        style={{ borderColor: `${p.couleur}66`, color: p.couleur }}
                      >
                        {i.code}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{p.sousTitre}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{i.intitule}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      <div className="flex flex-wrap gap-1">
                        {i.projetsConcernes.slice(0, 3).map((proj) => (
                          <span
                            key={proj}
                            className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]"
                          >
                            {proj}
                          </span>
                        ))}
                        {i.projetsConcernes.length > 3 && (
                          <span className="text-slate-400">+{i.projetsConcernes.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/referentiels/${i.code.toLowerCase()}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0E4F88] hover:underline"
                      >
                        Fiche
                        <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Note méthodologique */}
      <section className="rounded-xl bg-[#0E4F88]/5 p-6">
        <div className="flex items-start gap-3">
          <BookMarked className="size-5 shrink-0 text-[#0E4F88]" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-[#0E4F88]">Source méthodologique</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              Cette architecture est issue du document officiel{' '}
              <em>
                Cadre commun pour le suivi et la documentation des résultats de l&apos;emploi des
                jeunes dans les projets — Note méthodologique V2
              </em>
              , validé par le Service de Conception et Suivi (SCS) de l&apos;Organisation
              Internationale de la Francophonie. Aucune définition n&apos;a été modifiée : chaque
              fiche reproduit fidèlement les variables, méthodes de calcul, sources et précautions
              documentées par l&apos;OIF.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
