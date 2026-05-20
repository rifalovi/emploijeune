'use client';

import { useState, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Pencil,
  EyeOff,
  Eye,
  CheckCircle2,
  AlertTriangle,
  PenLine,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  enregistrerSaisieValeur,
  supprimerSaisieValeur,
  basculerPubliSaisieValeur,
  basculerMasquageAnnee,
} from '@/lib/indicateurs-annuels/server-actions';
import type { ValeurAnnee, SaisieIndicateurBrute } from '@/lib/indicateurs-annuels/types';

type Props = {
  code: string;
  /** Valeurs existantes (auto + saisies confondues, renvoyées par la RPC). */
  valeursExistantes: ValeurAnnee[];
  /**
   * Saisies brutes lues directement dans `valeurs_indicateurs_saisies`.
   * Permet d'afficher le tableau même quand la RPC renvoie `source: 'auto'`
   * (cas A2 — calcul BDD prioritaire masquant les lignes de saisie).
   */
  saisiesBrutes: SaisieIndicateurBrute[];
  /** Indique si l'indicateur est de type "taux" (A2, A3, A5, B2, B3, etc.). */
  estTaux: boolean;
  /** Année min/max autorisées. */
  anneeMin: number;
  anneeMax: number;
  /**
   * Années masquées du front public pour les indicateurs auto-BDD (A1/B1/B4).
   * Ces années restent visibles pour l'admin mais sont cachées aux visiteurs.
   */
  anneesMasquees?: number[];
};

/**
 * Encart de saisie manuelle des valeurs d'un indicateur
 * (super_admin uniquement, garde côté serveur + RPC).
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
  saisiesBrutes,
  estTaux,
  anneeMin,
  anneeMax,
  anneesMasquees = [],
}: Props) {
  // Seuls A1, B1, B4 supportent le masquage par année
  const supporteMasquage = ['A1', 'B1', 'B4'].includes(code);
  const [annee, setAnnee] = useState<number>(anneeMax);
  const [numerateur, setNumerateur] = useState<string>('');
  const [denominateur, setDenominateur] = useState<string>('');
  const [valeurDirecte, setValeurDirecte] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);

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

  const handleToggleMasquage = (anneeACibler: number, estMasquee: boolean) => {
    if (!['A1', 'B1', 'B4'].includes(code)) return;
    startTransition(async () => {
      const res = await basculerMasquageAnnee({
        code: code as 'A1' | 'B1' | 'B4',
        annee: anneeACibler,
        masquer: !estMasquee,
      });
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success(
        !estMasquee
          ? `Année ${anneeACibler} masquée du front public.`
          : `Année ${anneeACibler} réactivée sur le front public.`,
      );
    });
  };

  // Publie directement une ligne auto BDD sans passer par le formulaire :
  //   1. Crée une saisie manuelle avec la valeur auto (copie instantanée)
  //   2. La marque aussitôt comme publiée
  // Équivalent à "Saisir + Enregistrer + Publier" en un seul clic.
  const handlePublierAuto = (v: ValeurAnnee) => {
    startTransition(async () => {
      const payload = {
        code,
        annee: v.annee,
        numerateur: estTaux
          ? (v.numerateur ?? null)
          : null,
        denominateur: estTaux
          ? (v.denominateur ?? null)
          : null,
        valeur_directe: !estTaux
          ? (v.valeur ?? null)
          : null,
        note: null,
      };

      const saveRes = await enregistrerSaisieValeur(payload);
      if (saveRes.status === 'erreur') {
        toast.error(`Enregistrement échoué : ${saveRes.message}`);
        return;
      }

      const pubRes = await basculerPubliSaisieValeur({ code, annee: v.annee, publie: true });
      if (pubRes.status === 'erreur') {
        toast.error(`Publication échouée : ${pubRes.message}`);
        return;
      }

      toast.success(`Valeur ${code} ${v.annee} publiée sur le front public.`);
    });
  };

  // Bascule une ligne auto BDD en mode manuel : pré-remplit le formulaire
  // et scrolle dessus pour que l'admin puisse ajuster ou dépublier.
  const handleBasculerManuel = (v: ValeurAnnee) => {
    setAnnee(v.annee);
    if (estTaux) {
      setNumerateur(v.numerateur !== null && v.numerateur !== undefined ? String(v.numerateur) : '');
      setDenominateur(
        v.denominateur !== null && v.denominateur !== undefined ? String(v.denominateur) : '',
      );
      setValeurDirecte('');
    } else {
      setValeurDirecte(v.valeur !== null && v.valeur !== undefined ? String(v.valeur) : '');
      setNumerateur('');
      setDenominateur('');
    }
    setNote('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Pre-fill quand on change d'année :
  //   1. Saisie manuelle existante → prioritaire (valeurs brutes depuis BDD)
  //   2. Valeur auto (source='auto') → pré-remplissage indicatif pour que
  //      l'admin voie ce qui est actuellement affiché et puisse l'ajuster.
  const handleAnneeChange = (a: number) => {
    setAnnee(a);
    const brute = saisiesBrutes.find((s) => s.annee === a);
    if (brute) {
      setNumerateur(brute.numerateur !== null ? String(brute.numerateur) : '');
      setDenominateur(brute.denominateur !== null ? String(brute.denominateur) : '');
      setValeurDirecte(
        brute.valeur_directe !== null && brute.numerateur === null && brute.denominateur === null
          ? String(brute.valeur_directe)
          : '',
      );
      setNote(brute.note ?? '');
    } else {
      // Fallback : pré-remplir depuis la valeur calculée automatiquement
      const autoVal = valeursExistantes.find((v) => v.annee === a && v.source === 'auto');
      if (autoVal) {
        if (estTaux) {
          setNumerateur(
            autoVal.numerateur !== null && autoVal.numerateur !== undefined
              ? String(autoVal.numerateur)
              : '',
          );
          setDenominateur(
            autoVal.denominateur !== null && autoVal.denominateur !== undefined
              ? String(autoVal.denominateur)
              : '',
          );
          setValeurDirecte('');
        } else {
          setValeurDirecte(autoVal.valeur !== null ? String(autoVal.valeur) : '');
          setNumerateur('');
          setDenominateur('');
        }
      } else {
        setNumerateur('');
        setDenominateur('');
        setValeurDirecte('');
      }
      setNote('');
    }
  };

  const annees = [];
  for (let a = anneeMin; a <= anneeMax; a++) annees.push(a);

  // Tableau unifié : lignes auto (lecture seule) + lignes saisie (éditables).
  // Pour une même année, la saisie manuelle prend le dessus — on n'affiche
  // pas la ligne auto si une saisie existe déjà pour cette année.
  const anneesAvecSaisie = new Set(saisiesBrutes.map((s) => s.annee));
  const lignesAuto = valeursExistantes.filter(
    (v) => v.source === 'auto' && !anneesAvecSaisie.has(v.annee),
  );
  const afficherTableau = saisiesBrutes.length > 0 || lignesAuto.length > 0;

  // Années pour lesquelles le calcul automatique (BDD) produit déjà des données.
  const anneesAvecAuto = new Set(
    valeursExistantes.filter((v) => v.source === 'auto').map((v) => v.annee),
  );
  const anneeSelectionneeEstAuto = anneesAvecAuto.has(annee);

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

      {/* Tableau unifié : lignes auto (lecture seule) + lignes saisie (éditables).
          Les lignes auto montrent ce qui est actuellement affiché sur le front ;
          les lignes saisie permettent de l'ajuster / surcharger. */}
      {afficherTableau && (
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
              {/* Lignes saisie manuelle (éditables + publiables) */}
              {saisiesBrutes.map((s) => {
                const valeurCalculee =
                  s.numerateur !== null && s.denominateur !== null && s.denominateur !== 0
                    ? Math.round((s.numerateur / s.denominateur) * 1000) / 10
                    : s.valeur_directe;
                return (
                  <tr key={`saisie-${s.annee}`}>
                    <td className="px-2 py-1.5 font-mono">{s.annee}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{s.numerateur ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{s.denominateur ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                      {valeurCalculee !== null && valeurCalculee !== undefined
                        ? estTaux
                          ? `${valeurCalculee} %`
                          : valeurCalculee.toLocaleString('fr-FR')
                        : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        saisie
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePubli(s.annee, !s.publie)}
                        disabled={pending}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                          s.publie
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        aria-label={
                          s.publie
                            ? `Dépublier la saisie ${s.annee}`
                            : `Publier la saisie ${s.annee}`
                        }
                      >
                        {s.publie ? (
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
                        onClick={() => handleDelete(s.annee)}
                        disabled={pending}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        aria-label={`Supprimer la saisie ${s.annee}`}
                      >
                        <Trash2 className="size-3" aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Lignes auto BDD (lecture seule — aucune saisie manuelle pour ces années) */}
              {lignesAuto
                .slice()
                .sort((a, b) => a.annee - b.annee)
                .map((v) => {
                  const estMasquee = anneesMasquees.includes(v.annee) || v.masque === true;
                  return (
                    <tr
                      key={`auto-${v.annee}`}
                      className={estMasquee ? 'bg-red-50/40 text-slate-400' : 'bg-slate-50/60 text-slate-500'}
                    >
                      <td className="px-2 py-1.5 font-mono">
                        <span className="flex items-center gap-1">
                          {v.annee}
                          {estMasquee && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-medium text-red-600">
                              <EyeOff className="size-2.5" aria-hidden />
                              masqué
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{v.numerateur ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{v.denominateur ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                        {v.valeur !== null
                          ? estTaux
                            ? `${v.valeur} %`
                            : v.valeur.toLocaleString('fr-FR')
                          : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          auto BDD
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center text-[10px] italic text-slate-400">
                        {estMasquee ? (
                          <span className="text-red-400">masqué front</span>
                        ) : (
                          'calculé auto'
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Masquer / Démasquer — uniquement A1/B1/B4 */}
                          {supporteMasquage && (
                            <button
                              type="button"
                              onClick={() => handleToggleMasquage(v.annee, estMasquee)}
                              disabled={pending}
                              title={
                                estMasquee
                                  ? `Réafficher l'année ${v.annee} sur le front public`
                                  : `Masquer l'année ${v.annee} du front public`
                              }
                              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium disabled:opacity-50 ${
                                estMasquee
                                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                  : 'bg-red-50 text-red-500 hover:bg-red-100'
                              }`}
                            >
                              {estMasquee ? (
                                <>
                                  <Eye className="size-2.5" aria-hidden />
                                  Afficher
                                </>
                              ) : (
                                <>
                                  <EyeOff className="size-2.5" aria-hidden />
                                  Masquer
                                </>
                              )}
                            </button>
                          )}
                          {/* Publier directement (copie auto → saisie publiée) */}
                          <button
                            type="button"
                            onClick={() => handlePublierAuto(v)}
                            disabled={pending}
                            title={`Publier la valeur ${v.annee} telle quelle sur le front public`}
                            className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {pending ? (
                              <Loader2 className="size-2.5 animate-spin" aria-hidden />
                            ) : (
                              <Send className="size-2.5" aria-hidden />
                            )}
                            Publier
                          </button>
                          {/* Saisir manuellement (modifier avant de publier) */}
                          <button
                            type="button"
                            onClick={() => handleBasculerManuel(v)}
                            disabled={pending}
                            title="Modifier la valeur avant de publier"
                            className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                          >
                            <PenLine className="size-2.5" aria-hidden />
                            Saisir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulaire de saisie */}
      <div ref={formRef} className="mt-4 space-y-3 rounded-lg border border-blue-100 bg-white p-3">
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

        {/* Info : la saisie manuelle remplace les données auto dans le graphique */}
        {anneeSelectionneeEstAuto && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-blue-500" aria-hidden />
            <span>
              <strong>Année {annee} — données auto disponibles.</strong> Une saisie manuelle
              existera <strong>en priorité</strong> sur le calcul BDD dans le graphique et le
              tableau récapitulatif. Supprimez la saisie pour revenir aux valeurs calculées
              automatiquement.
            </span>
          </div>
        )}

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
