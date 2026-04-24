import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { getBeneficiaireById } from '@/lib/beneficiaires/queries';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { BeneficiaireDetail } from '@/components/beneficiaires/beneficiaire-detail';
import { BeneficiaireDetailActions } from '@/components/beneficiaires/beneficiaire-detail-actions';
import { BadgeProjet } from '@/components/shared/badge-projet';
import { StatutBadge } from '@/components/beneficiaires/statut-badge';
import type { ProgrammeStrategiqueCode, StatutBeneficiaireCode } from '@/lib/schemas/nomenclatures';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const fiche = await getBeneficiaireById(id);
  if (!fiche) return { title: 'Bénéficiaire introuvable — OIF Emploi Jeunes' };
  return {
    title: `${fiche.prenom} ${fiche.nom} — OIF Emploi Jeunes`,
  };
}

export default async function BeneficiaireDetailPage({ params }: PageProps) {
  const utilisateur = await requireUtilisateurValide();
  const { id } = await params;

  const fiche = await getBeneficiaireById(id);
  if (!fiche) notFound();

  const nomenclatures = await getNomenclatures();

  // Droits UI (la RLS reste la vraie barrière)
  const peutEditer =
    utilisateur.role === 'admin_scs' ||
    utilisateur.role === 'editeur_projet' ||
    (utilisateur.role === 'contributeur_partenaire' &&
      (fiche.created_by === utilisateur.user_id ||
        fiche.organisation_id === utilisateur.organisation_id));
  const peutSupprimer = utilisateur.role === 'admin_scs';

  // Couleur bordure gauche selon PS (continuité visuelle avec la liste)
  const ps = fiche.programme_strategique as ProgrammeStrategiqueCode | null | undefined;
  const couleurBordure = ps ? PROGRAMMES_STRATEGIQUES[ps].principale : 'transparent';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/beneficiaires"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour à la liste
        </Link>
      </div>

      <header
        className="bg-background flex flex-col gap-3 rounded-lg border-l-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderLeftColor: couleurBordure }}
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {fiche.prenom} {fiche.nom}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeProjet
              code={fiche.projet_code}
              libelle={fiche.projet_libelle}
              programmeStrategique={ps ?? null}
              variant="inline"
            />
            <StatutBadge code={fiche.statut_code as StatutBeneficiaireCode} />
          </div>
        </div>
        {!fiche.deleted_at && (
          <BeneficiaireDetailActions
            beneficiaireId={fiche.id}
            beneficiaireNom={fiche.nom}
            beneficiairePrenom={fiche.prenom}
            projetCode={fiche.projet_code}
            peutEditer={peutEditer}
            peutSupprimer={peutSupprimer}
          />
        )}
      </header>

      {fiche.deleted_at && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm">
          <p className="font-medium">Cette fiche a été supprimée.</p>
          <p className="mt-1">
            Suppression le {new Date(fiche.deleted_at).toLocaleDateString('fr-FR')}
            {fiche.deleted_reason && <> · Raison : {fiche.deleted_reason}</>}
          </p>
        </div>
      )}

      <BeneficiaireDetail beneficiaire={fiche} nomenclatures={nomenclatures} />
    </div>
  );
}
