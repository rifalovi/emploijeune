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
import { useBeneficiaireFilters } from './use-beneficiaire-filters';
import {
  SEXE_VALUES,
  SEXE_LIBELLES,
  STATUTS_BENEFICIAIRE_CODES,
  STATUT_BENEFICIAIRE_LIBELLES,
  PROGRAMMES_STRATEGIQUES_CODES,
} from '@/lib/schemas/nomenclatures';

/**
 * Listes d'options pour les filtres — alimentées par le serveur via la prop
 * `nomenclatures` pour éviter un double source-of-truth.
 */
export type FilterOptionListe = Array<{ code: string; libelle: string }>;

export type BeneficiaireFiltersProps = {
  projets: FilterOptionListe;
  pays: FilterOptionListe;
  domaines: FilterOptionListe;
  /** Années disponibles dans le jeu de données (calculé côté server). */
  annees: number[];
};

const TOUS = 'tous';

export function BeneficiaireFilters({ projets, pays, domaines, annees }: BeneficiaireFiltersProps) {
  const { get, setParams, reset } = useBeneficiaireFilters();
  const [q, setQ] = useState(get('q'));
  const [pending, startTransition] = useTransition();

  // Debounce de 300 ms pour la recherche textuelle afin d'éviter
  // une requête serveur à chaque touche pressée.
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
    get('projet_code') !== '' ||
    get('ps') !== '' ||
    get('pays_code') !== '' ||
    get('domaine_formation_code') !== '' ||
    get('annee_formation') !== '' ||
    get('statut_code') !== '' ||
    get('sexe') !== '' ||
    get('mien') === 'true';

  return (
    <div className="space-y-3">
      {/* Ligne 1 : recherche plein-texte */}
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher par nom ou prénom (tolérance aux fautes de frappe)"
          aria-label="Rechercher un bénéficiaire"
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

      {/* Ligne 2 : filtres dropdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <FilterSelect
          id="projet_code"
          label="Projet"
          value={get('projet_code') || TOUS}
          options={projets}
          onChange={(v) => setParams({ projet_code: v })}
        />
        <FilterSelect
          id="ps"
          label="Programme"
          value={get('ps') || TOUS}
          options={PROGRAMMES_STRATEGIQUES_CODES.map((c) => ({
            code: c,
            libelle: c,
          }))}
          onChange={(v) => setParams({ ps: v })}
        />
        <FilterSelect
          id="pays_code"
          label="Pays"
          value={get('pays_code') || TOUS}
          options={pays}
          onChange={(v) => setParams({ pays_code: v })}
        />
        <FilterSelect
          id="domaine_formation_code"
          label="Domaine"
          value={get('domaine_formation_code') || TOUS}
          options={domaines}
          onChange={(v) => setParams({ domaine_formation_code: v })}
        />
        <FilterSelect
          id="annee_formation"
          label="Année"
          value={get('annee_formation') || TOUS}
          options={annees.map((a) => ({ code: String(a), libelle: String(a) }))}
          onChange={(v) => setParams({ annee_formation: v })}
        />
        <FilterSelect
          id="statut_code"
          label="Statut"
          value={get('statut_code') || TOUS}
          options={STATUTS_BENEFICIAIRE_CODES.map((c) => ({
            code: c,
            libelle: STATUT_BENEFICIAIRE_LIBELLES[c],
          }))}
          onChange={(v) => setParams({ statut_code: v })}
        />
        <FilterSelect
          id="sexe"
          label="Sexe"
          value={get('sexe') || TOUS}
          options={SEXE_VALUES.map((s) => ({ code: s, libelle: SEXE_LIBELLES[s] }))}
          onChange={(v) => setParams({ sexe: v })}
        />
      </div>

      {/* Bouton Effacer */}
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
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger id={id} aria-label={`Filtrer par ${label.toLowerCase()}`}>
          <SelectValue />
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
