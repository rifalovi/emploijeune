import type { Metadata } from 'next';
import { Sparkles, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { listerActivationsParModule } from '@/lib/super-admin/queries';
import { ToggleModuleRow } from '@/components/super-admin/toggle-module-row';

export const metadata: Metadata = {
  title: 'Modules – Super Administration',
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
    libelle: 'Lecteurs (bailleurs, représentants d\u2019États et gouvernements OIF)',
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
  const [activationsAssistant, activationsImport] = await Promise.all([
    listerActivationsParModule('assistant_ia'),
    listerActivationsParModule('import_ia'),
  ]);
  const mapAssistant = new Map(activationsAssistant.map((a) => [a.role_cible, a]));
  const mapImport = new Map(activationsImport.map((a) => [a.role_cible, a]));

  return (
    <div className="space-y-6">
      {/* Card 1 — Assistant IA Analytique */}
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
                ne voient aucune trace du module – pas d&apos;item sidebar, pas de mention.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-slate-200">
            {ROLES_ORDRE.map((role) => {
              const entry = mapAssistant.get(role);
              const meta = ROLES_LIBELLES[role];
              const active = entry?.active ?? false;
              const isSuperAdminRole = role === 'super_admin';
              return (
                <li key={role} className="py-4">
                  <ToggleModuleRow
                    module="assistant_ia"
                    role={role}
                    libelle={meta?.libelle ?? role}
                    description={meta?.description ?? ''}
                    active={active}
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
                Quand vous activez un rôle, l&apos;item « Assistant IA » apparaît dans la sidebar de
                tous les utilisateurs ayant ce rôle.
              </li>
              <li>
                Quand vous désactivez, l&apos;item disparaît immédiatement et la route
                <code className="mx-1 rounded bg-white px-1.5 py-0.5">/assistant-ia</code> retourne
                404 – comme si la page n&apos;existait pas.
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

      {/* Card 2 — Import IA (extraction PDF/DOCX + suggestions mapping) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex size-10 items-center justify-center rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg, #0E4F88 0%, #F5A623 100%)' }}
            >
              <FileText className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Import IA</CardTitle>
              <CardDescription>
                Couche optionnelle au-dessus du moteur d&apos;import : suggestions de mapping pour
                les valeurs ambiguës (domaines de formation en texte libre) et — à venir —
                extraction depuis PDF/DOCX. Désactivable par rôle.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-slate-200">
            {ROLES_ORDRE.map((role) => {
              const entry = mapImport.get(role);
              const meta = ROLES_LIBELLES[role];
              const active = entry?.active ?? false;
              const isSuperAdminRole = role === 'super_admin';
              return (
                <li key={role} className="py-4">
                  <ToggleModuleRow
                    module="import_ia"
                    role={role}
                    libelle={meta?.libelle ?? role}
                    description={meta?.description ?? ''}
                    active={active}
                    disabled={isSuperAdminRole}
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-6 rounded-md border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900">
            <p className="font-semibold">Particularités du module Import IA</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Seules les <strong>métadonnées sans PII</strong> (codes, libellés de domaine,
                valeurs énumérées) sont envoyées à Claude — jamais les prénoms, noms, courriels ou
                téléphones.
              </li>
              <li>
                L&apos;IA propose des suggestions de mapping (ex. « Compétences techniques » →
                <code className="mx-1 rounded bg-white px-1.5 py-0.5">NUM_INFO</code>). Les
                résultats sont indicatifs et validés par l&apos;utilisateur avant insertion.
              </li>
              <li>
                Modèle utilisé : <strong>Claude Haiku 4.5</strong> (rapide, peu coûteux — la tâche
                est extraction/mapping, pas analyse).
              </li>
              <li>
                Quand vous désactivez pour un rôle, les utilisateurs concernés voient le rapport
                d&apos;import classique (sans suggestions IA).
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
