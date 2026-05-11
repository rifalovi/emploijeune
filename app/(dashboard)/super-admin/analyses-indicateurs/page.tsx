import type { Metadata } from 'next';
import { Sparkles, Bot, CheckCircle2, Clock, PenLine, Trash2, RefreshCw, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { INDICATEURS, PILIERS, type CodePilier } from '@/lib/referentiels/indicateurs';
import { listerAnalysesAdmin } from '@/lib/analyses-indicateurs/queries';
import {
  genererAnalyseIndicateur,
  publierAnalyse,
  modifierAnalyse,
  supprimerAnalyse,
} from '@/lib/analyses-indicateurs/server-actions';

export const metadata: Metadata = {
  title: 'Analyses IA — Super Administration',
};

// Forcer le rendu dynamique (données en temps réel)
export const dynamic = 'force-dynamic';

export default async function AnalysesIndicateursPage() {
  const analyses = await listerAnalysesAdmin();

  // Indexer les analyses par code indicateur
  const analyseParCode = new Map(
    analyses.map((a) => [a.indicateur_code, a]),
  );

  // Compter les statuts
  const nbPubiliees = analyses.filter((a) => a.statut === 'publiee').length;
  const nbBrouillons = analyses.filter((a) => a.statut === 'brouillon').length;
  const nbSansAnalyse = INDICATEURS.length - new Set(analyses.map((a) => a.indicateur_code)).size;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[#0E4F88]" aria-hidden />
            <h2 className="text-xl font-semibold">Analyses IA par indicateur</h2>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Générez, révisez et publiez les analyses Claude pour chaque indicateur CMR.
            Seules les analyses <strong>publiées</strong> sont visibles sur le tableau de bord public.
          </p>
        </div>
        {/* Compteurs */}
        <div className="flex gap-3 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {nbPubiliees} publiées
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-amber-600">
            <Clock className="size-3.5" aria-hidden />
            {nbBrouillons} brouillons
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-500">
            {nbSansAnalyse} sans analyse
          </span>
        </div>
      </div>

      {/* Note pédagogique */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Workflow :</strong> Générer → Relire/Modifier → Publier.
        Une seule analyse peut être publiée par indicateur. Publier une nouvelle analyse
        rétrograde automatiquement l&apos;ancienne en brouillon.
      </div>

      {/* Liste par pilier */}
      {(Object.keys(PILIERS) as CodePilier[]).map((codePilier) => {
        const pilier = PILIERS[codePilier];
        const indicateursPilier = INDICATEURS.filter((i) => i.pilier === codePilier);

        return (
          <section key={codePilier} className="space-y-2">
            {/* En-tête pilier */}
            <div
              className="flex items-center gap-3 rounded-lg px-4 py-2.5"
              style={{ backgroundColor: `${pilier.couleur}10`, borderLeft: `3px solid ${pilier.couleur}` }}
            >
              <span
                className="inline-flex size-7 items-center justify-center rounded font-bold text-white text-xs"
                style={{ backgroundColor: pilier.couleur }}
              >
                {codePilier}
              </span>
              <p className="text-sm font-semibold" style={{ color: pilier.couleur }}>
                {pilier.sousTitre}
              </p>
            </div>

            {/* Indicateurs du pilier */}
            <div className="divide-y rounded-xl border">
              {indicateursPilier.map((ind) => {
                const analyse = analyseParCode.get(ind.code);
                const estPubliee = analyse?.statut === 'publiee';
                const estBrouillon = analyse?.statut === 'brouillon';

                return (
                  <div key={ind.code} className="p-4">
                    {/* Ligne principale */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded font-mono text-xs font-bold text-white"
                        style={{ backgroundColor: pilier.couleur }}
                      >
                        {ind.code}
                      </span>
                      <p className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                        {ind.intitule}
                      </p>

                      {/* Statut */}
                      <div className="shrink-0">
                        {estPubliee ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            <CheckCircle2 className="size-3" aria-hidden />
                            Publiée
                          </span>
                        ) : estBrouillon ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                            <Clock className="size-3" aria-hidden />
                            Brouillon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                            Aucune analyse
                          </span>
                        )}
                      </div>

                      {/* Badges méta */}
                      {analyse?.genere_par_ia && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Bot className="mr-1 size-3" aria-hidden />
                          IA
                        </Badge>
                      )}
                      {analyse?.modifie_par_sa && (
                        <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200">
                          <PenLine className="mr-1 size-3" aria-hidden />
                          Révisé
                        </Badge>
                      )}

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-2">
                        {/* Générer / Regénérer */}
                        <form action={genererAnalyseIndicateur}>
                          <input type="hidden" name="indicateur_code" value={ind.code} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            <RefreshCw className="size-3" aria-hidden />
                            {analyse ? 'Regénérer' : 'Générer'}
                          </button>
                        </form>

                        {/* Publier (si brouillon) */}
                        {estBrouillon && analyse && (
                          <form action={publierAnalyse}>
                            <input type="hidden" name="analyse_id" value={analyse.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-emerald-50"
                              style={{ color: pilier.couleur }}
                            >
                              <Eye className="size-3" aria-hidden />
                              Publier
                            </button>
                          </form>
                        )}

                        {/* Supprimer brouillon */}
                        {estBrouillon && analyse && (
                          <form action={supprimerAnalyse}>
                            <input type="hidden" name="analyse_id" value={analyse.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="size-3" aria-hidden />
                              Supprimer
                            </button>
                          </form>
                        )}
                      </div>
                    </div>

                    {/* Résumé si disponible */}
                    {analyse?.resume && (
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed pl-[2.75rem]">
                        {analyse.resume}
                      </p>
                    )}

                    {/* Aperçu contenu (brouillon uniquement) */}
                    {estBrouillon && analyse && (
                      <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 pl-[2.75rem]">
                        <EditeurAnalyse analyse={analyse} />
                      </div>
                    )}

                    {/* Tokens info */}
                    {analyse?.tokens_utilises && (
                      <p className="mt-1 text-[10px] text-slate-400 pl-[2.75rem]">
                        {analyse.tokens_utilises.toLocaleString('fr-FR')} tokens utilisés
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Sous-composant : éditeur inline du brouillon ─────────────────────────────
/**
 * Formulaire d'édition du contenu d'une analyse brouillon.
 * Pattern "progressive disclosure" : l'éditeur n'est visible que
 * pour les brouillons, évitant la surcharge visuelle.
 */
function EditeurAnalyse({
  analyse,
}: {
  analyse: { id: string; contenu: string; resume: string | null };
}) {
  return (
    <form action={modifierAnalyse} className="space-y-3">
      <input type="hidden" name="analyse_id" value={analyse.id} />
      <div>
        <label htmlFor={`resume-${analyse.id}`} className="mb-1 block text-xs font-medium text-slate-600">
          Résumé (accroche — max 150 car.)
        </label>
        <input
          id={`resume-${analyse.id}`}
          name="resume"
          type="text"
          maxLength={150}
          defaultValue={analyse.resume ?? ''}
          className="w-full rounded border border-slate-200 px-3 py-1.5 text-xs focus:border-[#0E4F88] focus:outline-none"
          placeholder="Accroche de l'analyse (optionnel)"
        />
      </div>
      <div>
        <label htmlFor={`contenu-${analyse.id}`} className="mb-1 block text-xs font-medium text-slate-600">
          Contenu (Markdown)
        </label>
        <textarea
          id={`contenu-${analyse.id}`}
          name="contenu"
          rows={12}
          defaultValue={analyse.contenu}
          className="w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs focus:border-[#0E4F88] focus:outline-none"
          placeholder="Contenu en Markdown…"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E4F88] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0a3d6b]"
        >
          <PenLine className="size-3" aria-hidden />
          Sauvegarder les modifications
        </button>
      </div>
    </form>
  );
}
