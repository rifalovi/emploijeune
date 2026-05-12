import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock, BarChart3, AlertCircle, ArrowRight } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { INDICATEURS, PILIERS, type CodePilier } from '@/lib/referentiels/indicateurs';
import { getIndicateursAnnuels, getConfigIndicateurs } from '@/lib/indicateurs-annuels/queries';
import { doitAfficherVisualisation } from '@/lib/indicateurs-annuels/types';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Tous les indicateurs – OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

/**
 * Page d'inventaire des 18 indicateurs CMR avec leurs valeurs annuelles.
 *
 * Accessible à tous les rôles authentifiés. Le scope (global vs périmètre
 * projet) est appliqué côté BDD par la RPC `lister_indicateurs_avec_valeurs_annuelles`.
 */
export default async function IndicateursPage() {
  await requireUtilisateurValide();

  const [payload, config] = await Promise.all([
    getIndicateursAnnuels(),
    getConfigIndicateurs(),
  ]);

  if (!payload) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-semibold">
          <AlertCircle className="size-4" aria-hidden />
          Impossible de charger les indicateurs.
        </p>
        <p className="mt-2">
          La fonction <code>lister_indicateurs_avec_valeurs_annuelles</code> n&apos;a pas répondu
          comme attendu. Rechargez ou contactez le SCS.
        </p>
      </div>
    );
  }

  // Index par code pour faciliter le rapprochement avec les méta du référentiel.
  const valeursParCode = new Map(payload.indicateurs.map((i) => [i.code, i]));
  const configParCode = new Map(config.map((c) => [c.indicateur_code, c]));

  // Compteurs synthétiques
  const nbCalcules = payload.indicateurs.filter((i) => i.statut_calcul === 'calcule').length;
  const nbNonMesurables = payload.indicateurs.filter((i) => i.statut_calcul === 'non_mesurable').length;
  const nbAvecVisu = payload.indicateurs.filter((i) => {
    const c = configParCode.get(i.code);
    return doitAfficherVisualisation(i.nb_annees_avec_donnees, c?.visu_forcee ?? false, c?.visu_activee ?? false);
  }).length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tous les indicateurs CMR</h1>
        <p className="text-muted-foreground text-sm">
          Inventaire des 18 indicateurs du Cadre Commun de mesure du rendement, avec leurs
          valeurs annuelles (collectes {payload.annee_min} → {payload.annee_max}). Cliquez sur
          un indicateur pour voir le détail (graphique, ventilation, méthode).
        </p>
      </header>

      {/* Compteurs synthétiques */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CompteurCard
          n={payload.indicateurs.length}
          label="Indicateurs CMR"
          classe="bg-slate-50 text-slate-700 border-slate-200"
        />
        <CompteurCard
          n={nbCalcules}
          label="Calculés depuis BDD"
          classe="bg-emerald-50 text-emerald-700 border-emerald-200"
        />
        <CompteurCard
          n={nbNonMesurables}
          label="En attente de collecte"
          classe="bg-amber-50 text-amber-700 border-amber-200"
        />
        <CompteurCard
          n={nbAvecVisu}
          label="Visualisation activée"
          classe="bg-purple-50 text-purple-700 border-purple-200"
        />
      </div>

      {/* Tableau par pilier */}
      {(Object.keys(PILIERS) as CodePilier[]).map((codePilier) => {
        const pilier = PILIERS[codePilier];
        const indicateursPilier = INDICATEURS.filter((i) => i.pilier === codePilier);

        return (
          <section key={codePilier} className="space-y-2">
            <div
              className="flex items-center gap-3 rounded-lg px-4 py-2.5"
              style={{
                backgroundColor: `${pilier.couleur}10`,
                borderLeft: `3px solid ${pilier.couleur}`,
              }}
            >
              <span
                className="inline-flex size-7 items-center justify-center rounded text-xs font-bold text-white"
                style={{ backgroundColor: pilier.couleur }}
              >
                {codePilier}
              </span>
              <p className="text-sm font-semibold" style={{ color: pilier.couleur }}>
                {pilier.sousTitre}
              </p>
              <span className="text-muted-foreground ml-auto text-xs">
                {indicateursPilier.length} indicateur{indicateursPilier.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Intitulé</th>
                    <th className="px-3 py-2 text-right">Dernière valeur</th>
                    <th className="px-3 py-2 text-center">Années</th>
                    <th className="px-3 py-2 text-center">État</th>
                    <th className="px-3 py-2 text-center">Visu</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {indicateursPilier.map((ind) => {
                    const valeurs = valeursParCode.get(ind.code);
                    const conf = configParCode.get(ind.code);
                    const visu = valeurs
                      ? doitAfficherVisualisation(
                          valeurs.nb_annees_avec_donnees,
                          conf?.visu_forcee ?? false,
                          conf?.visu_activee ?? false,
                        )
                      : false;
                    const statut = valeurs?.statut_calcul ?? 'pas_de_donnees';

                    return (
                      <tr key={ind.code} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded font-mono text-xs font-bold text-white"
                            style={{ backgroundColor: pilier.couleur }}
                          >
                            {ind.code}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-800">{ind.intitule}</p>
                          {valeurs?.mention && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                              {valeurs.mention}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                          {formaterDerniereValeur(valeurs?.derniere_valeur, ind.code)}
                          {valeurs?.derniere_annee && (
                            <div className="text-muted-foreground text-[10px]">
                              ({valeurs.derniere_annee})
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-mono text-xs tabular-nums">
                            {valeurs?.nb_annees_avec_donnees ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <BadgeStatut statut={statut} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {visu ? (
                            <Badge
                              variant="outline"
                              className="border-purple-200 text-[10px] text-purple-700"
                            >
                              <BarChart3 className="mr-1 size-3" aria-hidden />
                              On
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-400">
                              Off
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Link
                            href={`/indicateurs/${ind.code.toLowerCase()}`}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            Détail
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
        );
      })}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Lecture du tableau</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            « État » : <strong>Calculé</strong> = valeur extraite des tables sources ;{' '}
            <strong>En attente</strong> = collecte d&apos;enquêtes pas encore opérationnelle ;{' '}
            <strong>Pas de données</strong> = aucune ligne sur la période 2020-{payload.annee_max}.
          </li>
          <li>
            « Visu » : graphique activé automatiquement à partir de 2 années de collecte. Le
            super_admin peut forcer l&apos;activation/désactivation via la page de détail.
          </li>
          <li>
            Le périmètre des données dépend de votre rôle : admin_scs et super_admin voient tout,
            les autres rôles voient uniquement les projets qu&apos;ils gèrent.
          </li>
        </ul>
      </div>
    </div>
  );
}

function CompteurCard({ n, label, classe }: { n: number; label: string; classe: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${classe}`}>
      <div className="text-2xl font-bold tabular-nums">{n}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function BadgeStatut({ statut }: { statut: 'calcule' | 'non_mesurable' | 'pas_de_donnees' }) {
  if (statut === 'calcule') {
    return (
      <Badge className="bg-emerald-50 text-[10px] text-emerald-700 hover:bg-emerald-50">
        <CheckCircle2 className="mr-1 size-3" aria-hidden />
        Calculé
      </Badge>
    );
  }
  if (statut === 'non_mesurable') {
    return (
      <Badge variant="outline" className="border-amber-200 text-[10px] text-amber-700">
        <Clock className="mr-1 size-3" aria-hidden />
        En attente
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">
      Pas de données
    </Badge>
  );
}

/**
 * Formate la dernière valeur selon le type d'indicateur :
 *   - A2 (taux d'achèvement) : %
 *   - B4 (volume €) : montant arrondi en milliers
 *   - autres : entier
 */
function formaterDerniereValeur(valeur: number | null | undefined, code: string): string {
  if (valeur === null || valeur === undefined) return '—';
  if (code === 'A2') return `${valeur.toFixed(1)} %`;
  if (code === 'B4') return `${valeur.toLocaleString('fr-FR')} €`;
  return valeur.toLocaleString('fr-FR');
}
