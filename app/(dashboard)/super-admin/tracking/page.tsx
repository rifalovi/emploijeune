import type { Metadata } from 'next';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listerEvenementsAudit } from '@/lib/super-admin/queries';

export const metadata: Metadata = {
  title: 'Tracking & Logs — Super Administration',
};

export const dynamic = 'force-dynamic';

const ACTIONS_COULEURS: Record<string, string> = {
  INSERT: '#7EB301',
  UPDATE: '#0198E9',
  DELETE: '#dc2626',
  SOFT_DELETE: '#F5A623',
  RESTORE: '#5D0073',
};

export default async function TrackingPage() {
  const events = await listerEvenementsAudit(200);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex size-10 items-center justify-center rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
            >
              <Activity className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Journal d'audit — 200 derniers évènements</CardTitle>
              <CardDescription>
                Lecture étendue de la table{' '}
                <code className="bg-muted rounded px-1 text-xs">journaux_audit</code>. Chaque ligne
                représente une action sur la plateforme avec son acteur et son horodatage.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm italic">
              Aucun évènement journalisé pour l'instant.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Horodatage</th>
                    <th className="px-3 py-2 text-left">Acteur</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Table</th>
                    <th className="px-3 py-2 text-left">Ligne</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const couleur = ACTIONS_COULEURS[e.action] ?? '#64748b';
                    return (
                      <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs text-slate-600 tabular-nums">
                          {new Date(e.horodatage).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">
                            {e.acteur_nom ?? <span className="text-slate-400 italic">—</span>}
                          </p>
                          {e.user_email && (
                            <p className="text-muted-foreground text-xs">{e.user_email}</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                            style={{ borderColor: `${couleur}66`, color: couleur }}
                          >
                            {e.action}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">
                          {e.table_affectee}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                          {e.ligne_id ? e.ligne_id.slice(0, 8) + '…' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
