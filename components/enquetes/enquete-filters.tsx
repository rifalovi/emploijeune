'use client';

import { useState, useEffect, useTransition } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnqueteFilters } from './use-enquete-filters';
import {
  VAGUES_ENQUETE_VALUES,
  VAGUE_ENQUETE_LIBELLES,
  CANAUX_COLLECTE_VALUES,
  CANAL_COLLECTE_LIBELLES,
} from '@/lib/schemas/enquetes/nomenclatures';

export type FilterOptionListe = Array<{ code: string; libelle: string }>;

export type EnqueteFiltersProps = {
  projets: FilterOptionListe;
};

const TOUS = 'tous';

/**
 * Filtres de la liste enquêtes (Étape 6c). Pattern miroir de
 * `StructureFilters` adapté aux 5 filtres principaux + recherche cible.
 */
export function EnqueteFilters({ projets }: EnqueteFiltersProps) {
  const { get, setParams, reset } = useEnqueteFilters();
  const [q, setQ] = useState(get('q'));
  const [pending, startTransition] = useTransition();

  // Debounce 300 ms pour la recherche par nom de cible.
  useEffect(() => {
    const current = get('q');
    if (q === current) return;
    const t = setTimeout(() => {
      startTransition(() => setParams({ q }));
    }, 300);
    return () => clearTimeout(t);
  }, [q, get, setParams]);

  const hasActive =
    get('q') !== '' ||
    get('questionnaire') !== '' ||
    get('projet_code') !== '' ||
    get('vague_enquete') !== '' ||
    get('canal_collecte') !== '' ||
    get('mien') === 'true';

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher par nom de bénéficiaire ou de structure"
          aria-label="Rechercher une enquête"
          className="pl-9"
        />
        {q && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => setQ('')}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <FilterSelect
          id="questionnaire"
          label="Questionnaire"
          value={get('questionnaire') || TOUS}
          options={[
            { code: 'A', libelle: 'A — Bénéficiaires' },
            { code: 'B', libelle: 'B — Structures' },
          ]}
          onChange={(v) => setParams({ questionnaire: v })}
        />
        <FilterSelect
          id="projet_code"
          label="Projet"
          value={get('projet_code') || TOUS}
          options={projets}
          onChange={(v) => setParams({ projet_code: v })}
        />
        <FilterSelect
          id="vague_enquete"
          label="Vague"
          value={get('vague_enquete') || TOUS}
          options={VAGUES_ENQUETE_VALUES.map((c) => ({
            code: c,
            libelle: VAGUE_ENQUETE_LIBELLES[c],
          }))}
          onChange={(v) => setParams({ vague_enquete: v })}
        />
        <FilterSelect
          id="canal_collecte"
          label="Canal"
          value={get('canal_collecte') || TOUS}
          options={CANAUX_COLLECTE_VALUES.map((c) => ({
            code: c,
            libelle: CANAL_COLLECTE_LIBELLES[c],
          }))}
          onChange={(v) => setParams({ canal_collecte: v })}
        />
      </div>

      {hasActive && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={reset} disabled={pending}>
            <X className="size-4" aria-hidden />
            Effacer tous les filtres
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: FilterOptionListe;
  onChange: (value: string) => void;
}) {
  const libelles: Record<string, string> = { [TOUS]: 'Tous' };
  for (const opt of options) libelles[opt.code] = opt.libelle;

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger
          id={id}
          aria-label={`Filtrer par ${label.toLowerCase()}`}
          title={libelles[value]}
        >
          <SelectValue>{(v: string | null) => (v ? (libelles[v] ?? v) : 'Tous')}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Tous</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.code} value={opt.code}>
              {opt.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
