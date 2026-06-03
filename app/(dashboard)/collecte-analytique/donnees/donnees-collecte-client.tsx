'use client';

import { useState, useTransition } from 'react';
import { listerSoumissionsCollectees } from '@/lib/collecte-analytique/actions';
import type { SoumissionsResult, TypeCollecte, StatutSoumission } from '@/lib/collecte-analytique/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Eye, Search } from 'lucide-react';
import { PAYS_OIF } from '@/lib/schemas/nomenclatures';

const PAYS_MAP = new Map(PAYS_OIF.map((p) => [p.code, p.label]));

const TYPE_LABELS: Record<string, string> = {
  '0': 'Type 0 — Unifié',
  A: 'Type A — Bénéficiaire',
  B: 'Type B — Structure',
  C: 'Type C — Intermédiation',
  D: 'Type D — Écosystème',
};

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-800 border-amber-200',
  valide:     'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejete:     'bg-red-100 text-red-800 border-red-200',
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  valide:     'Validé',
  rejete:     'Rejeté',
};

type Props = { initialData: SoumissionsResult };

export function DonneesCollecteClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [type, setType] = useState<TypeCollecte | 'tous'>('tous');
  const [statut, setStatut] = useState<StatutSoumission | 'tous'>('tous');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<(typeof initialData.lignes)[0] | null>(null);
  const [isPending, startTransition] = useTransition();

  const PAGE_SIZE = 50;

  function charger(t: typeof type, s: typeof statut, p: number) {
    startTransition(async () => {
      const res = await listerSoumissionsCollectees({ type: t, statut: s, page: p, pageSize: PAGE_SIZE });
      setData(res);
      setPage(p);
    });
  }

  const filtrees = data.lignes.filter((l) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return (
      l.nom_principal.toLowerCase().includes(q) ||
      (l.contact ?? '').toLowerCase().includes(q) ||
      (l.lien_label ?? '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(['tous', '0', 'A', 'B', 'C', 'D'] as const).map((t) => (
          <Card
            key={t}
            className={`cursor-pointer transition-all ${type === t ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => { setType(t); charger(t, statut, 1); }}
          >
            <CardContent className="px-3 py-2">
              <p className="text-muted-foreground text-xs">{t === 'tous' ? 'Tous types' : TYPE_LABELS[t]?.split('—')[0]}</p>
              <p className="text-xl font-semibold">{data.stats[t] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher…"
            className="pl-8 w-52"
          />
        </div>
        <Select value={statut} onValueChange={(v) => { setStatut(v as typeof statut); charger(type, v as typeof statut, 1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="valide">Validés</SelectItem>
            <SelectItem value="rejete">Rejetés</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => charger(type, statut, page)} disabled={isPending}>
          <RefreshCw className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
        </Button>
        <span className="text-muted-foreground ml-auto text-sm">{data.total} soumission{data.total > 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Statut</th>
              <th className="px-3 py-2 text-left font-medium">Nom / Entité</th>
              <th className="px-3 py-2 text-left font-medium">Contact</th>
              <th className="px-3 py-2 text-left font-medium">Pays</th>
              <th className="px-3 py-2 text-left font-medium">Lien</th>
              <th className="px-3 py-2 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtrees.length === 0 ? (
              <tr><td colSpan={8} className="text-muted-foreground px-3 py-8 text-center">Aucune soumission</td></tr>
            ) : filtrees.map((l) => (
              <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-xs font-mono">{l.type}</Badge>
                  {l.categorie_repondant && (
                    <span className="text-muted-foreground ml-1 text-xs">({l.categorie_repondant})</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUT_COLORS[l.statut]}`}>
                    {STATUT_LABELS[l.statut]}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium max-w-[180px] truncate">{l.nom_principal}</td>
                <td className="text-muted-foreground px-3 py-2 max-w-[160px] truncate">{l.contact ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{l.pays_code ? (PAYS_MAP.get(l.pays_code) ?? l.pays_code) : '—'}</td>
                <td className="text-muted-foreground px-3 py-2 max-w-[140px] truncate text-xs">{l.lien_label ?? '—'}</td>
                <td className="px-3 py-2">
                  <Button variant="ghost" size="sm" onClick={() => setDetail(l)}>
                    <Eye className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => charger(type, statut, page - 1)}>Précédent</Button>
          <span className="text-muted-foreground text-sm">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => charger(type, statut, page + 1)}>Suivant</Button>
        </div>
      )}

      {/* Modal détail */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail — {detail?.nom_principal}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Type</span><p className="font-medium">{TYPE_LABELS[detail.type] ?? detail.type}</p></div>
                <div><span className="text-muted-foreground">Statut</span><p className="font-medium">{STATUT_LABELS[detail.statut]}</p></div>
                <div><span className="text-muted-foreground">Soumis le</span><p>{new Date(detail.created_at).toLocaleString('fr-FR')}</p></div>
                {detail.valide_at && <div><span className="text-muted-foreground">Validé le</span><p>{new Date(detail.valide_at).toLocaleString('fr-FR')}</p></div>}
                {detail.lien_label && <div><span className="text-muted-foreground">Lien</span><p>{detail.lien_label}</p></div>}
                {detail.entite_creee_id && <div><span className="text-muted-foreground">Entité créée</span><p className="font-mono text-xs truncate">{detail.entite_creee_id}</p></div>}
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">Données brutes</p>
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                  {JSON.stringify(detail.donnees, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
