import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { repriseCohorteSchema } from '@/lib/schemas/beneficiaire';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { BeneficiaireForm } from '@/components/beneficiaires/beneficiaire-form';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Nouveau bénéficiaire — OIF Emploi Jeunes',
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NouveauBeneficiairePage({ searchParams }: PageProps) {
  const utilisateur = await requireUtilisateurValide();

  // Seuls les rôles écriture peuvent créer
  const peutCreer =
    utilisateur.role === 'admin_scs' ||
    utilisateur.role === 'editeur_projet' ||
    utilisateur.role === 'contributeur_partenaire';
  if (!peutCreer) notFound();

  const params = await searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') raw[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') raw[k] = v[0];
  }

  // Pré-remplissage depuis l'URL (mode saisie à la chaîne — Q1=B)
  const repriseParse = repriseCohorteSchema.safeParse(raw);
  const reprise = repriseParse.success ? repriseParse.data : {};

  // Nomenclatures pour les dropdowns
  const nomenclatures = await getNomenclatures();

  const projetsOptions = Array.from(nomenclatures.projets.entries())
    .filter(([, meta]) => utilisateur.role === 'admin_scs' || meta.programme_strategique === 'PS3')
    .map(([code, meta]) => ({ code, libelle: `${code} — ${meta.libelle}` }));

  const paysOptions = Array.from(nomenclatures.pays.entries()).map(([code, libelle]) => ({
    code,
    libelle: `${code} — ${libelle}`,
  }));

  const domainesOptions = Array.from(nomenclatures.domaines.entries()).map(([code, libelle]) => ({
    code,
    libelle,
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/beneficiaires"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Retour à la liste
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Nouveau bénéficiaire</h1>
          <p className="text-muted-foreground text-sm">
            Indicateur A1 — saisie d&apos;une fiche bénéficiaire
          </p>
        </div>
        <Link
          href="/beneficiaires"
          className={cn(buttonVariants({ variant: 'outline' }), 'hidden sm:inline-flex')}
        >
          Annuler
        </Link>
      </header>

      <BeneficiaireForm
        mode="creation"
        nomenclatures={nomenclatures}
        projetsOptions={projetsOptions}
        paysOptions={paysOptions}
        domainesOptions={domainesOptions}
        cohorte={{
          projet: reprise.cohorte_projet,
          pays: reprise.cohorte_pays,
          domaine: reprise.cohorte_domaine,
          annee: reprise.cohorte_annee,
          modalite: reprise.cohorte_modalite,
          partenaire: reprise.cohorte_partenaire,
        }}
      />
    </div>
  );
}
