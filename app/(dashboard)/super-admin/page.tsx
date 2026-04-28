import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  Users,
  Building2,
  Package,
  Sparkles,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getStatsGlobales, listerActivationsIa } from '@/lib/super-admin/queries';

export const metadata: Metadata = {
  title: 'Super Administration — OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

export default async function SuperAdminHomePage() {
  const [stats, activations] = await Promise.all([getStatsGlobales(), listerActivationsIa()]);
  const iaActiveCount = activations.filter((a) => a.active).length;

  return (
    <div className="space-y-6">
      {/* Stats globales en bandeau */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Utilisateurs"
          valeur={stats.utilisateurs_total}
          sous={`${stats.utilisateurs_actifs} actifs`}
        />
        <StatCard label="Bénéficiaires" valeur={stats.beneficiaires_total} />
        <StatCard label="Structures" valeur={stats.structures_total} />
        <StatCard
          label="Organisations"
          valeur={stats.organisations_total}
          sous={
            stats.organisations_archivees > 0
              ? `${stats.organisations_archivees} archivée(s)`
              : undefined
          }
        />
      </section>

      {/* Cartes raccourcis */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionCard
          href="/super-admin/tracking"
          icon={Activity}
          titre="Tracking & Logs"
          description="Activité globale, journal d'audit, dernières connexions, recherches."
          tag={`${stats.suspensions_actives} suspension(s) active(s)`}
          tagColor="#5D0073"
        />
        <SectionCard
          href="/super-admin/modules"
          icon={Package}
          titre="Modules"
          description="Activer ou désactiver les modules optionnels (Assistant IA) par rôle cible."
          tag={`Assistant IA : ${iaActiveCount} rôle(s) actif(s)`}
          tagColor={iaActiveCount > 0 ? '#7EB301' : '#94a3b8'}
        />
        <SectionCard
          href="/super-admin/utilisateurs"
          icon={Users}
          titre="Utilisateurs avancé"
          description="Suspension temporaire ou bannissement définitif, changement de rôle, historique."
          tag={`${stats.utilisateurs_actifs}/${stats.utilisateurs_total} actifs`}
          tagColor="#0E4F88"
        />
        <SectionCard
          href="/super-admin/partenaires"
          icon={Building2}
          titre="Partenaires"
          description="Archivage des organisations partenaires et désactivation en cascade des utilisateurs liés."
          tag={`${stats.organisations_archivees} archivée(s)`}
          tagColor="#F5A623"
        />
      </div>

      {/* Bannière IA (toujours visible super_admin) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex size-8 items-center justify-center rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
            >
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base">Assistant IA Analytique</CardTitle>
              <CardDescription>
                Module premium réservé aux rôles autorisés par le super_admin.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Quand le module est activé pour un rôle, ses utilisateurs voient apparaître l'item «
            Assistant IA » dans la sidebar et peuvent accéder à{' '}
            <code className="bg-muted rounded px-1 text-xs">/assistant-ia</code>. Désactivé, aucune
            trace n'apparaît nulle part — les autres utilisateurs ne savent même pas que ce module
            existe.
          </p>
          <div className="flex flex-wrap gap-2">
            {activations
              .sort((a, b) => a.role_cible.localeCompare(b.role_cible))
              .map((a) => (
                <Badge
                  key={a.role_cible}
                  variant="outline"
                  className="font-mono text-[11px]"
                  style={
                    a.active
                      ? { background: '#7eb30119', borderColor: '#7eb30166', color: '#5b8200' }
                      : { background: '#94a3b819', borderColor: '#94a3b866', color: '#475569' }
                  }
                >
                  {a.active ? '●' : '○'} {a.role_cible}
                </Badge>
              ))}
          </div>
          <Link
            href="/super-admin/modules"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#0E4F88] hover:underline"
          >
            Configurer les rôles autorisés
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#0E4F88]" aria-hidden />
            <CardTitle className="text-base">Rappel : portée du rôle super_admin</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Le super_admin hérite automatiquement de tous les privilèges admin_scs (gestion des
            utilisateurs, des bénéficiaires, des structures, des campagnes, etc.) et dispose en plus
            des fonctions exclusives ci-dessus. Vos actions sont systématiquement journalisées dans
            la table <code className="bg-muted rounded px-1 text-xs">journaux_audit</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, valeur, sous }: { label: string; valeur: number; sous?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
          {valeur.toLocaleString('fr-FR')}
        </p>
        {sous && <p className="text-muted-foreground mt-0.5 text-xs">{sous}</p>}
      </CardContent>
    </Card>
  );
}

function SectionCard({
  href,
  icon: Icon,
  titre,
  description,
  tag,
  tagColor,
}: {
  href: string;
  icon: typeof Activity;
  titre: string;
  description: string;
  tag: string;
  tagColor: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span
              className="inline-flex size-10 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: tagColor }}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">{titre}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p>
              <Badge
                variant="outline"
                className="mt-3 text-[11px]"
                style={{ borderColor: `${tagColor}66`, color: tagColor }}
              >
                {tag}
              </Badge>
            </div>
            <ArrowRight
              className="text-muted-foreground size-4 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
