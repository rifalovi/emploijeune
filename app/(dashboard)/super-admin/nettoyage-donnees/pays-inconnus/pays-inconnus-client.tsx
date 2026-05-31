'use client';

import { useState, useTransition, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Check, X, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  BeneficiaireZzz,
  ResumeProjet,
} from '@/lib/super-admin/nettoyage-pays-actions';
import {
  corrigerPays,
  corrigerPaysBulk,
  ignorerAlerte,
  ignorerAlertesBulk,
} from '@/lib/super-admin/nettoyage-pays-actions';

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  beneficiaires: BeneficiaireZzz[];
  resumeProjets: ResumeProjet[];
  pays: { code_iso: string; libelle_fr: string }[];
};

// ── Composant principal ──────────────────────────────────────────────────────

export function PaysInconnusClient({ beneficiaires: initial, resumeProjets, pays }: Props) {
  const [lignes, setLignes] = useState(initial);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [paysBulk, setPaysBulk] = useState('');
  const [pending, startTransition] = useTransition();

  // Map pays_code -> libelle pour le dropdown
  const paysMap = useMemo(() => new Map(pays.map((p) => [p.code_iso, p.libelle_fr])), [pays]);

  // Map projet -> pays majoritaire suggere
  const suggestedPays = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resumeProjets) {
      if (r.pays_majoritaire) m.set(r.projet_code, r.pays_majoritaire.pays_code);
    }
    return m;
  }, [resumeProjets]);

  // Retirer une ligne de l'affichage apres correction/ignorement
  const retirerLignes = useCallback((ids: Set<string>) => {
    setLignes((prev) => prev.filter((l) => !ids.has(l.id)));
    setSelection((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  // ── Actions unitaires ────────────────────────────────────────────────────

  const handleCorriger = (beneficiaireId: string, paysCode: string) => {
    if (!paysCode) { toast.error('Selectionnez un pays.'); return; }
    startTransition(async () => {
      const res = await corrigerPays(beneficiaireId, paysCode);
      if (res.status === 'succes') {
        toast.success(`Pays corrige en ${paysMap.get(paysCode) ?? paysCode}.`);
        retirerLignes(new Set([beneficiaireId]));
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleIgnorer = (beneficiaireId: string) => {
    startTransition(async () => {
      const res = await ignorerAlerte(beneficiaireId);
      if (res.status === 'succes') {
        toast.success('Alerte ignoree.');
        retirerLignes(new Set([beneficiaireId]));
      } else {
        toast.error(res.message);
      }
    });
  };

  // ── Actions bulk ─────────────────────────────────────────────────────────

  const handleBulkCorriger = () => {
    if (selection.size === 0) { toast.error('Aucune ligne selectionnee.'); return; }
    if (!paysBulk) { toast.error('Selectionnez un pays pour la correction groupee.'); return; }
    startTransition(async () => {
      const ids = Array.from(selection);
      const res = await corrigerPaysBulk(ids, paysBulk);
      if (res.status === 'succes') {
        toast.success(`${res.data.corriges} beneficiaire(s) corrige(s).`);
        retirerLignes(new Set(ids));
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleBulkIgnorer = () => {
    if (selection.size === 0) { toast.error('Aucune ligne selectionnee.'); return; }
    startTransition(async () => {
      const ids = Array.from(selection);
      const res = await ignorerAlertesBulk(ids);
      if (res.status === 'succes') {
        toast.success(`${res.data.ignores} alerte(s) ignoree(s).`);
        retirerLignes(new Set(ids));
      } else {
        toast.error(res.message);
      }
    });
  };

  // ── Selection helpers ────────────────────────────────────────────────────

  const toggleSelection = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleToutProjet = (projetCode: string) => {
    const idsProjet = lignes.filter((l) => l.projet_code === projetCode).map((l) => l.id);
    const tousSelectionnes = idsProjet.every((id) => selection.has(id));
    setSelection((prev) => {
      const next = new Set(prev);
      for (const id of idsProjet) {
        if (tousSelectionnes) next.delete(id); else next.add(id);
      }
      return next;
    });
  };

  const toggleTout = () => {
    if (selection.size === lignes.length) {
      setSelection(new Set());
    } else {
      setSelection(new Set(lignes.map((l) => l.id)));
    }
  };

  // ── Regroupement par projet ──────────────────────────────────────────────

  const groupes = useMemo(() => {
    const m = new Map<string, BeneficiaireZzz[]>();
    for (const l of lignes) {
      if (!m.has(l.projet_code)) m.set(l.projet_code, []);
      m.get(l.projet_code)!.push(l);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [lignes]);

  // ── Rendu ────────────────────────────────────────────────────────────────

  if (lignes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Check className="mx-auto mb-3 size-10 text-emerald-500" />
          <p className="text-lg font-semibold text-slate-700">
            Tous les pays inconnus ont ete resolus.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Resume par projet ────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {resumeProjets.map((r) => (
          <Card key={r.projet_code} className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-800">
                {r.projet_code}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-slate-600">
              <p>
                <span className="font-semibold text-amber-700">{r.total}</span> ZZZ
                {r.sans_tranche > 0 && (
                  <> &middot; {r.sans_tranche} sans tranche</>
                )}
                {r.nom_inconnu > 0 && (
                  <> &middot; <span className="text-red-600">{r.nom_inconnu} nom inconnu</span></>
                )}
              </p>
              {r.pays_majoritaire ? (
                <p>
                  Pays majoritaire :{' '}
                  <span className="font-semibold text-emerald-700">
                    {r.pays_majoritaire.libelle_fr}
                  </span>{' '}
                  <span className="text-slate-400">
                    ({r.pays_majoritaire.pct}%)
                  </span>
                  {r.pays_majoritaire.pct < 30 && (
                    <Badge variant="outline" className="ml-1 border-amber-300 text-amber-700 text-[10px]">
                      suggestion faible
                    </Badge>
                  )}
                </p>
              ) : (
                <p className="text-slate-400">Pas de pays majoritaire</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Barre d'actions bulk ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <span className="text-sm font-medium text-slate-700">
          {selection.size > 0
            ? `${selection.size} selectionne(s)`
            : `${lignes.length} restant(s)`}
        </span>

        <div className="flex items-center gap-2">
          <select
            value={paysBulk}
            onChange={(e) => setPaysBulk(e.target.value)}
            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">-- Pays --</option>
            {pays.map((p) => (
              <option key={p.code_iso} value={p.code_iso}>
                {p.libelle_fr} ({p.code_iso})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleBulkCorriger}
            disabled={pending || selection.size === 0 || !paysBulk}
          >
            <Check className="mr-1 size-3.5" />
            Appliquer a la selection
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkIgnorer}
            disabled={pending || selection.size === 0}
          >
            <X className="mr-1 size-3.5" />
            Ignorer la selection
          </Button>
        </div>
      </div>

      {/* ── Tableau par groupe de projet ──────────────────────────────────── */}
      {groupes.map(([projetCode, membres]) => {
        const idsProjet = membres.map((m) => m.id);
        const tousSelectionnes = idsProjet.every((id) => selection.has(id));
        const suggestion = suggestedPays.get(projetCode) ?? '';

        return (
          <div key={projetCode} className="overflow-hidden rounded-lg border border-slate-200">
            {/* Header du groupe */}
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2">
              <input
                type="checkbox"
                checked={tousSelectionnes}
                onChange={() => toggleToutProjet(projetCode)}
                className="size-4 rounded border-slate-300"
                aria-label={`Selectionner tout ${projetCode}`}
              />
              <span className="text-sm font-bold text-slate-800">{projetCode}</span>
              <Badge variant="outline" className="text-xs">{membres.length} lignes</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={tousSelectionnes}
                        onChange={() => toggleToutProjet(projetCode)}
                        className="size-3.5 rounded border-slate-300"
                        aria-label="Tout selectionner"
                      />
                    </th>
                    <th className="px-3 py-2 text-left">Nom</th>
                    <th className="px-3 py-2 text-left">Sexe</th>
                    <th className="px-3 py-2 text-left">Tranche</th>
                    <th className="px-3 py-2 text-left">Naissance</th>
                    <th className="px-3 py-2 text-left">Formation</th>
                    <th className="px-3 py-2 text-left">Pays</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {membres.map((b) => (
                    <LigneBeneficiaire
                      key={b.id}
                      beneficiaire={b}
                      pays={pays}
                      suggestion={suggestion}
                      selected={selection.has(b.id)}
                      onToggle={() => toggleSelection(b.id)}
                      onCorriger={handleCorriger}
                      onIgnorer={handleIgnorer}
                      pending={pending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Ligne individuelle ───────────────────────────────────────────────────────

function LigneBeneficiaire({
  beneficiaire: b,
  pays,
  suggestion,
  selected,
  onToggle,
  onCorriger,
  onIgnorer,
  pending,
}: {
  beneficiaire: BeneficiaireZzz;
  pays: { code_iso: string; libelle_fr: string }[];
  suggestion: string;
  selected: boolean;
  onToggle: () => void;
  onCorriger: (id: string, paysCode: string) => void;
  onIgnorer: (id: string) => void;
  pending: boolean;
}) {
  const [paysChoisi, setPaysChoisi] = useState(suggestion);
  const estNomInconnu = b.nom === 'Nom inconnu';

  return (
    <tr className={`transition-colors ${selected ? 'bg-blue-50/50' : 'hover:bg-slate-50'} ${estNomInconnu ? 'opacity-60' : ''}`}>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="size-3.5 rounded border-slate-300"
        />
      </td>
      <td className="px-3 py-2">
        <div className="font-medium text-slate-800">
          {b.nom}
          {estNomInconnu && (
            <AlertTriangle className="ml-1 inline size-3 text-amber-500" />
          )}
        </div>
        <div className="text-xs text-slate-400">{b.prenom}</div>
      </td>
      <td className="px-3 py-2 text-slate-600">{b.sexe ?? '—'}</td>
      <td className="px-3 py-2">
        {b.tranche_age_declaree ? (
          <Badge variant="outline" className="text-xs">{b.tranche_age_declaree}</Badge>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-slate-600">
        {b.annee_naissance ?? '—'}
      </td>
      <td className="px-3 py-2 text-slate-600">
        {b.annee_formation ?? '—'}
      </td>
      <td className="px-3 py-2">
        <select
          value={paysChoisi}
          onChange={(e) => setPaysChoisi(e.target.value)}
          className="h-7 w-40 rounded border border-slate-300 bg-white px-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">-- Choisir --</option>
          {pays.map((p) => (
            <option key={p.code_iso} value={p.code_iso}>
              {p.libelle_fr} ({p.code_iso})
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="default"
            className="h-7 px-2 text-xs"
            onClick={() => onCorriger(b.id, paysChoisi)}
            disabled={pending || !paysChoisi}
          >
            <Check className="mr-0.5 size-3" />
            OK
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-slate-400 hover:text-red-600"
            onClick={() => onIgnorer(b.id)}
            disabled={pending}
            title="Ignorer — donnees insuffisantes"
          >
            <X className="size-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
