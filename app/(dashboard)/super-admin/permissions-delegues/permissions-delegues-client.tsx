'use client';

import { useState, useTransition } from 'react';
import { togglePermission } from '@/lib/super-admin/permissions-actions';
import type { AdminScsAvecPermissions, ModuleKey, MODULES_DELEGABLES } from '@/lib/super-admin/permissions';
import { toast } from 'sonner';
import { Users, ShieldCheck, ShieldOff } from 'lucide-react';

type Props = {
  admins: AdminScsAvecPermissions[];
  modules: typeof MODULES_DELEGABLES;
};

export function PermissionsDeleguesClient({ admins, modules }: Props) {
  const moduleKeys = Object.keys(modules) as ModuleKey[];

  if (admins.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Users className="mx-auto mb-3 size-8 text-slate-300" />
        <p className="text-muted-foreground text-sm">
          Aucun administrateur SCS trouvé dans la plateforme.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {admins.map((admin) => (
        <AdminCard key={admin.id} admin={admin} moduleKeys={moduleKeys} modules={modules} />
      ))}
    </div>
  );
}

// ── Carte par administrateur ──────────────────────────────────────────────────

function AdminCard({
  admin,
  moduleKeys,
  modules,
}: {
  admin: AdminScsAvecPermissions;
  moduleKeys: ModuleKey[];
  modules: typeof MODULES_DELEGABLES;
}) {
  const [perms, setPerms] = useState<Record<ModuleKey, boolean>>(admin.permissions);
  const [isPending, startTransition] = useTransition();

  const actifs = moduleKeys.filter((k) => perms[k]).length;

  function handleToggle(module: ModuleKey) {
    const nouvelleValeur = !perms[module];
    setPerms((prev) => ({ ...prev, [module]: nouvelleValeur }));
    startTransition(async () => {
      const res = await togglePermission(admin.id, module, nouvelleValeur);
      if (!res.ok) {
        toast.error(res.message);
        setPerms((prev) => ({ ...prev, [module]: !nouvelleValeur }));
      } else {
        toast.success(
          nouvelleValeur
            ? `${modules[module].label} activé pour ${admin.prenom} ${admin.nom}`
            : `${modules[module].label} désactivé`,
          { duration: 2000 }
        );
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* En-tête */}
      <div className="flex items-center gap-3 border-b bg-slate-50 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
          {admin.prenom[0]?.toUpperCase() ?? '?'}{admin.nom[0]?.toUpperCase() ?? ''}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {admin.prenom} {admin.nom}
          </p>
          <p className="text-muted-foreground truncate text-xs">{admin.email}</p>
        </div>
        {admin.organisation && (
          <span className="text-muted-foreground shrink-0 text-xs">{admin.organisation}</span>
        )}
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            actifs > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {actifs} module{actifs > 1 ? 's' : ''} actif{actifs > 1 ? 's' : ''}
        </span>
      </div>

      {/* Grille des modules */}
      <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
        {moduleKeys.map((key) => {
          const actif = perms[key];
          return (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              disabled={isPending}
              className={`flex items-center gap-3 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                  actif
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {actif
                  ? <ShieldCheck className="size-3.5" />
                  : <ShieldOff className="size-3.5" />}
              </span>
              <span className={`text-sm font-medium ${actif ? 'text-slate-800' : 'text-slate-400'}`}>
                {modules[key].label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
