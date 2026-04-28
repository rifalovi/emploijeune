import type { Metadata } from 'next';
import { Users, ShieldOff, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listerUtilisateursAvecSuspension } from '@/lib/super-admin/queries';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { ActionsUtilisateurRow } from '@/components/super-admin/actions-utilisateur-row';

export const metadata: Metadata = {
  title: 'Utilisateurs avancé — Super Administration',
};

export const dynamic = 'force-dynamic';

export default async function UtilisateursAvancePage() {
  const [utilisateurs, courant] = await Promise.all([
    listerUtilisateursAvecSuspension(),
    getCurrentUtilisateur({ allowViewAs: true }),
  ]);

  const monUserId = courant?.user_id ?? null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex size-10 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: '#0E4F88' }}
            >
              <Users className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Tous les utilisateurs ({utilisateurs.length})</CardTitle>
              <CardDescription>
                Vue super_admin : suspension temporaire / bannissement, changement de rôle. Vos
                propres action(s) sont désactivées sur votre propre compte.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Nom complet</th>
                  <th className="px-3 py-2 text-left">Rôle</th>
                  <th className="px-3 py-2 text-left">Organisation</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-left">Dernière connexion</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {utilisateurs.map((u) => {
                  const isCourant = u.user_id === monUserId;
                  return (
                    <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">
                          {u.nom_complet}
                          {isCourant && (
                            <span className="text-muted-foreground ml-2 text-xs italic">
                              (vous)
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {u.organisation_nom ?? <span className="text-slate-400 italic">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {u.suspendu ? (
                          <Badge
                            variant="outline"
                            className="gap-1 text-[11px]"
                            style={{
                              borderColor: '#dc262666',
                              color: '#dc2626',
                              backgroundColor: '#dc262610',
                            }}
                          >
                            <ShieldOff className="size-3" aria-hidden />
                            Suspendu
                          </Badge>
                        ) : u.actif ? (
                          <Badge
                            variant="outline"
                            className="gap-1 text-[11px]"
                            style={{
                              borderColor: '#7eb30166',
                              color: '#5b8200',
                              backgroundColor: '#7eb30110',
                            }}
                          >
                            <ShieldCheck className="size-3" aria-hidden />
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] text-slate-500">
                            Inactif
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 tabular-nums">
                        {u.derniere_connexion
                          ? new Date(u.derniere_connexion).toLocaleString('fr-FR')
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <ActionsUtilisateurRow
                          userId={u.user_id}
                          nomComplet={u.nom_complet}
                          suspendu={u.suspendu}
                          isCourant={isCourant}
                          role={u.role}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
