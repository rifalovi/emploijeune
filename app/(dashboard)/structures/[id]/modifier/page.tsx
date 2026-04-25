import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { getStructureById } from '@/lib/structures/queries';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { StructureForm } from '@/components/structures/structure-form';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const fiche = await getStructureById(id);
  if (!fiche) return { title: 'Modifier — OIF Emploi Jeunes' };
  return { title: `Modifier ${fiche.nom_structure} — OIF Emploi Jeunes` };
}

export default async function ModifierStructurePage({ params }: PageProps) {
  const utilisateur = await requireUtilisateurValide();
  const { id } = await params;

  const fiche = await getStructureById(id);
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/structures/${fiche.id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour à la fiche
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Modifier · {fiche.nom_structure}</h1>
        <p className="text-muted-foreground text-sm">
          Indicateur B1 — modification d&apos;une structure existante
        </p>
      </header>

      <StructureForm
        mode="edition"
        structureId={fiche.id}
        nomenclatures={nomenclatures}
        projetsOptions={projetsOptions}
        paysOptions={paysOptions}
        initialValues={{
          nom_structure: fiche.nom_structure,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type_structure_code: fiche.type_structure_code as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          secteur_activite_code: fiche.secteur_activite_code as any,
          secteur_precis: fiche.secteur_precis ?? '',
          intitule_initiative: fiche.intitule_initiative ?? '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          date_creation: (fiche.date_creation as any) ?? undefined,
          statut_creation: fiche.statut_creation,
          projet_code: fiche.projet_code,
          pays_code: fiche.pays_code,
          organisation_id: fiche.organisation_id ?? undefined,
          porteur_prenom: fiche.porteur_prenom ?? '',
          porteur_nom: fiche.porteur_nom,
          porteur_sexe: fiche.porteur_sexe,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          porteur_date_naissance: (fiche.porteur_date_naissance as any) ?? undefined,
          fonction_porteur: fiche.fonction_porteur ?? '',
          annee_appui: fiche.annee_appui,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nature_appui_code: fiche.nature_appui_code as any,
          montant_appui: fiche.montant_appui ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          devise_code: (fiche.devise_code as any) ?? undefined,
          consentement_recueilli: fiche.consentement_recueilli,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          consentement_date: (fiche.consentement_date as any) ?? undefined,
          telephone_porteur: fiche.telephone_porteur ?? '',
          courriel_porteur: fiche.courriel_porteur ?? '',
          adresse: fiche.adresse ?? '',
          ville: fiche.ville ?? '',
          localite: fiche.localite ?? '',
          latitude: fiche.latitude ?? undefined,
          longitude: fiche.longitude ?? undefined,
          chiffre_affaires: fiche.chiffre_affaires ?? undefined,
          employes_permanents: fiche.employes_permanents ?? undefined,
          employes_temporaires: fiche.employes_temporaires ?? undefined,
          emplois_crees: fiche.emplois_crees ?? undefined,
          commentaire: fiche.commentaire ?? '',
        }}
      />
    </div>
  );
}
