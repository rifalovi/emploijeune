import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConsentementBadge } from '@/components/beneficiaires/consentement-badge';
import { BadgeProjet } from '@/components/shared/badge-projet';
import { StatutStructureBadge } from './statut-structure-badge';
import { formaterMontant } from '@/lib/utils/formater-montant';
import type { StructureDetail as StructureDetailType } from '@/lib/structures/queries';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import type {
  ProgrammeStrategiqueCode,
  Sexe,
  TypeStructureCode,
  SecteurActiviteCode,
  NatureAppuiCode,
  StatutStructure,
  DeviseCode,
} from '@/lib/schemas/nomenclatures';
import {
  SEXE_LIBELLES,
  TYPE_STRUCTURE_LIBELLES,
  SECTEUR_ACTIVITE_LIBELLES,
  NATURE_APPUI_LIBELLES,
  DEVISE_LIBELLES,
} from '@/lib/schemas/nomenclatures';

/**
 * Vue détail d'une fiche structure (B1) en lecture.
 *
 * 5 Cards miroir des sections du formulaire (4c) :
 *   1. Identité (nom, type, secteur, statut, intitulé initiative)
 *   2. Rattachement (projet badge PS, pays, organisation, année appui)
 *   3. Initiative & appui (nature, montant formaté, devise)
 *   4. Contacts (consentement, téléphone, courriel)
 *   5. Détails complémentaires (porteur, géoloc, indicateurs B) — visible
 *      uniquement si au moins un champ optionnel est renseigné.
 */

export type StructureDetailProps = {
  structure: StructureDetailType;
  nomenclatures: Nomenclatures;
};

export function StructureDetail({ structure, nomenclatures }: StructureDetailProps) {
  const ps = structure.programme_strategique as ProgrammeStrategiqueCode | null | undefined;
  const typeLibelle =
    nomenclatures.typesStructure.get(structure.type_structure_code) ??
    TYPE_STRUCTURE_LIBELLES[structure.type_structure_code as TypeStructureCode] ??
    structure.type_structure_code;
  const secteurLibelle =
    nomenclatures.secteursActivite.get(structure.secteur_activite_code) ??
    SECTEUR_ACTIVITE_LIBELLES[structure.secteur_activite_code as SecteurActiviteCode] ??
    structure.secteur_activite_code;
  const natureLibelle =
    nomenclatures.naturesAppui.get(structure.nature_appui_code) ??
    NATURE_APPUI_LIBELLES[structure.nature_appui_code as NatureAppuiCode] ??
    structure.nature_appui_code;
  const paysLibelle = nomenclatures.pays.get(structure.pays_code) ?? structure.pays_code;
  const deviseLibelle = structure.devise_code
    ? (nomenclatures.devises.get(structure.devise_code) ??
      DEVISE_LIBELLES[structure.devise_code as DeviseCode] ??
      structure.devise_code)
    : null;
  const montantFormate = formaterMontant(
    structure.montant_appui,
    structure.devise_code as DeviseCode | null,
  );

  // La carte "Détails complémentaires" n'est affichée que si au moins un
  // champ optionnel est renseigné — évite l'encombrement visuel pour les
  // fiches saisies en mode rapide (sections essentielles uniquement).
  const hasDetailsComplementaires = Boolean(
    structure.porteur_prenom ||
    structure.porteur_date_naissance ||
    structure.fonction_porteur ||
    structure.adresse ||
    structure.ville ||
    structure.localite ||
    structure.latitude !== null ||
    structure.longitude !== null ||
    structure.chiffre_affaires !== null ||
    structure.employes_permanents !== null ||
    structure.employes_temporaires !== null ||
    structure.emplois_crees !== null ||
    structure.secteur_precis ||
    structure.date_creation,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Section 1 : Identité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Identité structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Champ label="Nom" valeur={structure.nom_structure} bold />
            <Champ label="Type" valeur={typeLibelle} />
            <Champ label="Secteur" valeur={secteurLibelle} />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-32 shrink-0">Statut</span>
              <StatutStructureBadge code={structure.statut_creation as StatutStructure} />
            </div>
            <Champ label="Initiative" valeur={structure.intitule_initiative ?? '—'} />
          </CardContent>
        </Card>

        {/* Section 2 : Rattachement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Rattachement projet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-32 shrink-0">Projet</span>
              <BadgeProjet
                code={structure.projet_code}
                libelle={structure.projet_libelle}
                programmeStrategique={ps ?? null}
                variant="full"
              />
            </div>
            <Champ label="Pays" valeur={`${paysLibelle} (${structure.pays_code})`} />
            <Champ label="Organisation" valeur={structure.organisation_nom ?? '—'} />
            <Champ label="Année d’appui" valeur={String(structure.annee_appui)} />
            <Champ
              label="Responsable"
              valeur={`${structure.porteur_prenom ? structure.porteur_prenom + ' ' : ''}${structure.porteur_nom} (${SEXE_LIBELLES[structure.porteur_sexe as Sexe]})`}
            />
          </CardContent>
        </Card>

        {/* Section 3 : Initiative & appui */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Initiative et appui</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Champ label="Nature appui" valeur={natureLibelle} />
            <Champ
              label="Montant"
              valeur={montantFormate || '—'}
              monospace={Boolean(montantFormate)}
            />
            <Champ label="Devise" valeur={deviseLibelle ?? '—'} />
          </CardContent>
        </Card>

        {/* Section 4 : Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-32 shrink-0">Consentement</span>
              <ConsentementBadge recueilli={structure.consentement_recueilli} size="sm" />
            </div>
            {structure.consentement_recueilli && (
              <Champ label="Recueilli le" valeur={formatDateFR(structure.consentement_date)} />
            )}
            <Champ label="Téléphone" valeur={structure.telephone_porteur ?? '—'} monospace />
            <Champ label="Courriel" valeur={structure.courriel_porteur ?? '—'} />
          </CardContent>
        </Card>
      </div>

      {/* Section 5 : Détails complémentaires (porteur / géoloc / indicateurs B) */}
      {hasDetailsComplementaires && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">5. Détails complémentaires</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {(structure.porteur_prenom ||
              structure.porteur_date_naissance ||
              structure.fonction_porteur) && (
              <div className="space-y-2 sm:col-span-2">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Porteur
                </p>
                {structure.porteur_prenom && (
                  <Champ label="Prénom" valeur={structure.porteur_prenom} />
                )}
                <Champ
                  label="Date naissance"
                  valeur={formatDateFR(structure.porteur_date_naissance)}
                />
                {structure.fonction_porteur && (
                  <Champ label="Fonction" valeur={structure.fonction_porteur} />
                )}
              </div>
            )}

            {(structure.adresse ||
              structure.ville ||
              structure.localite ||
              structure.latitude !== null ||
              structure.longitude !== null) && (
              <div className="space-y-2 sm:col-span-2">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Géolocalisation
                </p>
                {structure.adresse && <Champ label="Adresse" valeur={structure.adresse} />}
                {structure.ville && <Champ label="Ville" valeur={structure.ville} />}
                {structure.localite && <Champ label="Localité" valeur={structure.localite} />}
                {(structure.latitude !== null || structure.longitude !== null) && (
                  <Champ
                    label="Coordonnées GPS"
                    valeur={`${structure.latitude ?? '—'}, ${structure.longitude ?? '—'}`}
                    monospace
                  />
                )}
              </div>
            )}

            {(structure.chiffre_affaires !== null ||
              structure.employes_permanents !== null ||
              structure.employes_temporaires !== null ||
              structure.emplois_crees !== null ||
              structure.secteur_precis ||
              structure.date_creation) && (
              <div className="space-y-2 sm:col-span-2">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Activité économique (indicateurs B)
                </p>
                {structure.date_creation && (
                  <Champ label="Date création" valeur={formatDateFR(structure.date_creation)} />
                )}
                {structure.secteur_precis && (
                  <Champ label="Secteur précis" valeur={structure.secteur_precis} />
                )}
                {structure.chiffre_affaires !== null && (
                  <Champ
                    label="Chiffre d’affaires"
                    valeur={
                      formaterMontant(
                        structure.chiffre_affaires,
                        structure.devise_code as DeviseCode | null,
                      ) || String(structure.chiffre_affaires)
                    }
                    monospace
                  />
                )}
                {structure.employes_permanents !== null && (
                  <Champ
                    label="Employés permanents"
                    valeur={String(structure.employes_permanents)}
                    monospace
                  />
                )}
                {structure.employes_temporaires !== null && (
                  <Champ
                    label="Employés temporaires"
                    valeur={String(structure.employes_temporaires)}
                    monospace
                  />
                )}
                {structure.emplois_crees !== null && (
                  <Champ label="Emplois créés" valeur={String(structure.emplois_crees)} monospace />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {structure.commentaire && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{structure.commentaire}</CardContent>
        </Card>
      )}

      {/* Métadonnées techniques */}
      <div className="text-muted-foreground grid grid-cols-1 gap-x-4 gap-y-1 pt-2 text-xs sm:grid-cols-2">
        <p>
          <span className="font-medium">Créé le :</span> {formatDateTimeFR(structure.created_at)}
        </p>
        <p>
          <span className="font-medium">Dernière modification :</span>{' '}
          {formatDateTimeFR(structure.updated_at)}
        </p>
        <p>
          <span className="font-medium">Source :</span> {structure.source_import}
        </p>
      </div>
    </div>
  );
}

function Champ({
  label,
  valeur,
  monospace,
  bold,
}: {
  label: string;
  valeur: string;
  monospace?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className={`${monospace ? 'font-mono' : ''} ${bold ? 'font-semibold' : ''}`}>
        {valeur}
      </span>
    </div>
  );
}

function formatDateFR(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'd MMMM yyyy', { locale: fr });
  } catch {
    return iso;
  }
}

function formatDateTimeFR(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), "d MMM yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return iso;
  }
}
