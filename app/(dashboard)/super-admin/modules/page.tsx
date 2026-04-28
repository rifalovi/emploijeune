import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { listerActivationsIa } from '@/lib/super-admin/queries';
import { ToggleModuleRow } from '@/components/super-admin/toggle-module-row';

export const metadata: Metadata = {
  title: 'Modules — Super Administration',
};

export const dynamic = 'force-dynamic';

const ROLES_LIBELLES: Record<string, { libelle: string; description: string }> = {
  super_admin: {
    libelle: 'Super administrateur (Carlos)',
    description: 'Vous-même. Le module reste toujours actif pour ce rôle.',
  },
  admin_scs: {
    libelle: 'Administrateurs SCS',
    description: 'Équipe SCS. Vue globale, gestion utilisateurs, lancement de campagnes.',
  },
  editeur_projet: {
    libelle: 'Coordonnateurs de projet',
    description: 'Pilotage de projets gérés. Suivi cohortes, indicateurs périmètre projet.',
  },
  contributeur_partenaire: {
    libelle: 'Partenaires de mise en œuvre',
    description: 'Saisie terrain, complétion des dossiers, exports périmètre partenaire.',
  },
  lecteur: {
    libelle: 'Lecteurs (bailleurs, États)',
    description: 'Lecture seule des indicateurs agrégés et anonymisés.',
  },
};

const ROLES_ORDRE = [
  'super_admin',
  'admin_scs',
  'editeur_projet',
  'contributeur_partenaire',
  'lecteur',
] as const;

export default async function ModulesPage() {
  const activations = await listerActivationsIa();
  const map = new Map(activations.map((a) => [a.role_cible, a]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex size-10 items-center justify-center rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
            >
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Assistant IA Analytique</CardTitle>
              <CardDescription>
                Activez le module IA pour les rôles autorisés. Les utilisateurs des rôles désactivés
                ne voient aucune trace du module — pas d'item sidebar, pas de mention.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-slate-200">
            {ROLES_ORDRE.map((role) => {
              const entry = map.get(role);
              const meta = ROLES_LIBELLES[role];
              const active = entry?.active ?? false;
              const isSuperAdminRole = role === 'super_admin';
              return (
                <li key={role} className="py-4">
                  <ToggleModuleRow
                    role={role}
                    libelle={meta?.libelle ?? role}
                    description={meta?.description ?? ''}
                    active={active}
                    /* On ne permet pas de désactiver pour soi-même */
                    disabled={isSuperAdminRole}
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Comment ça marche</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Quand vous activez un rôle, l'item « Assistant IA » apparaît dans la sidebar de tous
                les utilisateurs ayant ce rôle.
              </li>
              <li>
                Quand vous désactivez, l'item disparaît immédiatement et la route
                <code className="mx-1 rounded bg-white px-1.5 py-0.5">/assistant-ia</code> retourne
                404 — comme si la page n'existait pas.
              </li>
              <li>
                Les invites envoyées à Claude API sont anonymisées côté serveur AVANT envoi (noms,
                prénoms, emails remplacés par des tokens). Aucune donnée nominative ne quitte la
                plateforme.
              </li>
              <li>
                Toute activation/désactivation est journalisée dans{' '}
                <code className="rounded bg-white px-1.5 py-0.5">journaux_audit</code>.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
