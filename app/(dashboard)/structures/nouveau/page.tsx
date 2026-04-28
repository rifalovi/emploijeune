import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { repriseCohorteStructureSchema } from '@/lib/schemas/structure';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { StructureForm } from '@/components/structures/structure-form';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Nouvelle structure — OIF Emploi Jeunes',
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NouvelleStructurePage({ searchParams }: PageProps) {
  const utilisateur = await requireUtilisateurValide();

  // Seuls les rôles écriture peuvent créer
  const peutCreer =
    utilisateur.role === 'admin_scs' ||
    utilisateur.role === 'super_admin' ||
    utilisateur.role === 'editeur_projet' ||
    utilisateur.role === 'contributeur_partenaire';
  if (!peutCreer) notFound();

  const params = await searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') raw[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') raw[k] = v[0];
  }

  // Pré-remplissage saisie à la chaîne (Q1=B)
  const repriseParse = repriseCohorteStructureSchema.safeParse(raw);
  const reprise = repriseParse.success ? repriseParse.data : {};

  // Nomenclatures pour les dropdowns (cache React.cache, étendu en 5b)
  const nomenclatures = await getNomenclatures();

  // Listes filtrées : un contributeur ne voit en filtre que les projets PS3
  const projetsOptions = Array.from(nomenclatures.projets.entries())
    .filter(
      ([, meta]) =>
        utilisateur.role === 'admin_scs' ||
        utilisateur.role === 'super_admin' ||
        meta.programme_strategique === 'PS3',
    )
    .map(([code, meta]) => ({ code, libelle: `${code} — ${meta.libelle}` }));

  const paysOptions = Array.from(nomenclatures.pays.entries()).map(([code, libelle]) => ({
    code,
    libelle: `${code} — ${libelle}`,
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/structures"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Retour à la liste
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Nouvelle structure</h1>
          <p className="text-muted-foreground text-sm">
            Indicateur B1 — saisie d&apos;une structure appuyée
          </p>
        </div>
        <Link
          href="/structures"
          className={cn(buttonVariants({ variant: 'outline' }), 'hidden sm:inline-flex')}
        >
          Annuler
        </Link>
      </header>

      <StructureForm
        mode="creation"
        nomenclatures={nomenclatures}
        projetsOptions={projetsOptions}
        paysOptions={paysOptions}
        cohorte={{
          projet: reprise.cohorte_projet,
          pays: reprise.cohorte_pays,
          secteur_activite: reprise.cohorte_secteur_activite,
          nature_appui: reprise.cohorte_nature_appui,
          devise: reprise.cohorte_devise,
          annee: reprise.cohorte_annee,
        }}
      />
    </div>
  );
}
