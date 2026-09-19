'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toggleAccesDataStudio } from '@/lib/super-admin/permissions-actions';

type Utilisateur = {
  id: string;
  nom_complet: string;
  email: string;
  role: string;
  actif: boolean;
  verrouille: boolean;
};

const ROLES_LIBELLES: Record<string, string> = {
  super_admin: 'Super administrateur',
  admin_scs: 'Administrateur SCS',
  editeur_projet: 'Coordonnateur de projet',
  contributeur_partenaire: 'Partenaire',
  lecteur: 'Lecteur',
};

export function DatastudioAccesClient({ utilisateurs }: { utilisateurs: Utilisateur[] }) {
  const [rows, setRows] = useState<Utilisateur[]>(utilisateurs);
  const [q, setQ] = useState('');
  const [, startTransition] = useTransition();

  const requete = q.trim().toLowerCase();
  const filtres = rows.filter((u) =>
    `${u.nom_complet} ${u.email} ${ROLES_LIBELLES[u.role] ?? u.role}`
      .toLowerCase()
      .includes(requete),
  );
  const nbActifs = rows.filter((u) => u.actif).length;

  function basculer(u: Utilisateur) {
    if (u.verrouille) return;
    const next = !u.actif;
    setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, actif: next } : r)));
    startTransition(async () => {
      const res = await toggleAccesDataStudio(u.id, next);
      if (!res.ok) {
        setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, actif: !next } : r)));
        toast.error(res.message);
      } else {
        toast.success(
          next ? `Accès accordé à ${u.nom_complet}` : `Accès retiré à ${u.nom_complet}`,
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Utilisateurs</CardTitle>
        <Badge variant="secondary">{nbActifs} avec accès</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (nom, e-mail, rôle)…"
            className="pl-9"
          />
        </div>
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="text-right">Accès DataStudio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtres.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.nom_complet}</div>
                    <div className="text-muted-foreground text-xs">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLES_LIBELLES[u.role] ?? u.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.verrouille && (
                        <span className="text-muted-foreground text-xs">permanent</span>
                      )}
                      <Switch
                        checked={u.actif}
                        disabled={u.verrouille}
                        onCheckedChange={() => basculer(u)}
                        aria-label={`Accès SCS DataStudio pour ${u.nom_complet}`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtres.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground text-center text-sm italic"
                  >
                    Aucun utilisateur ne correspond à la recherche.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
