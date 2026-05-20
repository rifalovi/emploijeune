import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { PILIERS, indicateursParPilier, type CodePilier } from '@/lib/referentiels/indicateurs';
import { getDocumentPublic } from '@/lib/documents-publics/queries';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Référentiels – Cadre Commun OIF',
  description:
    'Tableau de bord des 18 indicateurs du Cadre Commun de mesure du rendement OIF pour le suivi-évaluation des projets emploi jeunes.',
};

/**
 * Indicateurs pour lesquels des données réelles sont disponibles sur la plateforme.
 * Les autres sont marqués « Collecte en cours ».
 */
const DONNEES_DISPONIBLES = new Set(['A1', 'B1']);

export default async function ReferentielsAccueil() {
  const noteCadrage = await getDocumentPublic('note_cadrage');

  return (
    <div className="space-y-12">
      {/* En-tête */}
      <section>
        <Badge
          variant="outline"
          className="text-xs"
          style={{ color: '#F5A623', borderColor: '#F5A62366' }}
        >
          Cadre Commun de mesure du rendement
        </Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
          Référentiel OIF – Tableau de bord CMR
        </h1>
        <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-relaxed">
          Vue synthétique des 18 indicateurs du Cadre Commun. Cliquez sur un indicateur pour
          consulter sa fiche méthodologique complète (définition, variables, collecte, calcul,
          sources) ou accédez directement aux réalisations chiffrées.
        </p>
        {noteCadrage && (
          <div className="mt-6">
            <a
              href={noteCadrage.urlPublique}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'gap-2 border-[#0E4F88] text-[#0E4F88] hover:bg-[#0E4F88]/5',
              )}
            >
              <Download className="size-4" aria-hidden />
              Télécharger la note de cadrage (PDF)
            </a>
          </div>
        )}
      </section>

      {/* Piliers */}
      {(Object.keys(PILIERS) as CodePilier[]).map((code) => {
        const p = PILIERS[code];
        const indicateurs = indicateursParPilier(code);

        return (
          <section key={code} className="space-y-3">
            {/* En-tête pilier */}
            <div
              className="flex items-center gap-3 rounded-xl px-5 py-4"
              style={{ backgroundColor: `${p.couleur}0d`, borderLeft: `4px solid ${p.couleur}` }}
            >
              <span
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: p.couleur }}
              >
                {code}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: p.couleur }}>
                  {p.sousTitre}
                </p>
                <p className="text-muted-foreground text-xs leading-snug">{p.description}</p>
              </div>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                {indicateurs.length} indicateur{indicateurs.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Liste indicateurs */}
            <div className="divide-y rounded-xl border">
              {indicateurs.map((ind) => {
                const disponible = DONNEES_DISPONIBLES.has(ind.code);
                return (
                  <div
                    key={ind.code}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60"
                  >
                    {/* Code */}
                    <span
                      className="inline-flex h-7 min-w-[2.75rem] shrink-0 items-center justify-center rounded px-2 font-mono text-xs font-bold text-white"
                      style={{ backgroundColor: p.couleur }}
                    >
                      {ind.code}
                    </span>

                    {/* Titre + définition */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{ind.intitule}</p>
                      <p className="text-muted-foreground line-clamp-1 text-xs">{ind.definition}</p>
                    </div>

                    {/* Statut collecte */}
                    <div className="shrink-0">
                      {disponible ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          <CheckCircle2 className="size-3" aria-hidden />
                          Données disponibles
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                          <Clock className="size-3" aria-hidden />
                          Collecte en cours
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/referentiels/${ind.code.toLowerCase()}`}
                        className="rounded px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        Fiche CMR
                      </Link>
                      <Link
                        href={`/realisations/${ind.pilier.toLowerCase()}/${ind.code.toLowerCase()}`}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-slate-100"
                        style={{ color: p.couleur }}
                      >
                        Réalisations
                        <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Note source */}
      <p className="border-t border-slate-200 pt-6 text-xs text-slate-400">
        Source :{' '}
        <em>
          Cadre commun pour le suivi et la documentation des résultats de l&apos;emploi des jeunes –
          Note mÃ©thodologique
        </em>
        , validé par le Service de Conception et Suivi (SCS) de l&apos;OIF.
      </p>
    </div>
  );
}
