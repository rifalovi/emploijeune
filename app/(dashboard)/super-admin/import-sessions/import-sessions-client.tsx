'use client';

import { Fragment, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Trash2, FileBarChart, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SessionImport } from '@/lib/super-admin/import-sessions-actions';
import { annulerSessionImport } from '@/lib/super-admin/import-sessions-actions';

type Props = { sessions: SessionImport[] };

export function ImportSessionsClient({ sessions: initial }: Props) {
  const [sessions, setSessions] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [annulationEnCours, setAnnulationEnCours] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [confirme, setConfirme] = useState(false);
  const [detailsOuverts, setDetailsOuverts] = useState<Set<string>>(new Set());

  const basculerDetails = (id: string) => {
    setDetailsOuverts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAnnuler = (id: string) => {
    if (!confirme) return;
    startTransition(async () => {
      const res = await annulerSessionImport(id, motif || undefined);
      if (res.status === 'succes') {
        toast.success(`${res.data.lignes_supprimees} ligne(s) annulee(s).`);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, statut: 'annule_admin', lignes_reelles: 0, est_zombie: false }
              : s,
          ),
        );
        setAnnulationEnCours(null);
        setMotif('');
        setConfirme(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  const zombies = sessions.filter((s) => s.est_zombie);

  return (
    <div className="space-y-4">
      {/* Alerte zombies */}
      {zombies.length > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="size-5 shrink-0 text-orange-600" />
            <p className="text-sm text-orange-800">
              <span className="font-semibold">{zombies.length} session(s) zombie(s)</span>{' '}
              detectee(s) — imports non termines avec des lignes orphelines en base.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tableau */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Historique des imports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Fichier</th>
                  <th className="px-3 py-2 text-left">Importeur</th>
                  <th className="px-3 py-2 text-center">Statut</th>
                  <th className="px-3 py-2 text-right">Lignes BDD</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => {
                  const ouvert = detailsOuverts.has(s.id);
                  return (
                    <Fragment key={s.id}>
                      <tr
                        className={`hover:bg-slate-50 ${s.statut.includes('annule') ? 'opacity-50' : ''}`}
                      >
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-600">
                          {new Date(s.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td
                          className="max-w-[200px] truncate px-3 py-2 font-medium text-slate-800"
                          title={s.fichier_nom}
                        >
                          {s.fichier_nom}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{s.created_by_nom}</td>
                        <td className="px-3 py-2 text-center">
                          <BadgeStatut statut={s.statut} estZombie={s.est_zombie} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700">
                          {s.lignes_reelles}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => basculerDetails(s.id)}
                              aria-expanded={ouvert}
                            >
                              {ouvert ? (
                                <ChevronDown className="mr-1 size-3" />
                              ) : (
                                <ChevronRight className="mr-1 size-3" />
                              )}
                              Rapport
                            </Button>
                            {!s.statut.includes('annule') && s.lignes_reelles > 0 && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setAnnulationEnCours(s.id);
                                  setConfirme(false);
                                  setMotif('');
                                }}
                                disabled={pending}
                              >
                                <Trash2 className="mr-1 size-3" /> Annuler
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {ouvert && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={6} className="px-4 py-3">
                            <DetailRapport session={s} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal d'annulation */}
      {annulationEnCours && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="space-y-4 pt-4">
            {(() => {
              const s = sessions.find((x) => x.id === annulationEnCours);
              if (!s) return null;
              return (
                <>
                  <div className="text-sm text-red-800">
                    <p className="font-semibold">Annuler cet import ?</p>
                    <p className="mt-1">
                      Fichier : <span className="font-mono">{s.fichier_nom}</span>
                      <br />
                      Importe le {new Date(s.created_at).toLocaleString('fr-FR')} par{' '}
                      {s.created_by_nom}
                      <br />
                      <span className="font-semibold">{s.lignes_reelles} beneficiaire(s)</span>{' '}
                      seront marques supprimes (soft-delete).
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Motif (optionnel)</label>
                    <textarea
                      value={motif}
                      onChange={(e) => setMotif(e.target.value)}
                      className="mt-1 w-full rounded border px-3 py-2 text-sm"
                      rows={2}
                      placeholder="Ex. : import en doublon, session zombie..."
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-red-800">
                    <input
                      type="checkbox"
                      checked={confirme}
                      onChange={(e) => setConfirme(e.target.checked)}
                      className="size-4 rounded border-red-300"
                    />
                    Je confirme l&apos;annulation de cet import
                  </label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAnnuler(annulationEnCours)}
                      disabled={pending || !confirme}
                    >
                      {pending ? 'Annulation...' : "Confirmer l'annulation"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAnnulationEnCours(null)}>
                      Abandonner
                    </Button>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailRapport({ session: s }: { session: SessionImport }) {
  const nonFinalise = s.statut === 'en_cours' || s.est_zombie;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FileBarChart className="size-4 text-orange-600" aria-hidden />
        Rapport de l&apos;import
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatRapport valeur={s.lignes_reelles} libelle="Lignes en base" ton="info" />
        <StatRapport valeur={s.nb_inserees} libelle="Insérées" ton="succes" />
        <StatRapport valeur={s.nb_doublons} libelle="Doublons (ignorés)" />
        <StatRapport
          valeur={s.nb_rejetees}
          libelle="Rejetées"
          ton={s.nb_rejetees > 0 ? 'erreur' : undefined}
        />
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Fichier</dt>
          <dd className="truncate font-medium" title={s.fichier_nom}>
            {s.fichier_nom}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Importeur</dt>
          <dd className="font-medium">{s.created_by_nom}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Date</dt>
          <dd className="font-medium">{new Date(s.created_at).toLocaleString('fr-FR')}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Annulation possible</dt>
          <dd className="font-medium">
            {s.peut_rollback
              ? s.rollback_expire_at
                ? `oui (jusqu'au ${new Date(s.rollback_expire_at).toLocaleDateString('fr-FR')})`
                : 'oui'
              : 'non'}
          </dd>
        </div>
      </dl>
      {nonFinalise && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ Import non finalisé (interrompu, probablement par un dépassement de durée). Les{' '}
          <strong>{s.lignes_reelles}</strong> ligne(s) déjà enregistrées sont valides. Relancez le
          <strong> même fichier</strong> pour ajouter les lignes manquantes : les lignes déjà
          présentes seront comptées comme doublons (jamais dupliquées). N&apos;annulez pas cette
          session si vous voulez conserver ces lignes.
        </p>
      )}
    </div>
  );
}

function StatRapport({
  valeur,
  libelle,
  ton,
}: {
  valeur: number;
  libelle: string;
  ton?: 'succes' | 'erreur' | 'info';
}) {
  const couleur =
    ton === 'succes'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : ton === 'erreur'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : ton === 'info'
          ? 'border-blue-200 bg-blue-50 text-blue-800'
          : 'border-slate-200 bg-white text-slate-700';
  return (
    <div className={`rounded-lg border p-2 text-center ${couleur}`}>
      <div className="text-lg font-semibold tabular-nums">{valeur.toLocaleString('fr-FR')}</div>
      <div className="text-[11px]">{libelle}</div>
    </div>
  );
}

function BadgeStatut({ statut, estZombie }: { statut: string; estZombie: boolean }) {
  if (estZombie) {
    return (
      <Badge variant="outline" className="border-orange-300 bg-orange-100 text-orange-700">
        ZOMBIE
      </Badge>
    );
  }
  if (statut.includes('annule')) {
    return (
      <Badge variant="outline" className="border-slate-300 text-slate-400">
        ANNULE
      </Badge>
    );
  }
  if (statut === 'en_cours') {
    return (
      <Badge variant="outline" className="border-blue-300 text-blue-600">
        EN COURS
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-emerald-300 text-emerald-600">
      COMPLET
    </Badge>
  );
}
