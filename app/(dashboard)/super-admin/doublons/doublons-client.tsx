'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Merge, Layers, Eye, Trash2, Search, Loader2, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  DoublonGroupe,
  DoublonGroupeStructure,
  OccurrenceBeneficiaire,
  OccurrenceStructure,
} from '@/lib/super-admin/import-sessions-actions';
import {
  fusionnerDoublons,
  fusionnerDoublonsBulk,
  listerOccurrencesBeneficiaires,
  listerOccurrencesStructures,
  supprimerBeneficiaire,
  supprimerStructure,
} from '@/lib/super-admin/import-sessions-actions';

type Props = { beneficiaires: DoublonGroupe[]; structures: DoublonGroupeStructure[] };

type Onglet = 'beneficiaires' | 'structures';
const PAGE = 30;

export function DoublonsClient({ beneficiaires: initBenef, structures: initStruct }: Props) {
  const [benef, setBenef] = useState(initBenef);
  const [struct, setStruct] = useState(initStruct);
  const [onglet, setOnglet] = useState<Onglet>(
    initBenef.length === 0 && initStruct.length > 0 ? 'structures' : 'beneficiaires',
  );
  const [recherche, setRecherche] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [pending, startTransition] = useTransition();

  // Modal de détail des occurrences
  const [modal, setModal] = useState<{
    type: Onglet;
    cle: string;
    ids: string[];
  } | null>(null);
  const [occBenef, setOccBenef] = useState<OccurrenceBeneficiaire[]>([]);
  const [occStruct, setOccStruct] = useState<OccurrenceStructure[]>([]);
  const [chargementOcc, setChargementOcc] = useState(false);

  const listeFiltree = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const base =
      onglet === 'beneficiaires'
        ? benef.map((d) => ({
            cle: d.cle_identite,
            occ: d.occurrences,
            dates: d.dates_creation,
            ids: d.beneficiaire_ids,
          }))
        : struct.map((d) => ({
            cle: d.cle_identite,
            occ: d.occurrences,
            dates: d.dates_creation,
            ids: d.structure_ids,
          }));
    if (!q) return base;
    return base.filter((d) => d.cle.toLowerCase().includes(q));
  }, [onglet, benef, struct, recherche]);

  const changerOnglet = (o: Onglet) => {
    setOnglet(o);
    setRecherche('');
    setVisible(PAGE);
  };

  const handleFusionner = (cle: string) => {
    startTransition(async () => {
      const res = await fusionnerDoublons(cle);
      if (res.status === 'succes') {
        toast.success(`${res.data.fusionnes} doublon(s) fusionné(s).`);
        setBenef((prev) => prev.filter((d) => d.cle_identite !== cle));
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleBulk = () => {
    startTransition(async () => {
      const res = await fusionnerDoublonsBulk();
      if (res.status === 'succes') {
        toast.success(`${res.data.nb_fusionnes} doublon(s) fusionné(s) au total.`);
        setBenef([]);
      } else {
        toast.error(res.message);
      }
    });
  };

  const ouvrirDetail = (type: Onglet, cle: string, ids: string[]) => {
    setModal({ type, cle, ids });
    setOccBenef([]);
    setOccStruct([]);
    setChargementOcc(true);
    startTransition(async () => {
      if (type === 'beneficiaires') {
        setOccBenef(await listerOccurrencesBeneficiaires(ids));
      } else {
        setOccStruct(await listerOccurrencesStructures(ids));
      }
      setChargementOcc(false);
    });
  };

  // Supprime une occurrence et met à jour le groupe ; ferme le modal si le
  // groupe n'a plus qu'une fiche (n'est plus un doublon).
  const handleSupprimer = (type: Onglet, id: string) => {
    startTransition(async () => {
      const res =
        type === 'beneficiaires' ? await supprimerBeneficiaire(id) : await supprimerStructure(id);
      if (res.status !== 'succes') {
        toast.error(res.message);
        return;
      }
      toast.success('Fiche supprimée de la base.');
      const cle = modal?.cle;
      let resteGroupe = 0;
      if (type === 'beneficiaires') {
        const reste = occBenef.filter((o) => o.id !== id);
        setOccBenef(reste);
        resteGroupe = reste.length;
        setBenef((prev) =>
          prev
            .map((d) =>
              d.cle_identite === cle
                ? {
                    ...d,
                    occurrences: d.occurrences - 1,
                    beneficiaire_ids: d.beneficiaire_ids.filter((x) => x !== id),
                  }
                : d,
            )
            .filter((d) => d.occurrences > 1),
        );
      } else {
        const reste = occStruct.filter((o) => o.id !== id);
        setOccStruct(reste);
        resteGroupe = reste.length;
        setStruct((prev) =>
          prev
            .map((d) =>
              d.cle_identite === cle
                ? {
                    ...d,
                    occurrences: d.occurrences - 1,
                    structure_ids: d.structure_ids.filter((x) => x !== id),
                  }
                : d,
            )
            .filter((d) => d.occurrences > 1),
        );
      }
      if (resteGroupe <= 1) setModal(null);
    });
  };

  const totalDoublonsBenef = benef.reduce((acc, d) => acc + d.occurrences - 1, 0);

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="inline-flex overflow-hidden rounded-lg border">
        <BoutonOnglet
          actif={onglet === 'beneficiaires'}
          onClick={() => changerOnglet('beneficiaires')}
          icone={<Users className="size-4" />}
          label="Bénéficiaires (A1)"
          n={benef.length}
        />
        <BoutonOnglet
          actif={onglet === 'structures'}
          onClick={() => changerOnglet('structures')}
          icone={<Building2 className="size-4" />}
          label="Structures (B1)"
          n={struct.length}
        />
      </div>

      {/* Bandeau action (fusion bulk : bénéficiaires uniquement) */}
      {onglet === 'beneficiaires' && benef.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
            <p className="text-sm text-purple-800">
              <span className="font-semibold">{totalDoublonsBenef}</span> fiche(s) en doublon dans{' '}
              <span className="font-semibold">{benef.length}</span> groupe(s). La fusion garde la
              plus ancienne et soft-delete les autres.
            </p>
            <Button
              size="sm"
              onClick={handleBulk}
              disabled={pending}
              className="shrink-0 bg-purple-600 hover:bg-purple-700"
            >
              <Layers className="mr-1 size-3.5" />
              Fusionner tous
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value);
            setVisible(PAGE);
          }}
          placeholder="Rechercher une identité…"
          className="w-full rounded-md border border-slate-300 py-1.5 pr-3 pl-8 text-sm focus:ring-1 focus:ring-purple-500 focus:outline-none"
        />
      </div>

      {/* Tableau */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {onglet === 'beneficiaires' ? 'Doublons de bénéficiaires' : 'Doublons de structures'} —{' '}
            {listeFiltree.length} groupe(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listeFiltree.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Aucun groupe {recherche ? 'ne correspond à la recherche' : 'de doublons'}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Identité</th>
                    <th className="px-3 py-2 text-center">Occurrences</th>
                    <th className="px-3 py-2 text-left">Première</th>
                    <th className="px-3 py-2 text-left">Dernière</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listeFiltree.slice(0, visible).map((d) => (
                    <tr key={d.cle} className="hover:bg-slate-50">
                      <td
                        className="max-w-[320px] truncate px-3 py-2 font-medium text-slate-800"
                        title={d.cle}
                      >
                        {d.cle}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className="border-red-300 text-red-600">
                          {d.occ}x
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(d.dates[0])}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {fmtDate(d.dates[d.dates.length - 1])}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => ouvrirDetail(onglet, d.cle, d.ids)}
                          >
                            <Eye className="mr-1 size-3" /> Détailler
                          </Button>
                          {onglet === 'beneficiaires' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleFusionner(d.cle)}
                              disabled={pending}
                            >
                              <Merge className="mr-1 size-3" /> Fusionner
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible < listeFiltree.length && (
                <div className="pt-3 text-center">
                  <Button size="sm" variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
                    Afficher plus ({listeFiltree.length - visible} restant(s))
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal détail des occurrences */}
      <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modal?.type === 'structures' ? (
                <Building2 className="size-5 text-emerald-600" />
              ) : (
                <Users className="size-5 text-blue-600" />
              )}
              Occurrences du doublon
            </DialogTitle>
            <DialogDescription className="font-mono text-xs break-words">
              {modal?.cle}
            </DialogDescription>
          </DialogHeader>

          {chargementOcc ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="mr-2 size-5 animate-spin" /> Chargement des fiches…
            </div>
          ) : modal?.type === 'beneficiaires' ? (
            <TableOccurrencesBenef
              occ={occBenef}
              pending={pending}
              onSupprimer={(id) => handleSupprimer('beneficiaires', id)}
            />
          ) : (
            <TableOccurrencesStruct
              occ={occStruct}
              pending={pending}
              onSupprimer={(id) => handleSupprimer('structures', id)}
            />
          )}

          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ « Supprimer » retire la fiche de la base (soft-delete, réversible par un
            super-admin). Garde au moins une fiche par identité.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BoutonOnglet({
  actif,
  onClick,
  icone,
  label,
  n,
}: {
  actif: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  label: string;
  n: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
        actif ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {icone}
      {label}
      <Badge
        variant="outline"
        className={actif ? 'border-white/40 text-white' : 'border-slate-300 text-slate-500'}
      >
        {n}
      </Badge>
    </button>
  );
}

function TableOccurrencesBenef({
  occ,
  pending,
  onSupprimer,
}: {
  occ: OccurrenceBeneficiaire[];
  pending: boolean;
  onSupprimer: (id: string) => void;
}) {
  if (occ.length === 0)
    return <p className="py-6 text-center text-sm text-slate-400">Aucune fiche.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-2 py-1.5">Prénom</th>
            <th className="px-2 py-1.5">Nom</th>
            <th className="px-2 py-1.5">Sexe</th>
            <th className="px-2 py-1.5">Projet</th>
            <th className="px-2 py-1.5">Pays</th>
            <th className="px-2 py-1.5">Courriel</th>
            <th className="px-2 py-1.5">Téléphone</th>
            <th className="px-2 py-1.5">Créée le</th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {occ.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50">
              <td className="px-2 py-1.5">{o.prenom ?? '—'}</td>
              <td className="px-2 py-1.5 font-medium">{o.nom ?? '—'}</td>
              <td className="px-2 py-1.5">{o.sexe ?? '—'}</td>
              <td className="px-2 py-1.5">{o.projet_code ?? '—'}</td>
              <td className="px-2 py-1.5">{o.pays_code ?? '—'}</td>
              <td className="px-2 py-1.5 font-mono">{o.courriel ?? '—'}</td>
              <td className="px-2 py-1.5 font-mono">{o.telephone ?? '—'}</td>
              <td className="px-2 py-1.5 text-slate-500">{fmtDate(o.created_at)}</td>
              <td className="px-2 py-1.5 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 border-red-200 px-1.5 text-[11px] text-red-600 hover:bg-red-50"
                  onClick={() => onSupprimer(o.id)}
                  disabled={pending}
                >
                  <Trash2 className="size-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableOccurrencesStruct({
  occ,
  pending,
  onSupprimer,
}: {
  occ: OccurrenceStructure[];
  pending: boolean;
  onSupprimer: (id: string) => void;
}) {
  if (occ.length === 0)
    return <p className="py-6 text-center text-sm text-slate-400">Aucune fiche.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-2 py-1.5">Structure</th>
            <th className="px-2 py-1.5">Pays</th>
            <th className="px-2 py-1.5">Projet</th>
            <th className="px-2 py-1.5">Porteur</th>
            <th className="px-2 py-1.5">Courriel</th>
            <th className="px-2 py-1.5">Téléphone</th>
            <th className="px-2 py-1.5">Année</th>
            <th className="px-2 py-1.5">Créée le</th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {occ.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50">
              <td className="px-2 py-1.5 font-medium">{o.nom_structure ?? '—'}</td>
              <td className="px-2 py-1.5">{o.pays_code ?? '—'}</td>
              <td className="px-2 py-1.5">{o.projet_code ?? '—'}</td>
              <td className="px-2 py-1.5">{o.porteur_nom ?? '—'}</td>
              <td className="px-2 py-1.5 font-mono">{o.courriel_porteur ?? '—'}</td>
              <td className="px-2 py-1.5 font-mono">{o.telephone_porteur ?? '—'}</td>
              <td className="px-2 py-1.5">{o.annee_appui ?? '—'}</td>
              <td className="px-2 py-1.5 text-slate-500">{fmtDate(o.created_at)}</td>
              <td className="px-2 py-1.5 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 border-red-200 px-1.5 text-[11px] text-red-600 hover:bg-red-50"
                  onClick={() => onSupprimer(o.id)}
                  disabled={pending}
                >
                  <Trash2 className="size-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
