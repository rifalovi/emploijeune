'use client';

/**
 * Formulaire de collecte publique — Type A (bénéficiaire) ou Type B (structure).
 *
 * Fix v2.6.1 :
 *  - Select : Controller (react-hook-form) — corrige la validation des dropdowns.
 *  - Contact : champs actifs par défaut ; la case enregistre le consentement RGPD.
 *  - Pays : liste complète des 88 États et gouvernements membres de l'OIF + Autre.
 */

import { useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle2, Loader2, PlusCircle, Send } from 'lucide-react';
import { soumettreCollectePublique } from '@/lib/collecte-publique/actions';
import type { InfoLienPublic } from '@/lib/collecte-publique/actions';
import {
  PROJETS_CODES,
  SEXE_VALUES,
  DOMAINES_FORMATION_CODES,
  TYPES_STRUCTURE_CODES,
  SECTEURS_ACTIVITE_CODES,
  NATURES_APPUI_CODES,
} from '@/lib/schemas/nomenclatures';

// =============================================================================
// États et gouvernements membres de l'OIF — liste complète (~90 entrées, 2025)
// Source : https://www.francophonie.org/les-membres-de-loif-28
// Inclut : membres de plein droit, membres associés, observateurs, gouvernements
// =============================================================================
const PAYS_OIF: Array<{ code: string; label: string }> = [
  // Afrique de l'Ouest
  { code: 'BEN', label: 'Bénin' },
  { code: 'BFA', label: 'Burkina Faso' },
  { code: 'CPV', label: 'Cap-Vert' },
  { code: 'CIV', label: "Côte d'Ivoire" },
  { code: 'GMB', label: 'Gambie' },
  { code: 'GHA', label: 'Ghana' },
  { code: 'GIN', label: 'Guinée' },
  { code: 'GNB', label: 'Guinée-Bissau' },
  { code: 'MLI', label: 'Mali' },
  { code: 'MRT', label: 'Mauritanie' },
  { code: 'NER', label: 'Niger' },
  { code: 'SEN', label: 'Sénégal' },
  { code: 'SLE', label: 'Sierra Leone' },
  { code: 'TGO', label: 'Togo' },
  // Afrique centrale
  { code: 'CMR', label: 'Cameroun' },
  { code: 'CAF', label: 'Centrafrique' },
  { code: 'COM', label: 'Comores' },
  { code: 'COD', label: 'Congo (RDC)' },
  { code: 'COG', label: 'Congo (Rép.)' },
  { code: 'GAB', label: 'Gabon' },
  { code: 'GNQ', label: 'Guinée équatoriale' },
  { code: 'STP', label: 'São Tomé-et-Príncipe' },
  { code: 'TCD', label: 'Tchad' },
  // Afrique de l'Est et îles
  { code: 'BDI', label: 'Burundi' },
  { code: 'DJI', label: 'Djibouti' },
  { code: 'MDG', label: 'Madagascar' },
  { code: 'MUS', label: 'Maurice' },
  { code: 'MOZ', label: 'Mozambique' },
  { code: 'RWA', label: 'Rwanda' },
  { code: 'SYC', label: 'Seychelles' },
  { code: 'TLS', label: 'Timor-Leste' },
  // Afrique du Nord
  { code: 'DZA', label: 'Algérie' },
  { code: 'EGY', label: 'Égypte' },
  { code: 'MAR', label: 'Maroc' },
  { code: 'TUN', label: 'Tunisie' },
  // Moyen-Orient
  { code: 'LBN', label: 'Liban' },
  { code: 'ARE', label: 'Émirats arabes unis' },
  // Asie / Océanie / Pacifique
  { code: 'KHM', label: 'Cambodge' },
  { code: 'LAO', label: 'Laos' },
  { code: 'THA', label: 'Thaïlande' },
  { code: 'VNM', label: 'Vietnam' },
  { code: 'VUT', label: 'Vanuatu' },
  // Caraïbes / Amériques
  { code: 'ARG', label: 'Argentine' },
  { code: 'CAN', label: 'Canada' },
  { code: 'DMA', label: 'Dominique' },
  { code: 'HTI', label: 'Haïti' },
  { code: 'MEX', label: 'Mexique' },
  { code: 'LOU', label: 'Louisiane (gouvernement)' },
  { code: 'NBR', label: 'Nouveau-Brunswick (gouvernement)' },
  { code: 'ONT', label: 'Ontario (gouvernement)' },
  { code: 'QUE', label: 'Québec (gouvernement)' },
  { code: 'STE', label: 'Sainte-Lucie' },
  { code: 'URY', label: 'Uruguay' },
  // Europe de l'Ouest
  { code: 'AND', label: 'Andorre' },
  { code: 'AUT', label: 'Autriche' },
  { code: 'BEL', label: 'Belgique' },
  { code: 'FRA', label: 'France' },
  { code: 'FWB', label: 'Fédération Wallonie-Bruxelles (gouvernement)' },
  { code: 'LUX', label: 'Luxembourg' },
  { code: 'MCO', label: 'Monaco' },
  { code: 'CHE', label: 'Suisse' },
  { code: 'VAO', label: "Val d'Aoste (gouvernement)" },
  // Europe centrale et orientale
  { code: 'ALB', label: 'Albanie' },
  { code: 'ARM', label: 'Arménie' },
  { code: 'BIH', label: 'Bosnie-Herzégovine' },
  { code: 'BGR', label: 'Bulgarie' },
  { code: 'HRV', label: 'Croatie' },
  { code: 'CYP', label: 'Chypre' },
  { code: 'CZE', label: 'République tchèque' },
  { code: 'EST', label: 'Estonie' },
  { code: 'GEO', label: 'Géorgie' },
  { code: 'GRC', label: 'Grèce' },
  { code: 'HUN', label: 'Hongrie' },
  { code: 'XKX', label: 'Kosovo' },
  { code: 'LVA', label: 'Lettonie' },
  { code: 'LTU', label: 'Lituanie' },
  { code: 'MKD', label: 'Macédoine du Nord' },
  { code: 'MLT', label: 'Malte' },
  { code: 'MDA', label: 'Moldavie' },
  { code: 'MNE', label: 'Monténégro' },
  { code: 'POL', label: 'Pologne' },
  { code: 'ROU', label: 'Roumanie' },
  { code: 'SRB', label: 'Serbie' },
  { code: 'SVK', label: 'Slovaquie' },
  { code: 'SVN', label: 'Slovénie' },
  { code: 'UKR', label: 'Ukraine' },
  // Asie orientale
  { code: 'KOR', label: 'Corée du Sud' },
  // Option générique
  { code: 'AUTRE', label: 'Autre (à préciser)' },
];

const SEXE_LIBELLES: Record<string, string> = {
  F: 'Féminin',
  M: 'Masculin',
  Autre: 'Autre / Non précisé',
};

const DOMAINE_LIBELLES: Record<string, string> = {
  AGR_ELV_PCH: 'Agriculture / Élevage / Pêche',
  AGROALIM: 'Agroalimentaire',
  ARTISANAT: 'Artisanat',
  COMMERCE: 'Commerce',
  DEV_PERS: 'Développement personnel',
  ENTREPR_GEST: 'Entrepreneuriat / Gestion',
  ENV_ECO_VERTE: 'Environnement / Éco-verte',
  FP_TECH: 'Formation professionnelle technique',
  GEST_FIN_COMPTA: 'Gestion / Finance / Comptabilité',
  LANGUES_COM: 'Langues / Communication',
  NUM_INFO: 'Numérique / Informatique',
  SANTE_SERV_PERS: 'Santé / Services à la personne',
  SERV_FIN_INCLUSION: 'Services financiers / Inclusion',
  TOURISME: 'Tourisme',
  TRANSPORT: 'Transport',
  AUTRE: 'Autre',
};

const TYPE_STRUCTURE_LIBELLES: Record<string, string> = {
  AGR: 'Agriculture / Élevage / Pêche',
  MICRO_ENTR: 'Micro-entreprise',
  PETITE_ENTR: 'Petite entreprise',
  COOP: 'Coopérative',
  ASSOC: 'Association',
  GIE: 'GIE',
  AUTRE: 'Autre',
};

const SECTEUR_LIBELLES: Record<string, string> = {
  AGR_SYL_PCH: 'Agriculture / Sylviculture / Pêche',
  AGROALIM: 'Agroalimentaire',
  ARTISANAT: 'Artisanat',
  COMMERCE: 'Commerce',
  BTP: 'BTP',
  CULTURE: 'Culture',
  EDUC: 'Éducation / Formation',
  ENERGIE_ENV: 'Énergie / Environnement',
  TOURISME: 'Tourisme',
  INDUSTRIE: 'Industrie',
  SANTE_SOCIAL: 'Santé / Social',
  SERV_ENTR: 'Services aux entreprises',
  SERV_FIN: 'Services financiers',
  SPORT_LOISIRS: 'Sport / Loisirs',
  TIC: 'TIC / Numérique',
  TRANSPORT: 'Transport',
  AUTRE: 'Autre',
};

const NATURE_APPUI_LIBELLES: Record<string, string> = {
  SUBVENTION: 'Subvention',
  MATERIEL: 'Matériel',
  FORMATION: 'Formation',
  MENTORAT: 'Mentorat',
  MISE_RELATION: 'Mise en relation',
  APPUI_MIXTE: 'Appui mixte',
  AUTRE: 'Autre',
};

const STATUT_CREATION_OPTIONS = [
  { value: 'creation', label: 'Création (nouvelle structure)' },
  { value: 'renforcement', label: 'Renforcement (structure existante)' },
  { value: 'relance', label: 'Relance' },
];

// =============================================================================
// Composant principal
// =============================================================================

export function CollecteForm({ lien }: { lien: InfoLienPublic }) {
  const [etat, setEtat] = useState<'formulaire' | 'succes' | 'erreur'>('formulaire');
  const [erreurMessage, setErreurMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const [confirmationNouveau, setConfirmationNouveau] = useState(false);

  if (etat === 'succes') return <SuccesMessage type={lien.type} />;

  const handleSubmit = (donnees: Record<string, unknown>) => {
    startTransition(async () => {
      const result = await soumettreCollectePublique(lien.slug, donnees);
      if (result.status === 'succes') {
        setEtat('succes');
      } else {
        setErreurMessage(result.message ?? 'Erreur lors de la soumission.');
        setEtat('erreur');
      }
    });
  };

  const handleSubmitEtNouveau = (donnees: Record<string, unknown>) => {
    startTransition(async () => {
      const result = await soumettreCollectePublique(lien.slug, donnees);
      if (result.status === 'succes') {
        setFormKey((k) => k + 1);
        setConfirmationNouveau(true);
        setTimeout(() => setConfirmationNouveau(false), 5000);
      } else {
        setErreurMessage(result.message ?? 'Erreur lors de la soumission.');
        setEtat('erreur');
      }
    });
  };

  if (lien.type === 'A') {
    return (
      <FormulaireBeneficiaire
        key={formKey}
        lien={lien}
        isPending={isPending}
        erreur={erreurMessage}
        onSubmit={handleSubmit}
        onSubmitEtNouveau={handleSubmitEtNouveau}
        confirmationNouveau={confirmationNouveau}
      />
    );
  }
  return (
    <FormulaireStructure
      key={formKey}
      lien={lien}
      isPending={isPending}
      erreur={erreurMessage}
      onSubmit={handleSubmit}
      onSubmitEtNouveau={handleSubmitEtNouveau}
      confirmationNouveau={confirmationNouveau}
    />
  );
}

// =============================================================================
// Type A — Bénéficiaire
// =============================================================================

type FormDataA = {
  prenom: string;
  nom: string;
  sexe: string;
  pays_code: string;
  pays_autre: string;
  projet_code: string;
  domaine_formation_code: string;
  annee_formation: string;
  tranche_age_declaree: string;
  telephone: string;
  courriel: string;
  consentement: boolean;
};

function FormulaireBeneficiaire({
  lien,
  isPending,
  erreur,
  onSubmit,
  onSubmitEtNouveau,
  confirmationNouveau,
}: {
  lien: InfoLienPublic;
  isPending: boolean;
  erreur: string;
  onSubmit: (d: Record<string, unknown>) => void;
  onSubmitEtNouveau: (d: Record<string, unknown>) => void;
  confirmationNouveau: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormDataA>({
    defaultValues: {
      projet_code: lien.projet_code ?? '',
      annee_formation: String(new Date().getFullYear()),
      consentement: false,
      pays_autre: '',
    },
  });

  const paysCode = watch('pays_code');
  const consentement = watch('consentement');

  const buildPayload = (data: FormDataA): Record<string, unknown> => ({
    prenom: data.prenom,
    nom: data.nom,
    sexe: data.sexe,
    pays_code: data.pays_code,
    pays_autre: data.pays_code === 'AUTRE' ? data.pays_autre : null,
    projet_code: data.projet_code || lien.projet_code,
    domaine_formation_code: data.domaine_formation_code,
    annee_formation: Number(data.annee_formation),
    telephone: data.telephone || null,
    courriel: data.courriel || null,
    tranche_age_declaree: data.tranche_age_declaree || null,
    consentement_recueilli: data.consentement,
  });

  const soumettre = (data: FormDataA) => onSubmit(buildPayload(data));
  const soumettreEtNouveau = (data: FormDataA) => onSubmitEtNouveau(buildPayload(data));

  return (
    <form onSubmit={handleSubmit(soumettre)} className="space-y-6" noValidate>
      {/* Informations personnelles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vos informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prenom">
                Prénom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prenom"
                placeholder="Votre prénom"
                {...register('prenom', { required: 'Le prénom est obligatoire' })}
              />
              {errors.prenom && <p className="text-destructive text-xs">{errors.prenom.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nom">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nom"
                placeholder="Votre nom"
                {...register('nom', { required: 'Le nom est obligatoire' })}
              />
              {errors.nom && <p className="text-destructive text-xs">{errors.nom.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Sexe <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="sexe"
                control={control}
                rules={{ required: 'Le sexe est obligatoire' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEXE_VALUES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SEXE_LIBELLES[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.sexe && <p className="text-destructive text-xs">{errors.sexe.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tranche d&apos;âge</Label>
              <Controller
                name="tranche_age_declaree"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Facultatif…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jeune">Jeune (18–34 ans)</SelectItem>
                      <SelectItem value="adulte">Adulte (35 ans et +)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Pays <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="pays_code"
              control={control}
              rules={{ required: 'Le pays est obligatoire' }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Votre pays…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {PAYS_OIF.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.pays_code && (
              <p className="text-destructive text-xs">{errors.pays_code.message}</p>
            )}
            {paysCode === 'AUTRE' && (
              <Input
                className="mt-2"
                placeholder="Précisez votre pays…"
                {...register('pays_autre', { required: 'Veuillez préciser votre pays' })}
              />
            )}
            {errors.pays_autre && (
              <p className="text-destructive text-xs">{errors.pays_autre.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formation suivie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Domaine de formation <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="domaine_formation_code"
              control={control}
              rules={{ required: 'Le domaine est obligatoire' }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un domaine…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {DOMAINES_FORMATION_CODES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {DOMAINE_LIBELLES[c] ?? c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.domaine_formation_code && (
              <p className="text-destructive text-xs">{errors.domaine_formation_code.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="annee_formation">
              Année de formation <span className="text-destructive">*</span>
            </Label>
            <Input
              id="annee_formation"
              type="number"
              min={2020}
              max={2030}
              placeholder={String(new Date().getFullYear())}
              {...register('annee_formation', {
                required: "L'année est obligatoire",
                min: { value: 2020, message: 'Minimum 2020' },
                max: { value: 2030, message: 'Maximum 2030' },
              })}
            />
            {errors.annee_formation && (
              <p className="text-destructive text-xs">{errors.annee_formation.message}</p>
            )}
          </div>

          {!lien.projet_code && (
            <div className="space-y-1.5">
              <Label>
                Projet OIF <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="projet_code"
                control={control}
                rules={{ required: 'Le code projet est obligatoire' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Code projet…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {PROJETS_CODES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.projet_code && (
                <p className="text-destructive text-xs">{errors.projet_code.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Contact <span className="text-muted-foreground text-xs font-normal">(facultatif)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input id="telephone" placeholder="+22676123456" {...register('telephone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="courriel">Courriel</Label>
              <Input
                id="courriel"
                type="email"
                placeholder="votre@email.com"
                {...register('courriel')}
              />
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="consentement_a"
              checked={consentement}
              onCheckedChange={(v) => setValue('consentement', v === true)}
            />
            <Label htmlFor="consentement_a" className="cursor-pointer text-sm leading-relaxed">
              J&apos;accepte que mes informations de contact (téléphone, courriel) soient conservées
              par l&apos;OIF aux fins de suivi du projet et ne soient pas transmises à des tiers.
            </Label>
          </div>
        </CardContent>
      </Card>

      {confirmationNouveau && (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="size-4 shrink-0" />
          Enregistrement soumis avec succès. Vous pouvez saisir un nouvel enregistrement.
        </div>
      )}

      {erreur && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-4 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          {erreur}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-[#5D0073] hover:bg-[#4a005c]"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Envoi en cours…
            </>
          ) : (
            <>
              <Send className="mr-2 size-4" />
              Soumettre
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleSubmit(soumettreEtNouveau)}
          className="flex-1"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Envoi en cours…
            </>
          ) : (
            <>
              <PlusCircle className="mr-2 size-4" />
              Soumettre et ajouter un nouvel enregistrement
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// Type B — Structure
// =============================================================================

type FormDataB = {
  nom_structure: string;
  type_structure_code: string;
  secteur_activite_code: string;
  statut_creation: string;
  annee_appui: string;
  nature_appui_code: string;
  projet_code: string;
  pays_code: string;
  pays_autre: string;
  porteur_nom: string;
  porteur_prenom: string;
  porteur_sexe: string;
  telephone: string;
  courriel: string;
  intitule_initiative: string;
  consentement: boolean;
};

function FormulaireStructure({
  lien,
  isPending,
  erreur,
  onSubmit,
  onSubmitEtNouveau,
  confirmationNouveau,
}: {
  lien: InfoLienPublic;
  isPending: boolean;
  erreur: string;
  onSubmit: (d: Record<string, unknown>) => void;
  onSubmitEtNouveau: (d: Record<string, unknown>) => void;
  confirmationNouveau: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormDataB>({
    defaultValues: {
      projet_code: lien.projet_code ?? '',
      annee_appui: String(new Date().getFullYear()),
      consentement: false,
      pays_autre: '',
    },
  });

  const paysCode = watch('pays_code');
  const consentement = watch('consentement');

  const buildPayload = (data: FormDataB): Record<string, unknown> => ({
    nom_structure: data.nom_structure,
    type_structure_code: data.type_structure_code,
    secteur_activite_code: data.secteur_activite_code,
    statut_creation: data.statut_creation,
    annee_appui: Number(data.annee_appui),
    nature_appui_code: data.nature_appui_code,
    projet_code: data.projet_code || lien.projet_code,
    pays_code: data.pays_code,
    pays_autre: data.pays_code === 'AUTRE' ? data.pays_autre : null,
    porteur_nom: data.porteur_nom,
    porteur_prenom: data.porteur_prenom || null,
    porteur_sexe: data.porteur_sexe,
    telephone: data.telephone || null,
    courriel: data.courriel || null,
    intitule_initiative: data.intitule_initiative || null,
    consentement_recueilli: data.consentement,
  });

  const soumettre = (data: FormDataB) => onSubmit(buildPayload(data));
  const soumettreEtNouveau = (data: FormDataB) => onSubmitEtNouveau(buildPayload(data));

  return (
    <form onSubmit={handleSubmit(soumettre)} className="space-y-6" noValidate>
      {/* Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations sur la structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nom_structure">
              Nom de la structure <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nom_structure"
              placeholder="Nom complet de la structure"
              {...register('nom_structure', { required: 'Le nom est obligatoire' })}
            />
            {errors.nom_structure && (
              <p className="text-destructive text-xs">{errors.nom_structure.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Type de structure <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="type_structure_code"
                control={control}
                rules={{ required: 'Le type est obligatoire' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES_STRUCTURE_CODES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {TYPE_STRUCTURE_LIBELLES[c] ?? c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type_structure_code && (
                <p className="text-destructive text-xs">{errors.type_structure_code.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Secteur d&apos;activité <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="secteur_activite_code"
                control={control}
                rules={{ required: 'Le secteur est obligatoire' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {SECTEURS_ACTIVITE_CODES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {SECTEUR_LIBELLES[c] ?? c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.secteur_activite_code && (
                <p className="text-destructive text-xs">{errors.secteur_activite_code.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Statut <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="statut_creation"
                control={control}
                rules={{ required: 'Le statut est obligatoire' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUT_CREATION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.statut_creation && (
                <p className="text-destructive text-xs">{errors.statut_creation.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Nature de l&apos;appui <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="nature_appui_code"
                control={control}
                rules={{ required: "La nature de l'appui est obligatoire" }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {NATURES_APPUI_CODES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {NATURE_APPUI_LIBELLES[c] ?? c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.nature_appui_code && (
                <p className="text-destructive text-xs">{errors.nature_appui_code.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Pays <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="pays_code"
                control={control}
                rules={{ required: 'Le pays est obligatoire' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pays…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {PAYS_OIF.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.pays_code && (
                <p className="text-destructive text-xs">{errors.pays_code.message}</p>
              )}
              {paysCode === 'AUTRE' && (
                <Input
                  className="mt-2"
                  placeholder="Précisez le pays…"
                  {...register('pays_autre', { required: 'Veuillez préciser le pays' })}
                />
              )}
              {errors.pays_autre && (
                <p className="text-destructive text-xs">{errors.pays_autre.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="annee_appui">
                Année d&apos;appui <span className="text-destructive">*</span>
              </Label>
              <Input
                id="annee_appui"
                type="number"
                min={2020}
                max={2030}
                {...register('annee_appui', {
                  required: "L'année est obligatoire",
                  min: { value: 2020, message: 'Minimum 2020' },
                  max: { value: 2030, message: 'Maximum 2030' },
                })}
              />
              {errors.annee_appui && (
                <p className="text-destructive text-xs">{errors.annee_appui.message}</p>
              )}
            </div>
          </div>

          {!lien.projet_code && (
            <div className="space-y-1.5">
              <Label>
                Projet OIF <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="projet_code"
                control={control}
                rules={{ required: 'Le code projet est obligatoire' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Code projet…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {PROJETS_CODES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.projet_code && (
                <p className="text-destructive text-xs">{errors.projet_code.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="intitule_initiative">Intitulé de l&apos;initiative</Label>
            <Input
              id="intitule_initiative"
              placeholder="Nom du projet / de l'initiative portée"
              {...register('intitule_initiative')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Porteur / Responsable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Responsable / Porteur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="porteur_nom">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="porteur_nom"
                placeholder="Nom de famille"
                {...register('porteur_nom', { required: 'Le nom du porteur est obligatoire' })}
              />
              {errors.porteur_nom && (
                <p className="text-destructive text-xs">{errors.porteur_nom.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="porteur_prenom">Prénom</Label>
              <Input id="porteur_prenom" placeholder="Prénom" {...register('porteur_prenom')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Sexe du porteur <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="porteur_sexe"
              control={control}
              rules={{ required: 'Le sexe est obligatoire' }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEXE_VALUES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SEXE_LIBELLES[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.porteur_sexe && (
              <p className="text-destructive text-xs">{errors.porteur_sexe.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="telephone_b">Téléphone</Label>
              <Input id="telephone_b" placeholder="+22676123456" {...register('telephone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="courriel_b">Courriel</Label>
              <Input
                id="courriel_b"
                type="email"
                placeholder="porteur@structure.org"
                {...register('courriel')}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="consentement_b"
              checked={consentement}
              onCheckedChange={(v) => setValue('consentement', v === true)}
            />
            <Label htmlFor="consentement_b" className="cursor-pointer text-sm leading-relaxed">
              J&apos;accepte que les coordonnées du porteur (téléphone, courriel) soient conservées
              par l&apos;OIF aux fins de suivi du projet et ne soient pas transmises à des tiers.
            </Label>
          </div>
        </CardContent>
      </Card>

      {confirmationNouveau && (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="size-4 shrink-0" />
          Enregistrement soumis avec succès. Vous pouvez saisir une nouvelle structure.
        </div>
      )}

      {erreur && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-4 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          {erreur}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-[#5D0073] hover:bg-[#4a005c]"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Envoi en cours…
            </>
          ) : (
            <>
              <Send className="mr-2 size-4" />
              Soumettre
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleSubmit(soumettreEtNouveau)}
          className="flex-1"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Envoi en cours…
            </>
          ) : (
            <>
              <PlusCircle className="mr-2 size-4" />
              Soumettre et ajouter un nouvel enregistrement
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// Écran de succès
// =============================================================================

function SuccesMessage({ type }: { type: 'A' | 'B' }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="size-8 text-green-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Enregistrement reçu !</h2>
          <p className="text-muted-foreground text-sm">
            {type === 'A'
              ? "Votre inscription a bien été soumise. Elle sera examinée par un coordinateur OIF avant d'être intégrée dans la plateforme."
              : 'Les informations sur votre structure ont bien été transmises. Un coordinateur OIF les examinera avant de les intégrer dans la plateforme.'}
          </p>
          <p className="text-muted-foreground text-xs">
            Aucune autre action n&apos;est requise de votre part.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
