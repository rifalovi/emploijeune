import type { Metadata } from 'next';
import { Building2, ArchiveRestore, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listerPartenairesAvecArchive } from '@/lib/super-admin/queries';
import { ActionsPartenaireRow } from '@/components/super-admin/actions-partenaire-row';

export const metadata: Metadata = {
  title: 'Partenaires — Super Administration',
};

export const dynamic = 'force-dynamic';

export default async function PartenairesPage() {
  const partenaires = await listerPartenairesAvecArchive();
  const archives = partenaires.filter((p) => p.archive);
  const actifs = partenaires.filter((p) => !p.archive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex size-10 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: '#F5A623' }}
            >
              <Building2 className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>
                Partenaires ({partenaires.length}) — {actifs.length} actifs · {archives.length}{' '}
                archivés
              </CardTitle>
              <CardDescription>
                Archiver une organisation désactive automatiquement tous les utilisateurs liés. Les
                données restent en base, accessibles en lecture seule par admin_scs et super_admin.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Nom</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Pays</th>
                  <th className="px-3 py-2 text-left">Utilisateurs</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partenaires.map((p) => (
                  <tr
                    key={p.organisation_id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{p.nom}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {p.type_organisation ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {p.pays_code ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700 tabular-nums">
                      {p.utilisateurs_count}
                    </td>
                    <td className="px-3 py-2">
                      {p.archive ? (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[11px]"
                          style={{
                            borderColor: '#F5A62366',
                            color: '#F5A623',
                            backgroundColor: '#F5A62310',
                          }}
                        >
                          <Archive className="size-3" aria-hidden />
                          Archivé
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[11px]"
                          style={{
                            borderColor: '#7eb30166',
                            color: '#5b8200',
                          }}
                        >
                          <ArchiveRestore className="size-3" aria-hidden />
                          Actif
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ActionsPartenaireRow
                        organisationId={p.organisation_id}
                        nomOrg={p.nom}
                        archive={p.archive}
                        utilisateursCount={p.utilisateurs_count}
                      />
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
