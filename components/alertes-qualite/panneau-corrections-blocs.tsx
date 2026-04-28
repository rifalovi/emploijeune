'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  analyserAlertesParBlocs,
  appliquerBloc,
  genererCorrectionsBloc,
} from '@/lib/alertes-qualite/blocs-actions';
import type { AnalyseParBlocs, BlocCorrection } from '@/lib/alertes-qualite/blocs-types';
import { cn } from '@/lib/utils';

const TYPES_CORRIGEABLES = new Set([
  'date_naissance_manquante',
  'consentement_sans_date',
  'statut_acheve_sans_date_fin',
  'subvention_sans_montant',
]);

/**
 * Panneau sticky de corrections par blocs IA — V2.2.1.
 *
 * Workflow :
 *   1. Carlos sélectionne un type d'alerte (filtre URL)
 *   2. Clic « Analyse IA » → server action `analyserAlertesParBlocs`
 *   3. Affichage des blocs avec confiance, échantillon, cas concernés
 *   4. Carlos coche/décoche les blocs à appliquer
 *   5. Clic « Appliquer » → pour chaque bloc coché : génération des
 *      corrections (server-side) + application via UPDATE en BDD
 *   6. Audit log automatique
 */
export function PanneauCorrectionsBlocs({ typeAlerte }: { typeAlerte: string }) {
  const router = useRouter();
  const [analyse, setAnalyse] = useState<AnalyseParBlocs | null>(null);
  const [blocsCoches, setBlocsCoches] = useState<Set<string>>(new Set());
  const [blocsExpanded, setBlocsExpanded] = useState<Set<string>>(new Set());
  const [pendingAnalyse, startAnalyse] = useTransition();
  const [pendingApply, startApply] = useTransition();

  const peutAnalyser = TYPES_CORRIGEABLES.has(typeAlerte);

  const onAnalyser = () => {
    setAnalyse(null);
    setBlocsCoches(new Set());
    startAnalyse(async () => {
      const res = await analyserAlertesParBlocs({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type_alerte: typeAlerte as any,
      });
      if (res.status === 'erreur') {
        toast.error(res.message);
        return;
      }
      setAnalyse(res.analyse);
      // Auto-expand le 1er bloc
      if (res.analyse.blocs[0]) {
        setBlocsExpanded(new Set([res.analyse.blocs[0].id]));
      }
    });
  };

  const toggleBloc = (id: string) => {
    setBlocsCoches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setBlocsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onAppliquer = () => {
    if (!analyse) return;
    const blocsAAppliquer = analyse.blocs.filter((b) => blocsCoches.has(b.id));
    if (blocsAAppliquer.length === 0) {
      toast.error('Cochez au moins un bloc avant d\u2019appliquer.');
      return;
    }
    const totalCorrections = blocsAAppliquer.reduce((s, b) => s + b.cas_concernes, 0);
    const confirme = confirm(
      `Appliquer ${blocsAAppliquer.length} bloc(s) — ${totalCorrections} correction(s) au total ?\n\n` +
        'Les modifications seront journalisées dans le journal d\u2019audit.',
    );
    if (!confirme) return;

    startApply(async () => {
      let totalAppliquees = 0;
      let totalErreurs = 0;
      for (const bloc of blocsAAppliquer) {
        // 1. Génération côté serveur des corrections individuelles
        const gen = await genererCorrectionsBloc({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type_alerte: typeAlerte as any,
          bloc,
        });
        if (gen.status === 'erreur') {
          toast.error(`Bloc ${bloc.titre} : ${gen.message}`);
          continue;
        }
        // 2. Application en BDD
        const app = await appliquerBloc({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type_alerte: typeAlerte as any,
          bloc: gen.bloc,
        });
        if (app.status === 'erreur') {
          toast.error(`Bloc ${bloc.titre} : ${app.message}`);
          continue;
        }
        totalAppliquees += app.nb_appliquees;
        totalErreurs += app.nb_erreurs;
      }
      if (totalErreurs === 0) {
        toast.success(`${totalAppliquees} correction(s) appliquée(s) avec succès.`);
      } else {
        toast.warning(
          `${totalAppliquees} appliquée(s) · ${totalErreurs} erreur(s) — voir le journal d\u2019audit.`,
        );
      }
      setAnalyse(null);
      setBlocsCoches(new Set());
      router.refresh();
    });
  };

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex size-8 items-center justify-center rounded-lg text-white"
            style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
          >
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base">Corrections par blocs IA</CardTitle>
            <CardDescription>
              {peutAnalyser
                ? 'Claude analyse l\u2019échantillon et propose des blocs de correction homogènes.'
                : 'Sélectionnez un type d\u2019alerte ci-contre pour démarrer.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={onAnalyser}
          disabled={pendingAnalyse || !peutAnalyser}
          className="w-full gap-1.5"
          size="sm"
        >
          {pendingAnalyse ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {pendingAnalyse ? 'Analyse en cours…' : 'Demander une analyse IA'}
        </Button>

        {analyse && (
          <div className="space-y-3">
            <ul className="space-y-3">
              {analyse.blocs.map((b, idx) => (
                <BlocCard
                  key={b.id}
                  bloc={b}
                  index={idx}
                  coche={blocsCoches.has(b.id)}
                  expanded={blocsExpanded.has(b.id)}
                  onToggleCoche={() => toggleBloc(b.id)}
                  onToggleExpand={() => toggleExpand(b.id)}
                />
              ))}
            </ul>

            {analyse.cas_residuels > 0 && (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs">
                <p className="font-semibold text-slate-700">
                  {analyse.cas_residuels} cas non corrigeables automatiquement
                </p>
                <p className="text-muted-foreground mt-1">
                  {analyse.recommandation_residus ?? 'Saisie manuelle recommandée pour ces cas.'}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
              <p className="text-muted-foreground text-xs">
                {blocsCoches.size} bloc(s) sélectionné(s) sur {analyse.blocs.length}
              </p>
              <Button
                onClick={onAppliquer}
                disabled={pendingApply || blocsCoches.size === 0}
                className="w-full gap-1.5"
                size="sm"
                variant={blocsCoches.size > 0 ? 'default' : 'outline'}
              >
                {pendingApply ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden />
                )}
                {pendingApply ? 'Application…' : 'Appliquer les blocs cochés'}
              </Button>
            </div>
          </div>
        )}

        <p className="text-muted-foreground mt-3 text-[11px] italic">
          Limite 5 000 corrections par bloc. Audit log automatique. Pas de rollback automatique en
          V2.2.1.
        </p>
      </CardContent>
    </Card>
  );
}

function BlocCard({
  bloc,
  index,
  coche,
  expanded,
  onToggleCoche,
  onToggleExpand,
}: {
  bloc: BlocCorrection;
  index: number;
  coche: boolean;
  expanded: boolean;
  onToggleCoche: () => void;
  onToggleExpand: () => void;
}) {
  const couleurConfiance =
    bloc.confiance >= 75 ? '#7eb301' : bloc.confiance >= 50 ? '#F5A623' : '#dc2626';

  return (
    <li
      className={cn(
        'rounded-md border bg-white p-3 transition-all',
        coche ? 'border-[#0E4F88] shadow-md' : 'border-slate-200',
      )}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={coche}
          onChange={onToggleCoche}
          className="mt-1 size-4 cursor-pointer rounded border-slate-300 text-[#0E4F88] focus:ring-[#0E4F88]"
          aria-label={`Sélectionner le bloc ${bloc.titre}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
            <h3 className="text-sm font-semibold text-slate-900">{bloc.titre}</h3>
            <Badge
              variant="outline"
              className="text-[10px] tabular-nums"
              style={{ borderColor: `${couleurConfiance}66`, color: couleurConfiance }}
            >
              {bloc.confiance}% confiance
            </Badge>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {bloc.cas_concernes.toLocaleString('fr-FR')} cas
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-slate-600">{bloc.description}</p>

          <button
            type="button"
            onClick={onToggleExpand}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#0E4F88] hover:underline"
          >
            {expanded ? (
              <ChevronUp className="size-3" aria-hidden />
            ) : (
              <ChevronDown className="size-3" aria-hidden />
            )}
            {expanded ? 'Masquer le détail' : 'Voir logique + échantillon'}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2 rounded bg-slate-50 p-2 text-[11px]">
              <div>
                <p className="font-semibold text-slate-700">Logique d&apos;extrapolation :</p>
                <p className="mt-0.5 text-slate-600">{bloc.logique}</p>
              </div>
              {bloc.echantillon.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700">
                    Échantillon ({bloc.echantillon.length} exemple
                    {bloc.echantillon.length > 1 ? 's' : ''}) :
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {bloc.echantillon.map((c, i) => (
                      <li key={i} className="font-mono text-slate-600">
                        • {c.entite_nom} → <strong>{c.nouvelle_valeur}</strong>
                        {c.contexte && (
                          <span className="text-muted-foreground"> ({c.contexte})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function CtaIaIndisponible() {
  return (
    <Card>
      <CardContent className="text-muted-foreground p-6 text-center text-sm italic">
        <XCircle className="mx-auto mb-2 size-6 opacity-50" aria-hidden />
        Module IA non activé pour votre rôle. Demandez l&apos;activation au super_admin.
      </CardContent>
    </Card>
  );
}
