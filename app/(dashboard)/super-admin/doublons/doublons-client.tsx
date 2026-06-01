'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Merge, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DoublonGroupe } from '@/lib/super-admin/import-sessions-actions';
import { fusionnerDoublons, fusionnerDoublonsBulk } from '@/lib/super-admin/import-sessions-actions';

type Props = { doublons: DoublonGroupe[] };

export function DoublonsClient({ doublons: initial }: Props) {
  const [doublons, setDoublons] = useState(initial);
  const [pending, startTransition] = useTransition();

  const handleFusionner = (cle: string) => {
    startTransition(async () => {
      const res = await fusionnerDoublons(cle);
      if (res.status === 'succes') {
        toast.success(`${res.data.fusionnes} doublon(s) fusionne(s).`);
        setDoublons((prev) => prev.filter((d) => d.cle_identite !== cle));
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleBulk = () => {
    startTransition(async () => {
      const res = await fusionnerDoublonsBulk();
      if (res.status === 'succes') {
        toast.success(`${res.data.nb_fusionnes} doublon(s) fusionne(s) au total.`);
        setDoublons([]);
      } else {
        toast.error(res.message);
      }
    });
  };

  const totalDoublons = doublons.reduce((acc, d) => acc + d.occurrences - 1, 0);

  return (
    <div className="space-y-4">
      {/* Action bulk */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardContent className="flex items-center justify-between py-3">
          <p className="text-sm text-purple-800">
            <span className="font-semibold">{totalDoublons}</span> ligne(s) en doublon dans{' '}
            <span className="font-semibold">{doublons.length}</span> groupe(s).
            La fusion garde le plus ancien et soft-delete les autres.
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

      {/* Tableau */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Groupes de doublons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Identite</th>
                  <th className="px-3 py-2 text-center">Occurrences</th>
                  <th className="px-3 py-2 text-left">Premiere</th>
                  <th className="px-3 py-2 text-left">Derniere</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doublons.map((d) => (
                  <tr key={d.cle_identite} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800 max-w-[300px] truncate" title={d.cle_identite}>
                      {d.cle_identite}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="outline" className="border-red-300 text-red-600">
                        {d.occurrences}x
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(d.dates_creation[0]!).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(d.dates_creation[d.dates_creation.length - 1]!).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleFusionner(d.cle_identite)}
                        disabled={pending}
                      >
                        <Merge className="mr-1 size-3" /> Fusionner
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
