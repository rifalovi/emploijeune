'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Globe2, Save, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enregistrerKpisContexte } from '@/lib/indicateurs-annuels/server-actions';
import type { KpisContexte } from '@/lib/realisations/queries';

type TypeIndicateur = 'count' | 'rate' | 'score' | 'amount';

type Props = {
  code: string;
  typeInd: TypeIndicateur;
  /** Afficher les champs femmes/jeunes/adultes (indicateurs qui comptent des personnes). */
  afficherVentilateur: boolean;
  /** Valeurs actuellement en base (null si aucune saisie). */
  kpisInit: KpisContexte | null;
};

/**
 * Encart de saisie des KPIs secondaires de présentation (pays couverts,
 * femmes, jeunes/adultes, participants, répartition financement…).
 *
 * Ces chiffres alimentent la page publique Réalisations pour les indicateurs
 * dont la collecte automatique ne fournit pas encore ces ventilations.
 */
export function SaisieContexteKpisClient({ code, typeInd, afficherVentilateur, kpisInit }: Props) {
  const [paysCount, setPaysCount] = useState(kpisInit?.pays_count?.toString() ?? '');
  const [femmesCount, setFemmesCount] = useState(kpisInit?.femmes_count?.toString() ?? '');
  const [nbJeunes, setNbJeunes] = useState(kpisInit?.nb_jeunes?.toString() ?? '');
  const [nbAdultes, setNbAdultes] = useState(kpisInit?.nb_adultes?.toString() ?? '');
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
      });

      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success(`KPIs contextuels de ${code} enregistrés.`);
    });
  };

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <header className="mb-3 flex items-center gap-2">
        <Globe2 className="size-4 text-emerald-700" aria-hidden />
        <h2 className="text-sm font-semibold text-emerald-900">
          KPIs contextuels — page publique Réalisations
        </h2>
      </header>

      <p className="text-xs text-emerald-900">
        Ces chiffres complètent la page publique de l&apos;indicateur (pays couverts, femmes,
        répartition…). Ils sont affichés à des fins de présentation en attendant les données de
        collecte automatique.
      </p>

      <div className="mt-4 space-y-4 rounded-lg border border-emerald-100 bg-white p-3">
        {/* Champ commun : pays couverts */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field
            label="Pays couverts"
            value={paysCount}
            onChange={setPaysCount}
            placeholder="ex. 18"
            disabled={pending}
          />

          {/* Femmes — rate, score, count-personnes */}
          {(typeInd === 'rate' || typeInd === 'score' || afficherVentilateur) && (
            <Field
              label={typeInd === 'rate' ? 'Femmes (dans le numérateur)' : 'Femmes'}
              value={femmesCount}
              onChange={setFemmesCount}
              placeholder="ex. 2325"
              disabled={pending}
            />
          )}

          {/* Jeunes / Adultes — count-personnes uniquement */}
          {afficherVentilateur && typeInd === 'count' && (
            <>
              <Field
                label="Jeunes (18-34 ans)"
                value={nbJeunes}
                onChange={setNbJeunes}
                placeholder="ex. 1500"
                disabled={pending}
              />
              <Field
                label="Adultes (35 ans et +)"
                value={nbAdultes}
                onChange={setNbAdultes}
                placeholder="ex. 900"
                disabled={pending}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="text-xs">
      <span className="text-slate-600">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs"
        disabled={disabled}
      />
    </label>
  );
}
