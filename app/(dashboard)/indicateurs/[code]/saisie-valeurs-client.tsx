'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Loader2, Pencil, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  enregistrerSaisieValeur,
  supprimerSaisieValeur,
  basculerPubliSaisieValeur,
} from '@/lib/indicateurs-annuels/server-actions';
import type { ValeurAnnee } from '@/lib/indicateurs-annuels/types';

type Props = {
  code: string;
  /** Valeurs existantes (auto + saisies confondues, renvoyées par la RPC). */
  valeursExistantes: ValeurAnnee[];
  /** Indique si l'indicateur est de type "taux" (A2, A3, A5, B2, B3, etc.). */
  estTaux: boolean;
  /** Année min/max autorisées. */
  anneeMin: number;
  anneeMax: number;
};

/**
 * Encart de saisie manuelle des valeurs d'un indicateur (admin_scs /
 * super_admin uniquement, garde côté serveur).
 *
 * Cas d'usage : pour A2 (taux d'achèvement), le SCS connaît parfois le
 * nombre d'achevements via une enquête sans avoir le dénominateur
 * (nombre total d'inscrits cette année-là). La saisie permet de
 * compléter le calcul automatique.
 *
 * Pour les indicateurs non calculables (A3, A5, B2, etc.), la saisie est
 * la SEULE source — le statut passe à 'saisie_manuelle' côté RPC.
 */
export function SaisieValeursClient({
  code,
  valeursExistantes,
  estTaux,
  anneeMin,
  anneeMax,
}: Props) {
  const [annee, setAnnee] = useState<number>(anneeMax);
  const [numerateur, setNumerateur] = useState<string>('');
  const [denominateur, setDenominateur] = useState<string>('');
  const [valeurDirecte, setValeurDirecte] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    if (!estTaux && !valeurDirecte && !numerateur) {
      toast.error('Valeur obligatoire (champ « Valeur »).');
      return;
    }
    if (estTaux && (!numerateur || !denominateur)) {
      toast.error('Numérateur et dénominateur sont attendus pour un taux.');
      return;
    }

    startTransition(async () => {
      const res = await enregistrerSaisieValeur({
        code,
        annee,
        numerateur: numerateur ? Number(numerateur) : null,
        denominateur: denominateur ? Number(denominateur) : null,
        valeur_directe: valeurDirecte ? Number(valeurDirecte) : null,
        note: note || null,
      });

      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success(`Valeur ${code} ${annee} enregistrée.`);
      // Reset partiel
      setNumerateur('');
      setDenominateur('');
      setValeurDirecte('');
      setNote('');
    });
  };

  const handleDelete = (anneeASupprimer: number) => {
    startTransition(async () => {
      const res = await supprimerSaisieValeur({ code, annee: anneeASupprimer });
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success(`Saisie ${code} ${anneeASupprimer} supprimée.`);
    });
  };

  const handleTogglePubli = (anneeABasculer: number, nouvelEtat: boolean) => {
    startTransition(async () => {
      const res = await basculerPubliSaisieValeur({
        code,
        annee: anneeABasculer,
        publie: nouvelEtat,
      });
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success(
        nouvelEtat
          ? `Saisie ${code} ${anneeABasculer} publiée.`
          : `Saisie ${code} ${anneeABasculer} dépubliée (brouillon).`,
      );
    });
  };

  // Pre-fill quand on change d'année si une saisie existe pour cette année
  const handleAnneeChange = (a: number) => {
    setAnnee(a);
    const existante = valeursExistantes.find((v) => v.annee === a && v.source !== 'auto');
    if (existante) {
      setNumerateur(
        existante.numerateur !== null && existante.numerateur !== undefined
          ? String(existante.numerateur)
          : '',
      );
      setDenominateur(
        existante.denominateur !== null && existante.denominateur !== undefined
          ? String(existante.denominateur)
          : '',
      );
      setValeurDirecte(
        existante.valeur !== null &&
          existante.valeur !== undefined &&
          (existante.numerateur === null || existante.numerateur === undefined) &&
          (existante.denominateur === null || existante.denominateur === undefined)
          ? String(existante.valeur)
          : '',
      );
    }
  };

  const annees = [];
  for (let a = anneeMin; a <= anneeMax; a++) annees.push(a);

  // Liste des saisies déjà présentes (source 'saisie' ou 'mixte')
  const saisiesExistantes = valeursExistantes.filter(
    (v) => v.source === 'saisie' || v.source === 'mixte',
  );

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <header className="mb-3 flex items-center gap-2">
        <Pencil className="size-4 text-blue-700" aria-hidden />
        <h2 className="text-sm font-semibold text-blue-900">
          Saisie manuelle des valeurs (admin SCS)
        </h2>
      </header>

      <p className="text-xs text-blue-900">
        {estTaux ? (
          <>
            Indicateur de type <strong>taux</strong> : saisissez le numérateur et le dénominateur
            par année. Le calcul automatique reste prioritaire ; les saisies complètent là où la BDD
            ne fournit pas (par exemple, dénominateur d&apos;une enquête externe).
          </>
        ) : (
          <>
            Indicateur de type <strong>volume</strong> : saisissez la valeur directe (effectif,
            montant). Utile pour les indicateurs non encore alimentés par la BDD.
          </>
        )}
      </p>

      {/* Tableau des saisies existantes */}
      {saisiesExistantes.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-blue-100 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-blue-50 tracking-wide text-blue-700 uppercase">
              <tr>
                <th className="px-2 py-1.5 text-left">Année</th>
                <th className="px-2 py-1.5 text-right">N</th>
                <th className="px-2 py-1.5 text-right">D</th>
                <th className="px-2 py-1.5 text-right">Valeur</th>
                <th className="px-2 py-1.5 text-center">Source</th>
                <th className="px-2 py-1.5 text-center">Publication</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {saisiesExistantes.map((v) => (
                <tr key={v.annee}>
                  <td className="px-2 py-1.5 font-mono">{v.annee}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{v.numerateur ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{v.denominateur ?? '—'}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {v.valeur ?? '—'}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        v.source === 'mixte'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {v.source}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleTogglePubli(v.annee, !v.publie)}
                      disabled={pending}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                        v.publie
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      aria-label={
                        v.publie ? `Dépublier la saisie ${v.annee}` : `Publier la saisie ${v.annee}`
                      }
                    >
                      {v.publie ? (
                        <>
                          <CheckCircle2 className="size-3" aria-hidden />
                          Publiée
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-3" aria-hidden />
                          Brouillon
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(v.annee)}
                      disabled={pending}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50"
                      aria-label={`Supprimer la saisie ${v.annee}`}
                    >
                      <Trash2 className="size-3" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulaire de saisie */}
      <div className="mt-4 space-y-3 rounded-lg border border-blue-100 bg-white p-3">
        <p className="text-xs font-semibold text-blue-900">
          <Plus className="mr-1 inline size-3" aria-hidden />
          Ajouter / mettre à jour une saisie
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <label className="text-xs">
            <span className="text-slate-600">Année</span>
            <select
              value={annee}
              onChange={(e) => handleAnneeChange(Number(e.target.value))}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs"
              disabled={pending}
            >
              {annees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          {estTaux ? (
            <>
              <label className="text-xs">
                <span className="text-slate-600">Numérateur</span>
                <input
                  type="number"
                  value={numerateur}
                  onChange={(e) => setNumerateur(e.target.value)}
                  placeholder="ex. 850"
                  min={0}
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  disabled={pending}
                />
              </label>
              <label className="text-xs">
                <span className="text-slate-600">Dénominateur</span>
                <input
                  type="number"
                  value={denominateur}
                  onChange={(e) => setDenominateur(e.target.value)}
                  placeholder="ex. 1000"
                  min={1}
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  disabled={pending}
                />
              </label>
            </>
          ) : (
            <label className="text-xs sm:col-span-2">
              <span className="text-slate-600">Valeur</span>
              <input
                type="number"
                value={valeurDirecte}
                onChange={(e) => setValeurDirecte(e.target.value)}
                placeholder="ex. 1200"
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                disabled={pending}
              />
            </label>
          )}

          <label className="text-xs">
            <span className="text-slate-600">Note (optionnel)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Source / méthodo"
              maxLength={500}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs"
              disabled={pending}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={pending}
            className="bg-blue-700 hover:bg-blue-800"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Save className="size-3" aria-hidden />
            )}
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </section>
  );
}
