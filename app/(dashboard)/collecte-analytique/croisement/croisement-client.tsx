'use client';

import { useState } from 'react';
import type { CroisementLigne, croisementBeneficiaires } from '@/lib/collecte-analytique/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, Users, ExternalLink } from 'lucide-react';
import { PAYS_OIF } from '@/lib/schemas/nomenclatures';
import Link from 'next/link';

const PAYS_MAP = new Map(PAYS_OIF.map((p) => [p.code, p.label]));

const CHAMP_LIBELLES: Record<string, string> = {
  prenom: 'Prénom',
  nom: 'Nom',
  sexe: 'Sexe',
  tranche_age_declaree: "Tranche d'âge",
  pays_code: 'Pays',
  projet_code: 'Projet',
  domaine_formation_code: 'Domaine formation',
  statut_code: 'Statut professionnel',
  consentement_recueilli: 'Consentement',
};

function CompletudeBarre({ remplis, total }: { remplis: number; total: number }) {
  const pct = Math.round((remplis / total) * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground text-xs">{pct}%</span>
    </div>
  );
}

function TableauLignes({ lignes, titre, couleur, badge }: {
  lignes: CroisementLigne[];
  titre: string;
  couleur: string;
  badge: string;
}) {
  const [detail, setDetail] = useState<CroisementLigne | null>(null);

  if (lignes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-4 text-emerald-500" />
            {titre}
            <Badge variant="outline" className="ml-auto font-normal">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Aucun enregistrement dans cette catégorie.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className={`inline-flex size-5 items-center justify-center rounded-full text-xs text-white ${couleur}`}>
              {lignes.length}
            </span>
            {titre}
            <Badge variant="outline" className={`ml-auto text-xs ${badge}`}>{lignes.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nom</th>
                  <th className="px-3 py-2 text-left font-medium">Prénom</th>
                  <th className="px-3 py-2 text-left font-medium">Pays</th>
                  <th className="px-3 py-2 text-left font-medium">Projet</th>
                  <th className="px-3 py-2 text-left font-medium">Complétude</th>
                  <th className="px-3 py-2 text-left font-medium">Champs manquants</th>
                  <th className="px-3 py-2 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lignes.map((l) => (
                  <tr key={l.soumission_id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{l.nom}</td>
                    <td className="px-3 py-2">{l.prenom}</td>
                    <td className="px-3 py-2 text-xs">{l.pays_code ? (PAYS_MAP.get(l.pays_code) ?? l.pays_code) : '—'}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="font-mono text-xs">{l.projet_code ?? '—'}</Badge></td>
                    <td className="px-3 py-2">
                      <CompletudeBarre remplis={l.nb_champs_remplis} total={l.nb_champs_total} />
                    </td>
                    <td className="px-3 py-2 text-xs text-red-700">
                      {l.champs_manquants.length > 0
                        ? l.champs_manquants.slice(0, 3).map((c) => CHAMP_LIBELLES[c] ?? c).join(', ') +
                          (l.champs_manquants.length > 3 ? ` +${l.champs_manquants.length - 3}` : '')
                        : <span className="text-emerald-600">Complet</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(l)} title="Détails">
                          <AlertCircle className="size-4" />
                        </Button>
                        {l.entite_id && (
                          <Link href={`/beneficiaires/${l.entite_id}`} target="_blank">
                            <Button variant="ghost" size="sm" title="Voir le bénéficiaire">
                              <ExternalLink className="size-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.prenom} {detail?.nom}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Email</span><p>{detail.email ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Pays</span><p>{detail.pays_code ? (PAYS_MAP.get(detail.pays_code) ?? detail.pays_code) : '—'}</p></div>
                <div><span className="text-muted-foreground">Projet</span><p>{detail.projet_code ?? '—'}</p></div>
                <div>
                  <span className="text-muted-foreground">Soumis le</span>
                  <p>{new Date(detail.soumission_created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <div>
                <p className="mb-2 font-medium">Champs manquants ({detail.champs_manquants.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.champs_manquants.map((c) => (
                    <Badge key={c} variant="outline" className="text-red-700 border-red-200 bg-red-50">
                      {CHAMP_LIBELLES[c] ?? c}
                    </Badge>
                  ))}
                </div>
              </div>
              {detail.entite_id && (
                <Link href={`/beneficiaires/${detail.entite_id}`} target="_blank">
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <ExternalLink className="size-4" />
                    Ouvrir la fiche bénéficiaire pour compléter
                  </Button>
                </Link>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

type Props = {
  data: Awaited<ReturnType<typeof croisementBeneficiaires>>;
};

export function CroisementClient({ data }: Props) {
  return (
    <div className="space-y-6">
      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="size-8 text-blue-500" />
            <div>
              <p className="text-muted-foreground text-xs">Soumissions validées</p>
              <p className="text-2xl font-semibold">{data.total_valides}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="size-8 text-amber-500" />
            <div>
              <p className="text-muted-foreground text-xs">Fiches incomplètes</p>
              <p className="text-2xl font-semibold">{data.incompletes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-8 text-emerald-500" />
            <div>
              <p className="text-muted-foreground text-xs">Complètes</p>
              <p className="text-2xl font-semibold">
                {data.total_valides - data.incompletes.length - data.nouvelles.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.nouvelles.length > 0 && (
        <TableauLignes
          lignes={data.nouvelles}
          titre="Soumissions sans entité créée"
          couleur="bg-red-500"
          badge="text-red-700 border-red-200 bg-red-50"
        />
      )}

      <TableauLignes
        lignes={data.incompletes}
        titre="Fiches bénéficiaires incomplètes"
        couleur="bg-amber-500"
        badge="text-amber-700 border-amber-200 bg-amber-50"
      />
    </div>
  );
}
