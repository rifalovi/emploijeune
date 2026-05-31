import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Activity, ExternalLink } from 'lucide-react';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Qualité des données — OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────────────────

type IndicateurQualite = {
  champ: string;
  libelle: string;
  total: number;
  complets: number;
  alertes_ouvertes: number;
};

type ProjetDefaillant = {
  projet_code: string;
  total: number;
  tranche_ok: number;
  pays_ok: number;
  pct_complete: number;
  alertes_ouvertes: number;
};

// ── Liens par champ ──────────────────────────────────────────────────────────

const LIENS_CHAMP: Record<string, { href: string; label: string }> = {
  pays: {
    href: '/super-admin/nettoyage-donnees/pays-inconnus',
    label: 'Résoudre les pays inconnus',
  },
  tranche_age: {
    href: '/admin/alertes-qualite',
    label: 'Voir les alertes',
  },
};

// ── Couleur par % ────────────────────────────────────────────────────────────

function couleurPct(pct: number) {
  if (pct >= 95) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500' };
  if (pct >= 80) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', bar: 'bg-amber-500' };
  return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', bar: 'bg-red-500' };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function QualiteDonneesPage() {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    redirect('/dashboard');
  }

  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = supabase.rpc.bind(supabase) as any;
  const [{ data: indicateurs }, { data: projets }] = await Promise.all([
    rpc('get_indicateurs_qualite_donnees_v1'),
    rpc('get_projets_defaillants_v1'),
  ]);

  const indics = (indicateurs ?? []) as IndicateurQualite[];
  const projetsDefaillants = (projets ?? []) as ProjetDefaillant[];

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
          <Activity className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Qualité des données
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Complétude par champ critique sur{' '}
            <span className="font-semibold text-slate-700">
              {indics[0]?.total.toLocaleString('fr-FR') ?? 0}
            </span>{' '}
            bénéficiaires actifs. Cliquez sur une carte pour accéder aux corrections.
          </p>
        </div>
      </div>

      {/* ── Cartes KPI ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {indics.map((ind) => {
          const pct = ind.total > 0
            ? Math.round((1000 * ind.complets) / ind.total) / 10
            : 100;
          const manquants = ind.total - ind.complets;
          const c = couleurPct(pct);
          const lien = LIENS_CHAMP[ind.champ];

          return (
            <Card key={ind.champ} className={`${c.border} ${c.bg} relative overflow-hidden`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-800">
                  {ind.libelle}
                  {ind.alertes_ouvertes > 0 && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]">
                      {ind.alertes_ouvertes} alerte{ind.alertes_ouvertes > 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Pourcentage principal */}
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${c.text}`}>
                    {pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%
                  </span>
                  <span className="text-xs text-slate-500">
                    {ind.complets.toLocaleString('fr-FR')} / {ind.total.toLocaleString('fr-FR')}
                  </span>
                </div>

                {/* Barre de progression */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${c.bar}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                {/* Note contextuelle pour consentement RGPD */}
                {ind.champ === 'consentement' && manquants > 0 && manquants <= 30 && (
                  <p className="text-[10px] leading-snug text-slate-400 italic">
                    {manquants} manquant{manquants > 1 ? 's' : ''} — tous au statut INSCRIT
                    (en attente de finalisation du dossier).
                  </p>
                )}

                {/* Footer : manquants + lien */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {manquants > 0
                      ? `${manquants.toLocaleString('fr-FR')} manquant${manquants > 1 ? 's' : ''}`
                      : 'Complet'}
                  </span>
                  {lien && manquants > 0 && (
                    <Link
                      href={lien.href}
                      className={`inline-flex items-center gap-1 font-medium ${c.text} hover:underline`}
                    >
                      {lien.label}
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Top projets défaillants ──────────────────────────────────────── */}
      {projetsDefaillants.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Projets avec données incomplètes
          </h2>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Projet</th>
                  <th className="px-4 py-2 text-right">Bénéficiaires</th>
                  <th className="px-4 py-2 text-right">Tranche OK</th>
                  <th className="px-4 py-2 text-right">Pays OK</th>
                  <th className="px-4 py-2 text-right">Complétude</th>
                  <th className="px-4 py-2 text-right">Alertes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projetsDefaillants.map((p) => {
                  const c = couleurPct(p.pct_complete);
                  return (
                    <tr key={p.projet_code} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {p.projet_code}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {p.total.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {p.tranche_ok.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {p.pays_ok.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={`font-semibold ${c.text}`}>
                          {p.pct_complete}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {p.alertes_ouvertes > 0 ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            {p.alertes_ouvertes}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
