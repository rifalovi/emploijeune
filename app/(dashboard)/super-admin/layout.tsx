import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert,
  Activity,
  Users,
  Building2,
  Package,
  BookOpen,
  Sparkles,
  LayoutGrid,
  MapPinOff,
  Wrench,
  Layers,
  History,
  Copy,
  FileText,
  KeyRound,
} from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { getPermissionsUtilisateur, type ModuleKey } from '@/lib/super-admin/permissions';

/**
 * Layout du segment /super-admin/* — V3.1.0.
 *
 * Accès :
 *   - super_admin : accès complet à tous les items
 *   - admin_scs   : accès limité aux modules explicitement délégués
 *   - autres rôles: 404
 *
 * Navigation en grille de cartes, regroupée par catégorie (un accent couleur
 * par catégorie) pour une lecture claire.
 */
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const utilisateur = await requireUtilisateurValide();

  const isSuperAdmin = utilisateur.role === 'super_admin';
  const isAdminScs = utilisateur.role === 'admin_scs';

  if (!isSuperAdmin && !isAdminScs) notFound();

  // Pour admin_scs : récupère ses permissions et bloque si aucune
  let permissionsAdminScs = new Set<ModuleKey>();
  if (isAdminScs) {
    permissionsAdminScs = await getPermissionsUtilisateur(utilisateur.id);
    if (permissionsAdminScs.size === 0) notFound();
  }

  // Onglets regroupés par catégorie. Un item sans `module` est réservé au
  // super_admin (jamais délégable) ; un item avec `module` est délégable à un
  // admin_scs disposant de la permission correspondante.
  type ItemNav = { href: string; label: string; icon: React.ElementType; module?: ModuleKey };
  type Categorie = { titre: string; accent: string; items: ItemNav[] };
  const categories: Categorie[] = [
    {
      titre: 'Pilotage',
      accent: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
      items: [
        { href: '/super-admin', label: 'Vue d’ensemble', icon: ShieldAlert },
        {
          href: '/super-admin/tracking',
          label: 'Tracking & Logs',
          icon: Activity,
          module: 'tracking',
        },
        {
          href: '/super-admin/analyses-indicateurs',
          label: 'Analyses IA',
          icon: Sparkles,
          module: 'analyses_indicateurs',
        },
      ],
    },
    {
      titre: 'Utilisateurs & accès',
      accent: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100',
      items: [
        { href: '/super-admin/utilisateurs', label: 'Utilisateurs', icon: Users },
        { href: '/super-admin/partenaires', label: 'Partenaires', icon: Building2 },
        {
          href: '/super-admin/permissions-delegues',
          label: 'Permissions déléguées',
          icon: KeyRound,
        },
        { href: '/super-admin/modules', label: 'Modules', icon: Package },
      ],
    },
    {
      titre: 'Données & qualité',
      accent: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
      items: [
        {
          href: '/super-admin/import-sessions',
          label: "Sessions d'import",
          icon: History,
          module: 'import_sessions',
        },
        { href: '/super-admin/doublons', label: 'Doublons', icon: Copy, module: 'doublons' },
        {
          href: '/super-admin/nettoyage-donnees/pays-inconnus',
          label: 'Pays inconnus',
          icon: MapPinOff,
          module: 'nettoyage_donnees',
        },
        {
          href: '/super-admin/referentiels/tranches-age',
          label: "Tranches d'âge",
          icon: Layers,
          module: 'referentiels',
        },
      ],
    },
    {
      titre: 'Contenu & affichage',
      accent: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
      items: [
        {
          href: '/super-admin/base-connaissance',
          label: 'Base de connaissance',
          icon: BookOpen,
          module: 'base_connaissance',
        },
        {
          href: '/super-admin/affichage-public',
          label: 'Affichage public',
          icon: LayoutGrid,
          module: 'affichage_public',
        },
        {
          href: '/super-admin/contenu-pages',
          label: 'Contenu pages',
          icon: FileText,
          module: 'contenu_pages',
        },
      ],
    },
    {
      titre: 'Système',
      accent: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
      items: [{ href: '/super-admin/maintenance', label: 'Maintenance', icon: Wrench }],
    },
  ];

  // Visibilité : super_admin voit tout ; admin_scs ne voit que les items
  // délégables (avec `module`) pour lesquels il a la permission.
  const estVisible = (item: ItemNav): boolean =>
    isSuperAdmin ? true : item.module !== undefined && permissionsAdminScs.has(item.module);

  const categoriesVisibles = categories
    .map((cat) => ({ ...cat, items: cat.items.filter(estVisible) }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3 border-b pb-5">
        <span
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
        >
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {isSuperAdmin ? 'Super Administration' : 'Administration avancée'}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            {isSuperAdmin
              ? 'Pilotage, gestion des accès, qualité des données, contenu et maintenance de la plateforme.'
              : 'Modules d’administration avancée accessibles sur délégation.'}
          </p>
        </div>
      </header>

      <nav aria-label="Sections super-admin" className="space-y-5 border-b pb-6">
        {categoriesVisibles.map((cat) => (
          <section key={cat.titre} className="space-y-2">
            <h2 className="text-muted-foreground/80 text-[11px] font-semibold tracking-[0.08em] uppercase">
              {cat.titre}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cat.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group bg-card hover:border-primary/30 flex items-center gap-3 rounded-xl border p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <span
                    className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${cat.accent}`}
                  >
                    <item.icon aria-hidden className="size-[18px]" />
                  </span>
                  <span className="text-foreground text-sm font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </nav>

      {children}
    </div>
  );
}
