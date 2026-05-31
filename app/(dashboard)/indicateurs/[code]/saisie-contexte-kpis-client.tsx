'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'sonner';
import { Globe2, Save, Loader2, BarChart3, Info, Database, PenLine, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enregistrerKpisContexte } from '@/lib/indicateurs-annuels/server-actions';
import type { KpisContexte, KpisContexteAuto } from '@/lib/realisations/queries';

type TypeIndicateur = 'count' | 'rate' | 'score' | 'amount';

type Props = {
  code: string;
  typeInd: TypeIndicateur;
  /** Afficher les champs femmes/jeunes/adultes (indicateurs qui comptent des personnes). */
  afficherVentilateur: boolean;
  /** Saisie manuelle actuelle en base (null si aucune saisie encore). */
  kpisInit: KpisContexte | null;
  /**
   * Valeurs fusionnées côté serveur avec auto BDD prioritaire.
   * Reflète exactement ce que le front affiche quand forcer_manuel=false.
   */
  kpisMerges?: KpisContexteAuto | null;
  /**
   * TRUE pour les indicateurs A* et B* : des valeurs auto BDD existent.
   * Affiche le banner d'information sur la source.
   */
  estAutoBDD?: boolean;
};

/**
 * Encart de saisie des KPIs secondaires de présentation (pays couverts,
 * femmes, jeunes/adultes, participants, répartition financement…).
 *
 * Ces chiffres alimentent la page publique Réalisations pour les indicateurs
 * dont la collecte automatique ne fournit pas encore ces ventilations.
 *
 * Règle d'affichage des champs (dépend du toggle source) :
 *   - Mode Auto BDD  → valeur fusionnée kpisMerges (= ce qu'affiche le front)
 *   - Mode Manuel    → valeur kpisInit (saisie manuelle brute)
 * Le toggle est persisté en base via forcer_manuel dans kpis_contexte_indicateurs.
 */
export function SaisieContexteKpisClient({ code, typeInd, afficherVentilateur, kpisInit, kpisMerges, estAutoBDD = false }: Props) {

  // ── Source prioritaire ────────────────────────────────────────────────────
  // forcerManuel=false → auto BDD prime (comportement par défaut)
  // forcerManuel=true  → saisie manuelle prime
  const [forcerManuel, setForcerManuel] = useState(kpisInit?.forcer_manuel ?? false);

  /**
   * Retourne la valeur à afficher dans un champ selon le mode actif :
   *   - Mode Auto BDD  → valeur fusionnée (kpisMerges = auto prio)
   *   - Mode Manuel    → valeur manuelle (kpisInit)
   */
  const getVal = (
    mergedVal: number | null | undefined,
    manuelVal: number | null | undefined,
    modeManuel: boolean,
  ): string => {
    if (modeManuel) {
      return manuelVal !== null && manuelVal !== undefined ? String(manuelVal) : '';
    }
    if (mergedVal !== null && mergedVal !== undefined) return String(mergedVal);
    if (manuelVal !== null && manuelVal !== undefined) return String(manuelVal);
    return '';
  };

  const [paysCount, setPaysCount] = useState(() =>
    getVal(kpisMerges?.pays_count, kpisInit?.pays_count, kpisInit?.forcer_manuel ?? false),
  );
  const [femmesCount, setFemmesCount] = useState(() =>
    getVal(kpisMerges?.femmes_count, kpisInit?.femmes_count, kpisInit?.forcer_manuel ?? false),
  );
  const [nbJeunes, setNbJeunes] = useState(() =>
    getVal(kpisMerges?.nb_jeunes, kpisInit?.nb_jeunes, kpisInit?.forcer_manuel ?? false),
  );
  const [nbAdultes, setNbAdultes] = useState(() =>
    getVal(kpisMerges?.nb_adultes, kpisInit?.nb_adultes, kpisInit?.forcer_manuel ?? false),
  );
  const [participantsCount, setParticipantsCount] = useState(
    kpisInit?.participants_count?.toString() ?? '',
  );
  const [ayantProgresse, setAyantProgresse] = useState(
    kpisInit?.ayant_progresse?.toString() ?? '',
  );
  const [gainMoyen, setGainMoyen] = useState(kpisInit?.gain_moyen?.toString() ?? '');
  const [sourcesPublicPct, setSourcesPublicPct] = useState(
    kpisInit?.sources_public_pct?.toString() ?? '',
  );
  const [sourcesPrive, setSourcesPrive] = useState(
    kpisInit?.sources_prive_pct?.toString() ?? '',
  );
  const [note, setNote] = useState(kpisInit?.note ?? '');

  // Quand le toggle change, recalculer les valeurs des 4 champs auto/manuel
  useEffect(() => {
    setPaysCount(getVal(kpisMerges?.pays_count, kpisInit?.pays_count, forcerManuel));
    setFemmesCount(getVal(kpisMerges?.femmes_count, kpisInit?.femmes_count, forcerManuel));
    setNbJeunes(getVal(kpisMerges?.nb_jeunes, kpisInit?.nb_jeunes, forcerManuel));
    setNbAdultes(getVal(kpisMerges?.nb_adultes, kpisInit?.nb_adultes, forcerManuel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcerManuel]);

  /**
   * Badge ambre "auto BDD" : visible en mode Auto BDD quand la valeur auto
   * diffère de la saisie manuelle (l'auto écrase le manuel).
   * En mode Manuel, aucun badge (le champ est librement éditable).
   */
  const estAutoPaysFront =
    !forcerManuel &&
    (kpisMerges?.pays_count ?? null) !== null &&
    (kpisMerges?.pays_count ?? null) !== (kpisInit?.pays_count ?? null);
  const estAutoFemmesFront =
    !forcerManuel &&
    (kpisMerges?.femmes_count ?? null) !== null &&
    (kpisMerges?.femmes_count ?? null) !== (kpisInit?.femmes_count ?? null);
  const estAutoJeunesFront =
    !forcerManuel &&
    (kpisMerges?.nb_jeunes ?? null) !== null &&
    (kpisMerges?.nb_jeunes ?? null) !== (kpisInit?.nb_jeunes ?? null);
  const estAutoAdultesFront =
    !forcerManuel &&
    (kpisMerges?.nb_adultes ?? null) !== null &&
    (kpisMerges?.nb_adultes ?? null) !== (kpisInit?.nb_adultes ?? null);

  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const res = await enregistrerKpisContexte({
        code,
        pays_count: paysCount ? Number(paysCount) : null,
        femmes_count: femmesCount ? Number(femmesCount) : null,
        nb_jeunes: nbJeunes ? Number(nbJeunes) : null,
        nb_adultes: nbAdultes ? Number(nbAdultes) : null,
        participants_count: participantsCount ? Number(participantsCount) : null,
        ayant_progresse: ayantProgresse ? Number(ayantProgresse) : null,
        gain_moyen: gainMoyen ? Number(gainMoyen) : null,
        sources_public_pct: sourcesPublicPct ? Number(sourcesPublicPct) : null,
        sources_prive_pct: sourcesPrive ? Number(sourcesPrive) : null,
        note: note || null,
        forcer_manuel: forcerManuel,
      });

      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success(`KPIs contextuels de ${code} enregistrés (source : ${forcerManuel ? 'Manuel' : 'Auto BDD'}).`);
    });
  };

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe2 className="size-4 text-emerald-700" aria-hidden />
          <h2 className="text-sm font-semibold text-emerald-900">
            KPIs contextuels — page publique Réalisations
          </h2>
        </div>

        {/* Toggle source prioritaire — visible pour tous les indicateurs */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-sm">
          <button
            type="button"
            onClick={() => setForcerManuel(false)}
            disabled={pending}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors disabled:opacity-50 ${
              !forcerManuel
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Auto BDD : les valeurs calculées depuis la base de données prennent la priorité"
          >
            <Cpu className="size-3" aria-hidden />
            Auto BDD
          </button>
          <button
            type="button"
            onClick={() => setForcerManuel(true)}
            disabled={pending}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors disabled:opacity-50 ${
              forcerManuel
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Manuel : votre saisie prend la priorité sur les valeurs automatiques"
          >
            <PenLine className="size-3" aria-hidden />
            Manuel
          </button>
        </div>
      </header>

      {/* Banner contextuel selon la source active */}
      {estAutoBDD && !forcerManuel ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-2 text-xs text-emerald-900">
          <Info className="mt-0.5 size-3.5 shrink-0 text-emerald-700" aria-hidden />
          <span>
            Source active&nbsp;: <strong>Auto BDD</strong>. Les valeurs calculées depuis la BDD
            ont la priorité. Les champs avec le badge{' '}
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-700">
              <Database className="size-2.5" aria-hidden />
              auto BDD
            </span>{' '}
            reflètent la valeur réelle affichée sur le front. Passez en{' '}
            <strong>Manuel</strong> pour forcer vos propres chiffres.
          </span>
        </div>
      ) : estAutoBDD && forcerManuel ? (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <PenLine className="mt-0.5 size-3.5 shrink-0 text-slate-500" aria-hidden />
          <span>
            Source active&nbsp;: <strong>Manuel</strong>. Votre saisie prend la priorité sur les
            valeurs auto BDD pour cet indicateur. Les champs vides utilisent la valeur auto en
            fallback.
          </span>
        </div>
      ) : (
        <p className="text-xs text-emerald-900">
          Ces chiffres complètent la page publique de l&apos;indicateur (pays couverts, femmes,
          répartition…). Aucune source auto disponible — votre saisie sera utilisée directement.
        </p>
      )}

      <div className="mt-4 space-y-4 rounded-lg border border-emerald-100 bg-white p-3">
        {/* Champ commun : pays couverts */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field
            label="Pays couverts"
            value={paysCount}
            onChange={setPaysCount}
            placeholder="ex. 18"
            disabled={pending}
            isAuto={estAutoPaysFront}
          />

          {/* Femmes — rate, score, count-personnes */}
          {(typeInd === 'rate' || typeInd === 'score' || afficherVentilateur) && (
            <Field
              label={typeInd === 'rate' ? 'Femmes (dans le numérateur)' : 'Femmes'}
              value={femmesCount}
              onChange={setFemmesCount}
              placeholder="ex. 2325"
              disabled={pending}
              isAuto={estAutoFemmesFront}
            />
          )}

          {/* Jeunes / Adultes — count-personnes uniquement */}
          {afficherVentilateur && typeInd === 'count' && (
            <>
              <Field
                label="Jeunes (15-34 ans)"
                value={nbJeunes}
                onChange={setNbJeunes}
                placeholder="ex. 1500"
                disabled={pending}
                isAuto={estAutoJeunesFront}
              />
              <Field
                label="Adultes (35 ans et +)"
                value={nbAdultes}
                onChange={setNbAdultes}
                placeholder="ex. 900"
                disabled={pending}
                isAuto={estAutoAdultesFront}
              />
            </>
          )}

          {/* Champs Score (A4) */}
          {typeInd === 'score' && (
            <>
              <Field
                label="Participants évalués"
                value={participantsCount}
                onChange={setParticipantsCount}
                placeholder="ex. 4381"
                disabled={pending}
              />
              <Field
                label="Ayant progressé"
                value={ayantProgresse}
                onChange={setAyantProgresse}
                placeholder="ex. 3417"
                disabled={pending}
              />
              <Field
                label="Gain moyen (points)"
                value={gainMoyen}
                onChange={setGainMoyen}
                placeholder="ex. 23"
                disabled={pending}
              />
            </>
          )}

          {/* Champs Montant (B4) */}
          {typeInd === 'amount' && (
            <>
              <Field
                label="Fonds publics (%)"
                value={sourcesPublicPct}
                onChange={setSourcesPublicPct}
                placeholder="ex. 62"
                disabled={pending}
                min={0}
                max={100}
              />
              <Field
                label="Secteur privé (%)"
                value={sourcesPrive}
                onChange={setSourcesPrive}
                placeholder="ex. 38"
                disabled={pending}
                min={0}
                max={100}
              />
            </>
          )}

          {/* Note */}
          <label className="text-xs sm:col-span-3">
            <span className="text-slate-600">Note (optionnel)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Source des données, période de référence…"
              maxLength={500}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs"
              disabled={pending}
            />
          </label>
        </div>

        {typeInd === 'score' && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <BarChart3 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
            <span>
              Pour A4, le <strong>score principal</strong> (% ayant progressé) est calculé depuis
              la saisie annuelle de valeur ci-dessus. Les champs ici enrichissent la page publique
              avec les détails contextuels.
            </span>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={pending}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Save className="size-3" aria-hidden />
            )}
            {pending ? 'Enregistrement…' : 'Enregistrer les KPIs contextuels'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  min = 0,
  max,
  isAuto = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  /** TRUE si la valeur vient de la BDD auto (pas encore de saisie manuelle). */
  isAuto?: boolean;
}) {
  return (
    <label className="text-xs">
      <span className="flex items-center gap-1 text-slate-600">
        {label}
        {isAuto && (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
            <Database className="size-2.5" aria-hidden />
            auto BDD
          </span>
        )}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className={`mt-0.5 w-full rounded border px-2 py-1 text-xs ${
          isAuto
            ? 'border-amber-200 bg-amber-50/60 text-amber-900'
            : 'border-slate-200'
        }`}
        disabled={disabled}
      />
    </label>
  );
}
