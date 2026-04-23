import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatutBadge } from './statut-badge';
import { ConsentementBadge } from './consentement-badge';
import { BadgeProjet } from './badge-projet';
import { calculerTrancheAge } from './tranche-age';
import type { BeneficiaireDetail as BeneficiaireDetailType } from '@/lib/beneficiaires/queries';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import type {
  ProgrammeStrategiqueCode,
  StatutBeneficiaireCode,
  Sexe,
  ModaliteFormationCode,
} from '@/lib/schemas/nomenclatures';
import { SEXE_LIBELLES, MODALITE_FORMATION_LIBELLES } from '@/lib/schemas/nomenclatures';

/**
 * Vue détail d'une fiche bénéficiaire en lecture.
 *
 * Structure : 5 Cards miroir des sections du formulaire, pour que
 * l'utilisateur passe de la lecture à l'édition sans désorientation.
 *   1. Identité
 *   2. Rattachement (projet + PS + pays + organisation + partenaire)
 *   3. Formation
 *   4. RGPD & contacts
 *   5. Notes
 *
 * Encart d'alerte en tête si `qualite_a_verifier = TRUE` (statut achevé
 * ou abandon sans date_fin).
 */

export type BeneficiaireDetailProps = {
  beneficiaire: BeneficiaireDetailType;
  nomenclatures: Nomenclatures;
};

export function BeneficiaireDetail({ beneficiaire, nomenclatures }: BeneficiaireDetailProps) {
  const ps = beneficiaire.programme_strategique as ProgrammeStrategiqueCode | null | undefined;
  const modaliteLibelle = beneficiaire.modalite_formation_code
    ? MODALITE_FORMATION_LIBELLES[beneficiaire.modalite_formation_code as ModaliteFormationCode]
    : null;
  const domaineLibelle =
    nomenclatures.domaines.get(beneficiaire.domaine_formation_code) ??
    beneficiaire.domaine_formation_code;
  const paysLibelle = nomenclatures.pays.get(beneficiaire.pays_code) ?? beneficiaire.pays_code;

  return (
    <div className="space-y-4">
      {beneficiaire.qualite_a_verifier && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Fiche à compléter</p>
            <p className="mt-0.5 text-sm">
              Le statut est « {beneficiaire.statut_code} » mais la date de fin de formation
              n&apos;est pas renseignée. Cliquez sur « Modifier » pour compléter.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Section 1 : Identité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Identité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Champ label="Prénom" valeur={beneficiaire.prenom} />
            <Champ label="Nom" valeur={beneficiaire.nom} />
            <Champ label="Sexe" valeur={SEXE_LIBELLES[beneficiaire.sexe as Sexe]} />
            <Champ label="Date de naissance" valeur={formatDateFR(beneficiaire.date_naissance)} />
            <Champ label="Tranche d’âge" valeur={calculerTrancheAge(beneficiaire.date_naissance)} />
          </CardContent>
        </Card>

        {/* Section 2 : Rattachement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Rattachement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-32 shrink-0">Projet</span>
              <BadgeProjet
                code={beneficiaire.projet_code}
                libelle={beneficiaire.projet_libelle}
                programmeStrategique={ps ?? null}
                variant="full"
              />
            </div>
            <Champ label="Pays" valeur={`${paysLibelle} (${beneficiaire.pays_code})`} />
            <Champ label="Organisation" valeur={beneficiaire.organisation_nom ?? '—'} />
            <Champ label="Partenaire" valeur={beneficiaire.partenaire_accompagnement ?? '—'} />
          </CardContent>
        </Card>

        {/* Section 3 : Formation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Formation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Champ label="Domaine" valeur={domaineLibelle} />
            <Champ label="Intitulé" valeur={beneficiaire.intitule_formation ?? '—'} />
            <Champ label="Modalité" valeur={modaliteLibelle ?? '—'} />
            <Champ label="Année" valeur={String(beneficiaire.annee_formation)} />
            <Champ
              label="Période"
              valeur={
                beneficiaire.date_debut_formation || beneficiaire.date_fin_formation
                  ? `${formatDateFR(beneficiaire.date_debut_formation)} → ${formatDateFR(beneficiaire.date_fin_formation)}`
                  : '—'
              }
            />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-32 shrink-0">Statut</span>
              <StatutBadge code={beneficiaire.statut_code as StatutBeneficiaireCode} />
            </div>
            <Champ label="Fonction actuelle" valeur={beneficiaire.fonction_actuelle ?? '—'} />
          </CardContent>
        </Card>

        {/* Section 4 : RGPD & contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. RGPD et contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-32 shrink-0">Consentement</span>
              <ConsentementBadge recueilli={beneficiaire.consentement_recueilli} size="sm" />
            </div>
            {beneficiaire.consentement_recueilli && (
              <Champ label="Recueilli le" valeur={formatDateFR(beneficiaire.consentement_date)} />
            )}
            <Champ label="Téléphone" valeur={beneficiaire.telephone ?? '—'} monospace />
            <Champ label="Courriel" valeur={beneficiaire.courriel ?? '—'} />
            <Champ label="Localité" valeur={beneficiaire.localite_residence ?? '—'} />
          </CardContent>
        </Card>
      </div>

      {beneficiaire.commentaire && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">5. Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {beneficiaire.commentaire}
          </CardContent>
        </Card>
      )}

      {/* Métadonnées techniques en bas */}
      <div className="text-muted-foreground grid grid-cols-1 gap-x-4 gap-y-1 pt-2 text-xs sm:grid-cols-2">
        <p>
          <span className="font-medium">Créé le :</span> {formatDateTimeFR(beneficiaire.created_at)}
        </p>
        <p>
          <span className="font-medium">Dernière modification :</span>{' '}
          {formatDateTimeFR(beneficiaire.updated_at)}
        </p>
        <p>
          <span className="font-medium">Source :</span> {beneficiaire.source_import}
        </p>
      </div>
    </div>
  );
}

function Champ({
  label,
  valeur,
  monospace,
}: {
  label: string;
  valeur: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className={monospace ? 'font-mono' : ''}>{valeur}</span>
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
