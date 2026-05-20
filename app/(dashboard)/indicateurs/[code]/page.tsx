import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BarChart3, CheckCircle2, Clock, Info } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { indicateurParCode, PILIERS, type CodePilier } from '@/lib/referentiels/indicateurs';
import {
  getIndicateursAnnuels,
  getConfigIndicateurs,
  getSaisiesIndicateur,
} from '@/lib/indicateurs-annuels/queries';
import { getKpisContexte, getKpisContexteAuto, mergerKpisContexte } from '@/lib/realisations/queries';
import {
  doitAfficherVisualisation,
  type IndicateurAvecValeurs,
} from '@/lib/indicateurs-annuels/types';
import { Badge } from '@/components/ui/badge';
import { GrapheIndicateurAnnuel } from './graphe-client';
import { ToggleVisuClient } from './toggle-visu-client';
import { SaisieValeursClient } from './saisie-valeurs-client';
import { SaisieContexteKpisClient } from './saisie-contexte-kpis-client';

/** Indicateurs de type "taux" : nécessitent numérateur + dénominateur. */
const INDICATEURS_TAUX = new Set(['A2', 'A3', 'A5', 'B2', 'C2', 'C5', 'D3']);

const INDICATEUR_TYPE_MAP: Record<string, 'count' | 'rate' | 'score' | 'amount'> = {
  A1: 'count', A2: 'rate', A3: 'rate', A4: 'score', A5: 'rate',
  B1: 'count', B2: 'rate', B3: 'count', B4: 'amount',
  C1: 'count', C2: 'rate', C3: 'count', C4: 'count', C5: 'rate',
  D1: 'count', D2: 'count', D3: 'rate', F1: 'count',
};

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const ind = indicateurParCode(code);
  return {
    title: ind ? `${ind.code} – ${ind.intitule}` : 'Indicateur introuvable',
  };
}

export const dynamic = 'force-dynamic';

export default async function IndicateurDetailPage({ params }: Props) {
  const utilisateur = await requireUtilisateurValide();
  const { code: codeBrut } = await params;
  const ind = indicateurParCode(codeBrut);
  if (!ind) notFound();

  const [payload, config, saisiesBrutes, kpisContexte, kpisAuto] = await Promise.all([
    getIndicateursAnnuels(),
    getConfigIndicateurs(),
    getSaisiesIndicateur(ind.code),
    getKpisContexte(ind.code),
    getKpisContexteAuto(ind.code),
  ]);

  // Fusion auto + manuel : reflète exactement ce qui est affiché sur le front public.
  // Utilisé comme valeurs initiales du formulaire KPIs contextuels pour que l'admin
  // voie et puisse ajuster ce qui est actuellement visible.
  const kpisMerges = mergerKpisContexte(kpisAuto, kpisContexte);

  if (!payload) {
    return <p className="text-sm text-amber-700">Impossible de charger les indicateurs.</p>;
  }

  const valeurs: IndicateurAvecValeurs | undefined = payload.indicateurs.find(
    (i) => i.code === ind.code,
  );
  if (!valeurs) notFound();

  const pilier = PILIERS[ind.pilier as CodePilier];
  const conf = config.find((c) => c.indicateur_code === ind.code);
  const visuActive = doitAfficherVisualisation(
    valeurs.nb_annees_avec_donnees,
    conf?.visu_forcee ?? false,
    conf?.visu_activee ?? false,
  );
  const isSuperAdmin = utilisateur.role === 'super_admin';

  /**
   * Calcule les valeurs à afficher dans le graphique et le tableau récapitulatif.
   *
   * Règles :
   *  - saisie_manuelle : la RPC fournit déjà les saisies dans valeurs_par_annee → on retourne tel quel.
   *  - calcule (ex. A2) : les saisies manuelles sont prioritaires sur les valeurs auto BDD.
   *  - non_mesurable / pas_de_donnees avec saisies → on affiche directement les saisies
   *    (cas où l'admin saisit des données avant que la collecte auto soit en place).
   *  - Aucune saisie → valeurs_par_annee inchangé (peut être vide).
   */
  const valeursFinales: typeof valeurs.valeurs_par_annee = (() => {
    // Cas saisie_manuelle : la RPC renvoie déjà les bonnes valeurs
    if (valeurs.statut_calcul === 'saisie_manuelle') {
      return valeurs.valeurs_par_annee;
    }
    // Pas de saisies brutes → rien à fusionner
    if (saisiesBrutes.length === 0) {
      return valeurs.valeurs_par_annee;
    }
    // non_mesurable / pas_de_donnees AVEC saisies → les saisies deviennent les valeurs
    if (valeurs.statut_calcul !== 'calcule') {
      return saisiesBrutes
        .map((s) => ({
          annee: s.annee,
          valeur:
            s.numerateur !== null && s.denominateur !== null && s.denominateur !== 0
              ? Math.round((s.numerateur / s.denominateur) * 1000) / 10
              : s.valeur_directe,
          numerateur: s.numerateur,
          denominateur: s.denominateur,
          source: 'saisie' as const,
          publie: s.publie,
        }))
        .sort((a, b) => a.annee - b.annee);
    }
    // calcule (ex. A2) : les saisies priment sur l'auto BDD
    const saisiesMap = new Map(saisiesBrutes.map((s) => [s.annee, s]));
    const merged = valeurs.valeurs_par_annee.map((v) => {
      const s = saisiesMap.get(v.annee);
      if (!s) return v;
      const valeurCalculee =
        s.numerateur !== null && s.denominateur !== null && s.denominateur !== 0
          ? Math.round((s.numerateur / s.denominateur) * 1000) / 10
          : (s.valeur_directe ?? v.valeur);
      return {
        ...v,
        valeur: valeurCalculee,
        numerateur: s.numerateur ?? v.numerateur,
        denominateur: s.denominateur ?? v.denominateur,
        source: 'saisie' as const,
      };
    });
    // Ajouter les années présentes uniquement en saisie (pas encore en BDD)
    const anneesAuto = new Set(valeurs.valeurs_par_annee.map((v) => v.annee));
    const extra = saisiesBrutes
      .filter((s) => !anneesAuto.has(s.annee))
      .map((s) => ({
        annee: s.annee,
        valeur:
          s.numerateur !== null && s.denominateur !== null && s.denominateur !== 0
            ? Math.round((s.numerateur / s.denominateur) * 1000) / 10
            : s.valeur_directe,
        numerateur: s.numerateur,
        denominateur: s.denominateur,
        source: 'saisie' as const,
        publie: s.publie,
      }));
    return [...merged, ...extra].sort((a, b) => a.annee - b.annee);
  })();

  return (
    <div className="space-y-6">
      <Link
        href="/indicateurs"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-slate-700"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à la liste
      </Link>

      {/* Bandeau indicateur */}
      <header
        className="rounded-2xl p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${pilier.couleur} 0%, ${pilier.couleur}cc 100%)`,
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-white/20 text-xs text-white">{ind.code}</Badge>
          <Badge variant="outline" className="border-white/30 bg-white/10 text-xs text-white">
            Pilier {ind.pilier} — {pilier.sousTitre}
          </Badge>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{ind.intitule}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/90">{ind.definition}</p>
      </header>

      {/* Statut + visualisation */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CarteStatut valeurs={valeurs} />
        <CarteAnnees nbAnnees={valeurs.nb_annees_avec_donnees} />
        <CarteVisu actif={visuActive} forcee={conf?.visu_forcee ?? false} />
      </section>

      {/* Toggle super_admin */}
      {isSuperAdmin && (
        <ToggleVisuClient
          code={ind.code}
          visuActiveeInit={conf?.visu_activee ?? false}
          visuForceeInit={conf?.visu_forcee ?? false}
          nbAnnees={valeurs.nb_annees_avec_donnees}
        />
      )}

      {/* Saisie manuelle des valeurs — admin_scs / super_admin */}
      {(utilisateur.role === 'admin_scs' || isSuperAdmin) && (
        <SaisieValeursClient
          code={ind.code}
          valeursExistantes={valeurs.valeurs_par_annee}
          saisiesBrutes={saisiesBrutes}
          estTaux={INDICATEURS_TAUX.has(ind.code)}
          anneeMin={payload.annee_min}
          anneeMax={payload.annee_max}
          anneesMasquees={conf?.annees_masquees ?? []}
        />
      )}

      {/* KPIs contextuels pour la page publique Réalisations — admin_scs / super_admin */}
      {(utilisateur.role === 'admin_scs' || isSuperAdmin) && (
        <SaisieContexteKpisClient
          code={ind.code}
          typeInd={INDICATEUR_TYPE_MAP[ind.code] ?? 'count'}
          afficherVentilateur={ind.afficherVentilateurPersonne ?? true}
          kpisInit={kpisContexte}
          kpisMerges={kpisMerges}
          estAutoBDD={ind.code === 'A1' || ind.code === 'B1'}
        />
      )}

      {/* Graphique (si valeurs et visu activée) */}
      {valeursFinales.length > 0 && visuActive && (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-[#0E4F88]">Évolution annuelle</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Visualisation des {valeursFinales.length} années de collecte disponibles.
          </p>
          <GrapheIndicateurAnnuel
            code={ind.code}
            valeurs={valeursFinales}
            couleur={pilier.couleur}
          />
        </section>
      )}

      {/* Tableau valeurs par année */}
      {valeursFinales.length > 0 && (
        <section className="rounded-xl border bg-white">
          <header className="border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold text-[#0E4F88]">Valeurs par année</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Année</th>
                  <th className="px-3 py-2 text-right">Valeur</th>
                  {valeursFinales.some((v) => v.numerateur !== undefined) && (
                    <th className="px-3 py-2 text-right">Numérateur</th>
                  )}
                  {valeursFinales.some((v) => v.denominateur !== undefined) && (
                    <th className="px-3 py-2 text-right">Dénominateur</th>
                  )}
                  {valeursFinales.some((v) => v.femmes !== undefined) && (
                    <>
                      <th className="px-3 py-2 text-right">Femmes</th>
                      <th className="px-3 py-2 text-right">Hommes</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {valeursFinales.map((v) => (
                  <tr key={v.annee}>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums">{v.annee}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formaterValeur(v.valeur, ind.code)}
                    </td>
                    {valeursFinales.some((x) => x.numerateur !== undefined) && (
                      <td className="px-3 py-2 text-right tabular-nums">{v.numerateur ?? '—'}</td>
                    )}
                    {valeursFinales.some((x) => x.denominateur !== undefined) && (
                      <td className="px-3 py-2 text-right tabular-nums">{v.denominateur ?? '—'}</td>
                    )}
                    {valeursFinales.some((x) => x.femmes !== undefined) && (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">{v.femmes ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{v.hommes ?? '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Métadonnées CMR */}
      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-[#0E4F88]">Méthode (CMR V2)</h2>
        <dl className="mt-3 space-y-2 text-xs">
          <Defi label="Méthode de calcul" valeur={ind.calcul} />
          <Defi label="Collecte" valeur={ind.collecte} />
          <Defi label="Fréquence" valeur={ind.frequence} />
          <Defi label="Variables" valeur={ind.variables.join(' · ')} />
          <Defi label="Sources" valeur={ind.sources.join(' · ')} />
          <Defi label="Projets concernés" valeur={ind.projetsConcernes.join(', ')} />
        </dl>
      </section>

      {valeurs.statut_calcul === 'non_mesurable' && valeurs.mention && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <Info className="size-4" aria-hidden />
            Pourquoi cet indicateur n&apos;est pas encore mesurable
          </p>
          <p className="mt-2">{valeurs.mention}</p>
        </div>
      )}
    </div>
  );
}

function CarteStatut({ valeurs }: { valeurs: IndicateurAvecValeurs }) {
  const map = {
    calcule: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      icone: <CheckCircle2 className="size-4" aria-hidden />,
      libelle: 'Calculé depuis BDD',
    },
    saisie_manuelle: {
      bg: 'bg-blue-50 border-blue-200 text-blue-700',
      icone: <CheckCircle2 className="size-4" aria-hidden />,
      libelle: 'Saisie manuelle',
    },
    non_mesurable: {
      bg: 'bg-amber-50 border-amber-200 text-amber-700',
      icone: <Clock className="size-4" aria-hidden />,
      libelle: 'En attente de collecte',
    },
    pas_de_donnees: {
      bg: 'bg-slate-50 border-slate-200 text-slate-500',
      icone: <Info className="size-4" aria-hidden />,
      libelle: 'Pas de données',
    },
  } as const;
  const cfg = map[valeurs.statut_calcul];
  return (
    <div className={`rounded-lg border px-4 py-3 ${cfg.bg}`}>
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        {cfg.icone}
        Statut
      </p>
      <p className="mt-1 text-sm font-medium">{cfg.libelle}</p>
    </div>
  );
}

function CarteAnnees({ nbAnnees }: { nbAnnees: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
      <p className="text-xs font-semibold tracking-wide uppercase">Années collectées</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{nbAnnees}</p>
    </div>
  );
}

function CarteVisu({ actif, forcee }: { actif: boolean; forcee: boolean }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${actif ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
    >
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        <BarChart3 className="size-4" aria-hidden />
        Visualisation
      </p>
      <p className="mt-1 text-sm font-medium">
        {actif ? 'Activée' : 'Désactivée'}
        {forcee && <span className="ml-1 text-[10px]">(forcée)</span>}
      </p>
    </div>
  );
}

function Defi({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-44 shrink-0 font-medium text-slate-500">{label}</dt>
      <dd className="text-slate-700">{valeur}</dd>
    </div>
  );
}

function formaterValeur(valeur: number | null, code: string): string {
  if (valeur === null) return '—';
  if (code === 'A2') return `${valeur.toFixed(1)} %`;
  if (code === 'B4') return `${valeur.toLocaleString('fr-FR')} €`;
  return valeur.toLocaleString('fr-FR');
}
