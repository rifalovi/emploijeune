'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrancheAgePrecise } from '@/lib/super-admin/tranches-age-actions';
import {
  creerTrancheAge,
  modifierTrancheAge,
  toggleActifTrancheAge,
} from '@/lib/super-admin/tranches-age-actions';

type Props = {
  tranches: TrancheAgePrecise[];
};

export function TranchesAgeClient({ tranches: initial }: Props) {
  const [tranches, setTranches] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [ajoutVisible, setAjoutVisible] = useState(false);

  const handleToggle = (id: string, actif: boolean) => {
    startTransition(async () => {
      const res = await toggleActifTrancheAge(id, !actif);
      if (res.status === 'succes') {
        setTranches((prev) => prev.map((t) => (t.id === id ? { ...t, actif: !actif } : t)));
        toast.success(actif ? 'Tranche desactivee.' : 'Tranche activee.');
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Tableau */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Tranches configurees</CardTitle>
          <Button size="sm" onClick={() => setAjoutVisible(true)} disabled={ajoutVisible}>
            <Plus className="mr-1 size-3.5" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Ordre</th>
                  <th className="px-3 py-2 text-left">Libelle</th>
                  <th className="px-3 py-2 text-center">Bornes</th>
                  <th className="px-3 py-2 text-center">Categorie OIF</th>
                  <th className="px-3 py-2 text-center">Actif</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tranches.map((t) => (
                  <LigneTranche
                    key={t.id}
                    tranche={t}
                    onToggle={handleToggle}
                    pending={pending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Formulaire d'ajout */}
      {ajoutVisible && (
        <FormulaireAjout
          ordreMax={Math.max(0, ...tranches.map((t) => t.ordre)) + 1}
          onAjoute={(t) => {
            setTranches((prev) => [...prev, t].sort((a, b) => a.ordre - b.ordre));
            setAjoutVisible(false);
          }}
          onAnnuler={() => setAjoutVisible(false)}
        />
      )}
    </div>
  );
}

// ── Ligne ────────────────────────────────────────────────────────────────────

function LigneTranche({
  tranche: t,
  onToggle,
  pending,
}: {
  tranche: TrancheAgePrecise;
  onToggle: (id: string, actif: boolean) => void;
  pending: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [form, setForm] = useState({
    libelle: t.libelle,
    borne_min: t.borne_min,
    borne_max: t.borne_max,
    categorie_oif: t.categorie_oif,
    ordre: t.ordre,
  });
  const [savePending, startSave] = useTransition();

  const handleSave = () => {
    startSave(async () => {
      const res = await modifierTrancheAge({ id: t.id, ...form });
      if (res.status === 'succes') {
        toast.success('Tranche modifiee.');
        setEdition(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  if (edition) {
    return (
      <tr className="bg-blue-50/50">
        <td className="px-3 py-2">
          <input
            type="number"
            value={form.ordre}
            onChange={(e) => setForm({ ...form, ordre: Number(e.target.value) })}
            className="w-14 rounded border px-2 py-1 text-xs"
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="text"
            value={form.libelle}
            onChange={(e) => setForm({ ...form, libelle: e.target.value })}
            className="w-32 rounded border px-2 py-1 text-xs"
          />
        </td>
        <td className="px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1">
            <input
              type="number"
              value={form.borne_min ?? ''}
              onChange={(e) => setForm({ ...form, borne_min: e.target.value ? Number(e.target.value) : null })}
              className="w-14 rounded border px-2 py-1 text-xs"
              placeholder="min"
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              value={form.borne_max ?? ''}
              onChange={(e) => setForm({ ...form, borne_max: e.target.value ? Number(e.target.value) : null })}
              className="w-14 rounded border px-2 py-1 text-xs"
              placeholder="max"
            />
          </div>
        </td>
        <td className="px-3 py-2 text-center">
          <select
            value={form.categorie_oif}
            onChange={(e) => setForm({ ...form, categorie_oif: e.target.value as 'Jeune' | 'Adulte' })}
            className="rounded border px-2 py-1 text-xs"
          >
            <option value="Jeune">Jeune</option>
            <option value="Adulte">Adulte</option>
          </select>
        </td>
        <td className="px-3 py-2 text-center">
          <Badge variant="outline" className={t.actif ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-400'}>
            {t.actif ? 'Oui' : 'Non'}
          </Badge>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSave} disabled={savePending}>
              <Save className="mr-0.5 size-3" /> OK
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEdition(false)}>
              Annuler
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`hover:bg-slate-50 ${!t.actif ? 'opacity-50' : ''}`}>
      <td className="px-3 py-2 text-slate-500">{t.ordre}</td>
      <td className="px-3 py-2 font-medium text-slate-800">{t.libelle}</td>
      <td className="px-3 py-2 text-center text-slate-600">
        {t.borne_min ?? '—'} — {t.borne_max ?? '+'}
      </td>
      <td className="px-3 py-2 text-center">
        <Badge
          variant="outline"
          className={t.categorie_oif === 'Jeune'
            ? 'border-cyan-300 text-cyan-700'
            : 'border-purple-300 text-purple-700'}
        >
          {t.categorie_oif}
        </Badge>
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={() => onToggle(t.id, t.actif)}
          disabled={pending}
          className="inline-flex items-center"
          title={t.actif ? 'Desactiver' : 'Activer'}
        >
          {t.actif
            ? <ToggleRight className="size-5 text-emerald-500" />
            : <ToggleLeft className="size-5 text-slate-400" />}
        </button>
      </td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEdition(true)}>
          Modifier
        </Button>
      </td>
    </tr>
  );
}

// ── Formulaire d'ajout ───────────────────────────────────────────────────────

function FormulaireAjout({
  ordreMax,
  onAjoute,
  onAnnuler,
}: {
  ordreMax: number;
  onAjoute: (t: TrancheAgePrecise) => void;
  onAnnuler: () => void;
}) {
  const [form, setForm] = useState({
    libelle: '',
    borne_min: null as number | null,
    borne_max: null as number | null,
    categorie_oif: 'Jeune' as 'Jeune' | 'Adulte',
    ordre: ordreMax,
  });
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const res = await creerTrancheAge(form);
      if (res.status === 'succes') {
        toast.success(`Tranche "${form.libelle}" creee.`);
        onAjoute({
          id: crypto.randomUUID(),
          ...form,
          actif: true,
          created_at: new Date().toISOString(),
        });
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Card className="border-indigo-200 bg-indigo-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Nouvelle tranche</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div>
            <label className="text-xs font-medium text-slate-600">Libelle</label>
            <input
              type="text"
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              placeholder="ex. 18-24 ans"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Borne min</label>
            <input
              type="number"
              value={form.borne_min ?? ''}
              onChange={(e) => setForm({ ...form, borne_min: e.target.value ? Number(e.target.value) : null })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              placeholder="15"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Borne max</label>
            <input
              type="number"
              value={form.borne_max ?? ''}
              onChange={(e) => setForm({ ...form, borne_max: e.target.value ? Number(e.target.value) : null })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              placeholder="24"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Categorie OIF</label>
            <select
              value={form.categorie_oif}
              onChange={(e) => setForm({ ...form, categorie_oif: e.target.value as 'Jeune' | 'Adulte' })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            >
              <option value="Jeune">Jeune</option>
              <option value="Adulte">Adulte</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Ordre</label>
            <input
              type="number"
              value={form.ordre}
              onChange={(e) => setForm({ ...form, ordre: Number(e.target.value) })}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={pending || !form.libelle}>
            <Plus className="mr-1 size-3.5" /> Creer
          </Button>
          <Button size="sm" variant="outline" onClick={onAnnuler}>Annuler</Button>
        </div>
      </CardContent>
    </Card>
  );
}
