import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { listerAlertesQualite } from '@/lib/alertes-qualite/queries';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PanneauCorrectionsBlocs } from '@/components/alertes-qualite/panneau-corrections-blocs';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Alertes qualité — OIF Emploi Jeunes',
};

type SearchParams = Promise<{ type?: string; projet?: string; page?: string }>;

const TYPE_FILTRES = [
  { value: '', label: 'Tous les types' },
  { value: 'consentement_sans_date', label: 'Consentement sans date' },
  { value: 'date_naissance_manquante', label: 'Date de naissance manquante' },
  { value: 'statut_acheve_sans_date_fin', label: 'Statut achevé sans date de fin' },
  { value: 'subvention_sans_montant', label: 'Subvention sans montant' },
] as const;

const TYPE_BADGES: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  consentement_sans_date: 'destructive',
  date_naissance_manquante: 'secondary',
  statut_acheve_sans_date_fin: 'secondary',
  subvention_sans_montant: 'destructive',
};

export default async function AlertesQualitePage({ searchParams }: { searchParams: SearchParams }) {
  const utilisateur = await requireUtilisateurValide();
  if (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin') notFound();

  const params = await searchParams;
  const type = TYPE_FILTRES.find((t) => t.value === params.type)?.value ?? '';
  const projet = params.projet?.trim() ?? '';
  const pageNum = Math.max(1, Number(params.page) || 1);
  const TAILLE = 50;

  const { rows, total, compteurs } = await listerAlertesQualite({
    type: type || undefined,
    projet: projet || undefined,
    limit: TAILLE,
    offset: (pageNum - 1) * TAILLE,
  });

  const totalPages = Math.max(1, Math.ceil(total / TAILLE));

  // Module IA actif pour le rôle ? Détermine si on affiche le panneau d'analyse IA.
  const supabaseRpc = await createSupabaseServerClient();
  const { data: iaActif } = await supabaseRpc.rpc('module_ia_actif_pour_courant');
  const afficherPanneauIa = iaActif === true;

  const contenuPrincipal = (
    <>
      <div>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour au tableau de bord
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Alertes qualité</h1>
        <p className="text-muted-foreground text-sm">
          Incohérences détectées dans les données saisies — à corriger au fil de l&apos;eau.
        </p>
      </header>

      {/* Compteurs — 4 types depuis v2.2.1 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CompteurCard
          libelle="Consentement RGPD sans date"
          valeur={compteurs.consentement_sans_date ?? 0}
          actif={type === 'consentement_sans_date'}
          href={`/admin/alertes-qualite?type=consentement_sans_date${projet ? `&projet=${projet}` : ''}`}
          danger
        />
        <CompteurCard
          libelle="Date de naissance manquante"
          valeur={compteurs.date_naissance_manquante ?? 0}
          actif={type === 'date_naissance_manquante'}
          href={`/admin/alertes-qualite?type=date_naissance_manquante${projet ? `&projet=${projet}` : ''}`}
        />
        <CompteurCard
          libelle="Statut achevé sans date de fin"
          valeur={compteurs.statut_acheve_sans_date_fin ?? 0}
          actif={type === 'statut_acheve_sans_date_fin'}
          href={`/admin/alertes-qualite?type=statut_acheve_sans_date_fin${projet ? `&projet=${projet}` : ''}`}
        />
        <CompteurCard
          libelle="Subvention sans montant"
          valeur={compteurs.subvention_sans_montant ?? 0}
          actif={type === 'subvention_sans_montant'}
          href={`/admin/alertes-qualite?type=subvention_sans_montant${projet ? `&projet=${projet}` : ''}`}
          danger
        />
      </div>

      {/* Filtres + total */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Filtres :</span>
        {TYPE_FILTRES.map((f) => (
          <Link
            key={f.value || 'tous'}
            href={`/admin/alertes-qualite${f.value ? `?type=${f.value}` : ''}${projet ? `${f.value ? '&' : '?'}projet=${projet}` : ''}`}
            className={cn(
              buttonVariants({ variant: type === f.value ? 'default' : 'outline', size: 'sm' }),
              'h-8',
            )}
          >
            {f.label}
          </Link>
        ))}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {total.toLocaleString('fr-FR')} alerte(s) · page {pageNum}/{totalPages}
        </span>
      </div>

      {/* Tableau */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm italic">
            <AlertTriangle aria-hidden className="mx-auto mb-2 size-6 opacity-50" />
            Aucune alerte qualité dans ce filtre. La saisie est conforme.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type d&apos;alerte</TableHead>
                <TableHead>Entité concernée</TableHead>
                <TableHead>Projet</TableHead>
                <TableHead>Pays</TableHead>
                <TableHead>Saisie le</TableHead>
                <TableHead className="w-12" aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.type}-${r.entite_id}`}>
                  <TableCell>
                    <Badge variant={TYPE_BADGES[r.type]} className="text-xs">
                      {r.type_libelle}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.entite_nom}</TableCell>
                  <TableCell>
                    {r.projet_code ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {r.projet_code}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.pays_code ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs tabular-nums">
                    {format(new Date(r.cree_le), 'd MMM yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={r.entite_lien}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
                      aria-label="Ouvrir la fiche"
                    >
                      <ExternalLink aria-hidden className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          {pageNum > 1 && (
            <Link
              href={`/admin/alertes-qualite?${new URLSearchParams({
                ...(type ? { type } : {}),
                ...(projet ? { projet } : {}),
                page: String(pageNum - 1),
              })}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Précédent
            </Link>
          )}
          {pageNum < totalPages && (
            <Link
              href={`/admin/alertes-qualite?${new URLSearchParams({
                ...(type ? { type } : {}),
                ...(projet ? { projet } : {}),
                page: String(pageNum + 1),
              })}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Suivant
            </Link>
          )}
        </div>
      )}

      {/* Footer info — V1.5 export */}
      <p className="text-muted-foreground text-xs italic">
        Export Excel des alertes prévu en V1.5. Pour l&apos;instant, ouvrez chaque fiche pour
        compléter les champs manquants.
      </p>
    </>
  );

  return (
    <div
      className={cn(
        'gap-6',
        afficherPanneauIa ? 'grid grid-cols-1 lg:grid-cols-[1fr_360px]' : 'space-y-6',
      )}
    >
      <div className="space-y-6">{contenuPrincipal}</div>
      {afficherPanneauIa && (
        <aside>
          <PanneauCorrectionsBlocs typeAlerte={type} />
        </aside>
      )}
    </div>
  );
}

function CompteurCard({
  libelle,
  valeur,
  actif,
  href,
  danger = false,
}: {
  libelle: string;
  valeur: number;
  actif: boolean;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link href={href} className="block">
      <Card
        className={cn(
          'transition-colors',
          actif && 'border-primary',
          danger && valeur > 0 && 'border-amber-500/50',
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{libelle}</CardTitle>
          <CardDescription className="text-xs">Cliquer pour filtrer</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'text-2xl font-semibold tabular-nums',
              danger && valeur > 0 && 'text-amber-700 dark:text-amber-400',
            )}
          >
            {valeur.toLocaleString('fr-FR')}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
