'use client';

import { useState, useTransition } from 'react';
import { togglePermission, saveContenuSectionPermissions } from '@/lib/super-admin/permissions-actions';
import type { AdminScsAvecPermissions, ModuleKey, MODULES_DELEGABLES } from '@/lib/super-admin/permissions';
import { toast } from 'sonner';
import { Users, ShieldCheck, ShieldOff, ChevronDown, ChevronRight } from 'lucide-react';

type Props = {
  admins: AdminScsAvecPermissions[];
  modules: typeof MODULES_DELEGABLES;
  cmsPagesSections: Record<string, string[]>;
};

export function PermissionsDeleguesClient({ admins, modules, cmsPagesSections }: Props) {
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
        <AdminCard
          key={admin.id}
          admin={admin}
          moduleKeys={moduleKeys}
          modules={modules}
          cmsPagesSections={cmsPagesSections}
        />
      ))}
    </div>
  );
}

// ── Carte par administrateur ──────────────────────────────────────────────────

function AdminCard({
  admin,
  moduleKeys,
  modules,
  cmsPagesSections,
}: {
  admin: AdminScsAvecPermissions;
  moduleKeys: ModuleKey[];
  modules: typeof MODULES_DELEGABLES;
  cmsPagesSections: Record<string, string[]>;
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
            ? `${modules[module].label} activé pour ${admin.nom_complet}`
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
          {admin.nom_complet[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {admin.nom_complet}
          </p>
          <p className="text-muted-foreground truncate text-xs">{admin.email}</p>
        </div>
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

      {/* Panneau de sections CMS — visible uniquement si contenu_pages est actif */}
      {perms['contenu_pages'] && (
        <div className="border-t bg-slate-50/60 px-4 py-3">
          <ContenuSectionsPanel
            adminId={admin.id}
            adminNom={admin.nom_complet}
            initialSections={admin.contenu_sections}
            cmsPagesSections={cmsPagesSections}
          />
        </div>
      )}
    </div>
  );
}

// ── Panneau de configuration des sections CMS ─────────────────────────────────

type SectionItem = { page_key: string; section_key: string };

function ContenuSectionsPanel({
  adminId,
  adminNom,
  initialSections,
  cmsPagesSections,
}: {
  adminId: string;
  adminNom: string;
  initialSections: SectionItem[];
  cmsPagesSections: Record<string, string[]>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Etat local : Set de "page_key::section_key" pour les accès cochés
  // Vide = accès complet (aucune restriction)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSections.map((s) => `${s.page_key}::${s.section_key}`))
  );

  const isFullAccess = selected.size === 0;
  const pageKeys = Object.keys(cmsPagesSections).sort();

  function isPageChecked(page: string): boolean {
    return selected.has(`${page}::`) ||
      (cmsPagesSections[page]?.every((s) => selected.has(`${page}::${s}`)) ?? false);
  }

  function isSectionChecked(page: string, section: string): boolean {
    return selected.has(`${page}::`) || selected.has(`${page}::${section}`);
  }

  function toggleFullAccess() {
    setSelected(new Set()); // vide = accès complet
  }

  function togglePage(page: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      // Retire la clé page globale et toutes les sections de cette page
      next.delete(`${page}::`);
      for (const s of cmsPagesSections[page] ?? []) next.delete(`${page}::${s}`);
      if (checked) {
        // Ajoute accès total à la page (section_key vide)
        next.add(`${page}::`);
      }
      return next;
    });
  }

  function toggleSection(page: string, section: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      // Si la page avait accès total, l'éclater en sections individuelles sauf celle-ci
      if (next.has(`${page}::`)) {
        next.delete(`${page}::`);
        for (const s of cmsPagesSections[page] ?? []) {
          if (s !== section) next.add(`${page}::${s}`);
        }
      } else {
        if (checked) next.add(`${page}::${section}`);
        else next.delete(`${page}::${section}`);
      }
      return next;
    });
  }

  function handleSave() {
    const items: SectionItem[] = [...selected].map((key) => {
      const idx = key.indexOf('::');
      return { page_key: key.slice(0, idx), section_key: key.slice(idx + 2) };
    });
    startTransition(async () => {
      const res = await saveContenuSectionPermissions(adminId, items);
      if (res.ok) {
        toast.success(`Sections CMS mises à jour pour ${adminNom}`, { duration: 2000 });
      } else {
        toast.error(res.message);
      }
    });
  }

  // Compte les pages accessibles pour l'affichage du résumé
  const pagesAccessibles = isFullAccess
    ? pageKeys.length
    : pageKeys.filter((p) => isPageChecked(p)).length;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-xs font-medium text-slate-600 hover:text-slate-900"
      >
        {expanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
        <span>Sections CMS accessibles</span>
        <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
          {isFullAccess ? 'Accès complet' : `${pagesAccessibles}/${pageKeys.length} page${pageKeys.length > 1 ? 's' : ''}`}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Option accès complet */}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isFullAccess}
              onChange={toggleFullAccess}
              className="size-4 rounded border-slate-300 accent-blue-600"
            />
            <span className="font-medium text-slate-700">Accès complet à toutes les pages et sections</span>
          </label>

          {/* Arborescence pages → sections */}
          {!isFullAccess && (
            <div className="space-y-2 rounded-md border bg-white p-3">
              {pageKeys.map((page) => {
                const sections = cmsPagesSections[page] ?? [];
                const pageChecked = isPageChecked(page);
                return (
                  <div key={page}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={pageChecked}
                        onChange={(e) => togglePage(page, e.target.checked)}
                        className="size-4 rounded border-slate-300 accent-blue-600"
                      />
                      {page}
                    </label>
                    {/* Sections de la page */}
                    {sections.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1">
                        {sections.map((section) => (
                          <label key={section} className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={isSectionChecked(page, section)}
                              onChange={(e) => toggleSection(page, section, e.target.checked)}
                              className="size-3.5 rounded border-slate-300 accent-blue-600"
                            />
                            {section || '(racine)'}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Enregistrement…' : 'Enregistrer les sections'}
          </button>
        </div>
      )}
    </div>
  );
}
