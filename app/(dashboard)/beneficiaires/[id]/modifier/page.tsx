import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { getBeneficiaireById } from '@/lib/beneficiaires/queries';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { BeneficiaireForm } from '@/components/beneficiaires/beneficiaire-form';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const fiche = await getBeneficiaireById(id);
  if (!fiche) return { title: 'Modifier — OIF Emploi Jeunes' };
  return { title: `Modifier ${fiche.prenom} ${fiche.nom} — OIF Emploi Jeunes` };
}

export default async function ModifierBeneficiairePage({ params }: PageProps) {
  const utilisateur = await requireUtilisateurValide();
  const { id } = await params;

  const fiche = await getBeneficiaireById(id);
  if (!fiche) notFound();

  // Fiches supprimées non modifiables
  if (fiche.deleted_at) notFound();

  // Droits : mêmes règles que la page détail
  const peutEditer =
    utilisateur.role === 'admin_scs' ||
    utilisateur.role === 'editeur_projet' ||
    (utilisateur.role === 'contributeur_partenaire' &&
      (fiche.created_by === utilisateur.user_id ||
        fiche.organisation_id === utilisateur.organisation_id));
  if (!peutEditer) notFound();

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
      <div>
        <Link
          href={`/beneficiaires/${fiche.id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour à la fiche
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier · {fiche.prenom} {fiche.nom}
        </h1>
        <p className="text-muted-foreground text-sm">
          Indicateur A1 — modification d&apos;une fiche existante
        </p>
      </header>

      <BeneficiaireForm
        mode="edition"
        beneficiaireId={fiche.id}
        nomenclatures={nomenclatures}
        projetsOptions={projetsOptions}
        paysOptions={paysOptions}
        domainesOptions={domainesOptions}
        initialValues={{
          prenom: fiche.prenom,
          nom: fiche.nom,
          sexe: fiche.sexe,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          date_naissance: (fiche.date_naissance as any) ?? undefined,
          projet_code: fiche.projet_code,
          pays_code: fiche.pays_code,
          organisation_id: fiche.organisation_id ?? undefined,
          partenaire_accompagnement: fiche.partenaire_accompagnement ?? '',
          domaine_formation_code: fiche.domaine_formation_code,
          intitule_formation: fiche.intitule_formation ?? '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          modalite_formation_code: (fiche.modalite_formation_code as any) ?? undefined,
          annee_formation: fiche.annee_formation,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          date_debut_formation: (fiche.date_debut_formation as any) ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          date_fin_formation: (fiche.date_fin_formation as any) ?? undefined,
          statut_code: fiche.statut_code,
          fonction_actuelle: fiche.fonction_actuelle ?? '',
          consentement_recueilli: fiche.consentement_recueilli,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          consentement_date: (fiche.consentement_date as any) ?? undefined,
          telephone: fiche.telephone ?? '',
          courriel: fiche.courriel ?? '',
          localite_residence: fiche.localite_residence ?? '',
          commentaire: fiche.commentaire ?? '',
        }}
      />
    </div>
  );
}
