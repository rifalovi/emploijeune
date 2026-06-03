'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publierIndicateurs } from '@/lib/collecte-analytique/actions';
import type { ValeurIndicateur, ValeurPubliee } from '@/lib/collecte-analytique/actions';
import type { Indicateur } from '@/lib/referentiels/indicateurs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, RefreshCw, Upload, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

const PILIER_COLORS: Record<string, string> = {
  A: 'bg-[#0E4F88] text-white',
  B: 'bg-[#7EB301] text-white',
  C: 'bg-[#5D0073] text-white',
  D: 'bg-[#0198E9] text-white',
  F: 'bg-[#F5A623] text-white',
};

function formatValeur(v: number | null, indicateur: Indicateur): string {
  if (v === null || v === undefined) return '—';
  if (indicateur.unitePrincipale === '%') return `${v}%`;
  return v.toLocaleString('fr-FR');
}

function StatutBadge({ calculee, publiee }: { calculee: ValeurIndicateur | undefined; publiee: ValeurPubliee | undefined }) {
  if (!calculee) {
    return <Badge variant="outline" className="text-slate-500 border-slate-200">Non disponible</Badge>;
  }
  if (!publiee?.publiee_at) {
    return <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Non publiée</Badge>;
  }
  const calcDate = new Date(calculee.calculee_at);
  const pubDate = new Date(publiee.publiee_at);
  if (calcDate > pubDate) {
    return <Badge variant="outline" className="text-orange-700 border-orange-200 bg-orange-50">Mise à jour disponible</Badge>;
  }
  return <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50"><CheckCircle2 className="size-3 mr-1" />À jour</Badge>;
}

type Props = {
  indicateurs: Indicateur[];
  calculees: ValeurIndicateur[];
  publiees: ValeurPubliee[];
};

export function IndicateursClient({ indicateurs, calculees, publiees }: Props) {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const calcMap = new Map(calculees.map((c) => [c.indicateur_code, c]));
  const pubMap = new Map(publiees.map((p) => [p.indicateur_code, p]));

  const disponibles = indicateurs.filter((i) => calcMap.has(i.code));
  const nonDisponibles = indicateurs.filter((i) => !calcMap.has(i.code));

  function toggleSelection(code: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  function toutSelectionner() {
    if (selection.size === disponibles.length) {
      setSelection(new Set());
    } else {
      setSelection(new Set(disponibles.map((i) => i.code)));
    }
  }

  function publier() {
    if (selection.size === 0) return;
    startTransition(async () => {
      const res = await publierIndicateurs(Array.from(selection));
      if (res.status === 'succes') {
        toast.success(`${res.nb} indicateur${res.nb > 1 ? 's' : ''} publié${res.nb > 1 ? 's' : ''}`);
        setSelection(new Set());
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const groupes: Record<string, Indicateur[]> = {};
  for (const ind of indicateurs) {
    if (!groupes[ind.pilier]) groupes[ind.pilier] = [];
    (groupes[ind.pilier] as Indicateur[]).push(ind);
  }

  return (
    <div className="space-y-6">
      {/* Barre d'actions */}
      <div className="flex items-center gap-3 rounded-lg border bg-slate-50 px-4 py-3">
        <Button variant="outline" size="sm" onClick={toutSelectionner}>
          {selection.size === disponibles.length ? 'Tout désélectionner' : 'Tout sélectionner'}
        </Button>
        <span className="text-muted-foreground text-sm">{selection.size} sélectionné{selection.size > 1 ? 's' : ''}</span>
        <Button
          size="sm"
          disabled={selection.size === 0 || isPending}
          onClick={publier}
          className="ml-auto gap-2"
        >
          {isPending ? <RefreshCw className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {isPending ? 'Publication…' : 'Publier la sélection'}
        </Button>
      </div>

      {/* Indicateurs disponibles */}
      {Object.entries(groupes).map(([pilier, inds]) => (
        <Card key={pilier}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${PILIER_COLORS[pilier]}`}>
                Catégorie {pilier}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-8"></th>
                  <th className="px-3 py-2 text-left font-medium">Indicateur</th>
                  <th className="px-3 py-2 text-right font-medium">Valeur calculée</th>
                  <th className="px-3 py-2 text-right font-medium">Valeur publiée</th>
                  <th className="px-3 py-2 text-left font-medium">Dernière publication</th>
                  <th className="px-3 py-2 text-left font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inds.map((ind) => {
                  const calc = calcMap.get(ind.code);
                  const pub = pubMap.get(ind.code);
                  const disponible = !!calc;

                  return (
                    <tr
                      key={ind.code}
                      className={`transition-colors ${disponible ? 'hover:bg-muted/30 cursor-pointer' : 'opacity-50'} ${selection.has(ind.code) ? 'bg-blue-50' : ''}`}
                      onClick={() => disponible && toggleSelection(ind.code)}
                    >
                      <td className="px-3 py-2.5">
                        {disponible ? (
                          <input
                            type="checkbox"
                            checked={selection.has(ind.code)}
                            onChange={() => toggleSelection(ind.code)}
                            className="rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <Info className="size-4 text-slate-300" />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">{ind.code}</span>
                          <span className="text-slate-700">{ind.intitule}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        {calc ? (
                          <span>
                            {formatValeur(calc.valeur_numerique, ind)}
                            {calc.valeur_detail?.taux_femmes !== undefined && (
                              <span className="text-muted-foreground ml-1 text-xs">({String(calc.valeur_detail.taux_femmes)}% F)</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-muted-foreground px-3 py-2.5 text-right">
                        {pub ? formatValeur(pub.valeur_numerique, ind) : '—'}
                      </td>
                      <td className="text-muted-foreground px-3 py-2.5 text-xs">
                        {pub?.publiee_at
                          ? new Date(pub.publiee_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatutBadge calculee={calc} publiee={pub} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      {/* Légende indicateurs non calculables */}
      {nonDisponibles.length > 0 && (
        <div className="rounded-lg border border-dashed p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-600">
                {nonDisponibles.length} indicateur{nonDisponibles.length > 1 ? 's' : ''} nécessitent des données de suivi
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {nonDisponibles.map((i) => `${i.code} (${i.intitule})`).join(' · ')}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Ces indicateurs (taux, scores, effets qualitatifs) seront calculables une fois
                les données d'enquêtes de suivi collectées via les formulaires C et D.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
