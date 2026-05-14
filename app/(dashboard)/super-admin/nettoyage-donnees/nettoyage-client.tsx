'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ScanSearch,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { scannerValeursParasites, nettoyerValeursParasites } from '@/lib/nettoyage/server-actions';
import type { RapportScan, RapportNettoyage } from '@/lib/imports/normalizer-garbage';

type Etape = 'idle' | 'scan_en_cours' | 'scan_ok' | 'nettoyage_en_cours' | 'nettoye';

export function NettoyageClient() {
  const [etape, setEtape] = useState<Etape>('idle');
  const [rapport, setRapport] = useState<RapportScan | null>(null);
  const [rapportFinal, setRapportFinal] = useState<RapportNettoyage | null>(null);
  const [showExemples, setShowExemples] = useState(false);
  const [pending, startTransition] = useTransition();

  // ─── Scan ───────────────────────────────────────────────────────────────────

  const handleScan = () => {
    setEtape('scan_en_cours');
    setRapport(null);
    setRapportFinal(null);
    startTransition(async () => {
      const res = await scannerValeursParasites();
      if (res.status === 'erreur') {
        toast.error(`Échec du scan : ${res.message}`);
        setEtape('idle');
        return;
      }
      setRapport(res.rapport);
      setEtape('scan_ok');
    });
  };

  // ─── Nettoyage ──────────────────────────────────────────────────────────────

  const handleNettoyer = () => {
    if (!confirm('Confirmer le nettoyage ? Les valeurs parasites seront remplacées par des champs vides. Cette opération est irréversible.')) {
      return;
    }
    setEtape('nettoyage_en_cours');
    startTransition(async () => {
      const res = await nettoyerValeursParasites({});
      if (res.status === 'erreur') {
        toast.error(`Échec du nettoyage : ${res.message}`);
        setEtape('scan_ok');
        return;
      }
      setRapportFinal(res.rapport);
      setEtape('nettoye');
      toast.success(
        `✅ ${res.rapport.nb_champs_nettoyes} champ(s) nettoyé(s) sur ${res.rapport.nb_enregistrements_affectes} enregistrement(s).`,
      );
    });
  };

  // ─── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* En-tête explicatif */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
        <div className="text-sm text-amber-900">
          <p className="font-medium">Qu'est-ce qu'une valeur parasite ?</p>
          <p className="mt-1 text-amber-800">
            Lors des imports Excel, certaines cellules contiennent des placeholders sans valeur
            métier : <code className="rounded bg-amber-100 px-1 text-xs">ZZZ</code>,{' '}
            <code className="rounded bg-amber-100 px-1 text-xs">N/A</code>,{' '}
            <code className="rounded bg-amber-100 px-1 text-xs">---</code>,{' '}
            <code className="rounded bg-amber-100 px-1 text-xs">xxx</code>,{' '}
            <code className="rounded bg-amber-100 px-1 text-xs">inconnu</code>,{' '}
            <code className="rounded bg-amber-100 px-1 text-xs">000</code>, etc. Ces valeurs
            polluent les filtres, les statistiques et les exports. Cette page permet de les
            identifier et de les remplacer par des champs vides (<em>null</em>).
          </p>
        </div>
      </div>

      {/* Bouton Scanner */}
      {etape === 'idle' && (
        <Button onClick={handleScan} disabled={pending} className="gap-2">
          <ScanSearch className="size-4" aria-hidden />
          Lancer le scan de la base de données
        </Button>
      )}

      {/* En cours de scan */}
      {etape === 'scan_en_cours' && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Analyse en cours… cela peut prendre quelques secondes.
        </div>
      )}

      {/* Résultats du scan */}
      {etape === 'scan_ok' && rapport && (
        <div className="space-y-4">
          {rapport.total_parasites === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
              <span>
                <strong>Aucune valeur parasite détectée.</strong> La base de données est propre !
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Résumé */}
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-red-600" aria-hidden />
                  <p className="font-semibold text-red-900">
                    {rapport.total_parasites} valeur(s) parasite(s) détectée(s)
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(Object.entries(rapport.par_table) as [string, number][])
                    .filter(([, n]) => n > 0)
                    .map(([table, n]) => (
                      <Badge key={table} variant="outline" className="text-xs text-red-700 border-red-300">
                        {table} : {n}
                      </Badge>
                    ))}
                </div>

                {/* Détail par champ */}
                {Object.keys(rapport.par_champ).length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-red-800 mb-1.5">
                      Répartition par champ :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.entries(rapport.par_champ) as [string, number][])
                        .sort(([, a], [, b]) => b - a)
                        .map(([champ, n]) => (
                          <Badge
                            key={champ}
                            variant="outline"
                            className="font-mono text-[11px] border-red-200 text-red-700"
                          >
                            {champ} ({n})
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Exemples */}
              <div className="rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setShowExemples((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span>
                    Aperçu des valeurs détectées ({Math.min(rapport.exemples.length, 200)}{' '}
                    sur {rapport.total_parasites})
                  </span>
                  {showExemples ? (
                    <ChevronUp className="size-4" aria-hidden />
                  ) : (
                    <ChevronDown className="size-4" aria-hidden />
                  )}
                </button>

                {showExemples && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Table</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Champ</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Valeur actuelle</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rapport.exemples.map((ex, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-mono text-slate-700">{ex.table}</td>
                            <td className="px-3 py-1.5 font-mono text-slate-600">{ex.champ}</td>
                            <td className="px-3 py-1.5">
                              <code className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                                {ex.valeur_actuelle}
                              </code>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-slate-400 text-[10px]">
                              {ex.id.slice(0, 8)}…
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleScan}
                  disabled={pending}
                  className="gap-1.5"
                >
                  <ScanSearch className="size-3.5" aria-hidden />
                  Re-scanner
                </Button>
                <Button
                  size="sm"
                  onClick={handleNettoyer}
                  disabled={pending}
                  className="gap-1.5 bg-red-600 hover:bg-red-700"
                >
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-3.5" aria-hidden />
                  )}
                  {pending ? 'Nettoyage en cours…' : `Nettoyer ${rapport.total_parasites} valeur(s)`}
                </Button>
              </div>
            </div>
          )}

          {/* Re-scanner si déjà propre */}
          {rapport.total_parasites === 0 && (
            <Button variant="outline" size="sm" onClick={handleScan} disabled={pending} className="gap-1.5">
              <ScanSearch className="size-3.5" aria-hidden />
              Re-scanner
            </Button>
          )}
        </div>
      )}

      {/* En cours de nettoyage */}
      {etape === 'nettoyage_en_cours' && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Nettoyage en cours… veuillez patienter.
        </div>
      )}

      {/* Résultat final */}
      {etape === 'nettoye' && rapportFinal && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">Nettoyage terminé avec succès</p>
              <ul className="mt-1.5 space-y-0.5 text-emerald-800">
                <li>
                  <strong>{rapportFinal.nb_champs_nettoyes}</strong> champ(s) remis à vide
                </li>
                <li>
                  <strong>{rapportFinal.nb_enregistrements_affectes}</strong>{' '}
                  enregistrement(s) modifié(s)
                </li>
                {(Object.entries(rapportFinal.par_table) as [string, number][])
                  .filter(([, n]) => n > 0)
                  .map(([table, n]) => (
                    <li key={table}>
                      → <span className="font-mono">{table}</span> : {n} fiche(s)
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-xs text-emerald-700">
                L'opération a été journalisée dans les logs d'audit.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleScan} disabled={pending} className="gap-1.5">
            <ScanSearch className="size-3.5" aria-hidden />
            Nouveau scan de vérification
          </Button>
        </div>
      )}
    </div>
  );
}
