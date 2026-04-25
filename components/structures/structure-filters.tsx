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
import { useStructureFilters } from './use-structure-filters';
import {
  PROGRAMMES_STRATEGIQUES_CODES,
  TYPES_STRUCTURE_CODES,
  TYPE_STRUCTURE_LIBELLES,
  SECTEURS_ACTIVITE_CODES,
  SECTEUR_ACTIVITE_LIBELLES,
  NATURES_APPUI_CODES,
  NATURE_APPUI_LIBELLES,
  STATUTS_STRUCTURE_VALUES,
  STATUT_STRUCTURE_LIBELLES,
} from '@/lib/schemas/nomenclatures';

/**
 * Listes d'options pour les filtres — alimentées par le serveur via la prop
 * `nomenclatures` pour éviter un double source-of-truth.
 */
export type FilterOptionListe = Array<{ code: string; libelle: string }>;

export type StructureFiltersProps = {
  projets: FilterOptionListe;
  pays: FilterOptionListe;
  /** Années disponibles dans le jeu de données (calculé côté server). */
  annees: number[];
};

const TOUS = 'tous';

export function StructureFilters({ projets, pays, annees }: StructureFiltersProps) {
  const { get, setParams, reset } = useStructureFilters();
  const [q, setQ] = useState(get('q'));
  const [pending, startTransition] = useTransition();

  // Debounce 300 ms pour la recherche textuelle.
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
    get('type_structure_code') !== '' ||
    get('secteur_activite_code') !== '' ||
    get('nature_appui_code') !== '' ||
    get('statut_creation') !== '' ||
    get('annee_appui') !== '' ||
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
          placeholder="Rechercher par nom de structure (tolérance aux fautes de frappe)"
          aria-label="Rechercher une structure"
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

      {/* Ligne 2 : filtres dropdown (8 filtres en grille adaptative) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
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
          options={PROGRAMMES_STRATEGIQUES_CODES.map((c) => ({ code: c, libelle: c }))}
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
          id="type_structure_code"
          label="Type"
          value={get('type_structure_code') || TOUS}
          options={TYPES_STRUCTURE_CODES.map((c) => ({
            code: c,
            libelle: TYPE_STRUCTURE_LIBELLES[c],
          }))}
          onChange={(v) => setParams({ type_structure_code: v })}
        />
        <FilterSelect
          id="secteur_activite_code"
          label="Secteur"
          value={get('secteur_activite_code') || TOUS}
          options={SECTEURS_ACTIVITE_CODES.map((c) => ({
            code: c,
            libelle: SECTEUR_ACTIVITE_LIBELLES[c],
          }))}
          onChange={(v) => setParams({ secteur_activite_code: v })}
        />
        <FilterSelect
          id="nature_appui_code"
          label="Nature appui"
          value={get('nature_appui_code') || TOUS}
          options={NATURES_APPUI_CODES.map((c) => ({
            code: c,
            libelle: NATURE_APPUI_LIBELLES[c],
          }))}
          onChange={(v) => setParams({ nature_appui_code: v })}
        />
        <FilterSelect
          id="statut_creation"
          label="Statut"
          value={get('statut_creation') || TOUS}
          options={STATUTS_STRUCTURE_VALUES.map((c) => ({
            code: c,
            libelle: STATUT_STRUCTURE_LIBELLES[c],
          }))}
          onChange={(v) => setParams({ statut_creation: v })}
        />
        <FilterSelect
          id="annee_appui"
          label="Année"
          value={get('annee_appui') || TOUS}
          options={annees.map((a) => ({ code: String(a), libelle: String(a) }))}
          onChange={(v) => setParams({ annee_appui: v })}
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
  // Map code→libellé pour afficher le libellé après sélection (Base-UI 1.3+
  // affiche la valeur brute par défaut — cf. hotfix 4f-ter).
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
