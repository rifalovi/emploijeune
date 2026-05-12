'use client';

/**
 * Formulaire de collecte publique — Type A (bénéficiaire) ou Type B (structure).
 *
 * Rendu uniquement APRÈS validation du slug côté serveur.
 * Soumet les données via Server Action (soumettreCollectePublique).
 * Conçu pour être utilisé sans compte — accessible depuis un lien partagé.
 */

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
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
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { soumettreCollectePublique } from '@/lib/collecte-publique/actions';
import type { InfoLienPublic } from '@/lib/collecte-publique/actions';
import {
  PAYS_CODES,
  PROJETS_CODES,
  SEXE_VALUES,
  DOMAINES_FORMATION_CODES,
  TYPES_STRUCTURE_CODES,
  SECTEURS_ACTIVITE_CODES,
  NATURES_APPUI_CODES,
} from '@/lib/schemas/nomenclatures';

// Libellés lisibles pour les dropdowns
const PAYS_LIBELLES: Record<string, string> = {
  BEN: 'Bénin', BFA: 'Burkina Faso', BDI: 'Burundi', CMR: 'Cameroun',
  CAF: 'Centrafrique', COM: 'Comores', COD: 'Congo (RDC)', COG: 'Congo (Rép.)',
  CIV: "Côte d'Ivoire", DJI: 'Djibouti', GAB: 'Gabon', GIN: 'Guinée',
  GNB: 'Guinée-Bissau', GNQ: 'Guinée équatoriale', HTI: 'Haïti', MDG: 'Madagascar',
  MLI: 'Mali', MRT: 'Mauritanie', MUS: 'Maurice', MAR: 'Maroc', MOZ: 'Mozambique',
  NER: 'Niger', RWA: 'Rwanda', STP: 'São Tomé-et-Príncipe', SEN: 'Sénégal',
  SYC: 'Seychelles', TCD: 'Tchad', TGO: 'Togo', TUN: 'Tunisie',
  VUT: 'Vanuatu', DZA: 'Algérie', EGY: 'Égypte', LBN: 'Liban',
  ALB: 'Albanie', BGR: 'Bulgarie', FRA: 'France', BEL: 'Belgique',
  CHE: 'Suisse', CAN: 'Canada', BRA: 'Brésil', ARG: 'Argentine',
};

const SEXE_LIBELLES: Record<string, string> = { F: 'Féminin', M: 'Masculin', Autre: 'Autre / Non précisé' };

const DOMAINE_LIBELLES: Record<string, string> = {
  AGR_ELV_PCH: 'Agriculture / Élevage / Pêche', AGROALIM: 'Agroalimentaire',
  ARTISANAT: 'Artisanat', COMMERCE: 'Commerce', DEV_PERS: 'Développement personnel',
  ENTREPR_GEST: 'Entrepreneuriat / Gestion', ENV_ECO_VERTE: 'Environnement / Éco-verte',
  FP_TECH: 'Formation professionnelle technique', GEST_FIN_COMPTA: 'Gestion / Finance / Comptabilité',
  LANGUES_COM: 'Langues / Communication', NUM_INFO: 'Numérique / Informatique',
  SANTE_SERV_PERS: 'Santé / Services à la personne', SERV_FIN_INCLUSION: 'Services financiers / Inclusion',
  TOURISME: 'Tourisme', TRANSPORT: 'Transport', AUTRE: 'Autre',
};

const TYPE_STRUCTURE_LIBELLES: Record<string, string> = {
  AGR: 'Agriculture / Élevage / Pêche', MICRO_ENTR: 'Micro-entreprise',
  PETITE_ENTR: 'Petite entreprise', COOP: 'Coopérative',
  ASSOC: 'Association', GIE: 'GIE', AUTRE: 'Autre',
};

const SECTEUR_LIBELLES: Record<string, string> = {
  AGR_SYL_PCH: 'Agriculture / Sylviculture / Pêche', AGROALIM: 'Agroalimentaire',
  ARTISANAT: 'Artisanat', COMMERCE: 'Commerce', BTP: 'BTP',
  CULTURE: 'Culture', EDUC: 'Éducation / Formation', ENERGIE_ENV: 'Énergie / Environnement',
  TOURISME: 'Tourisme', INDUSTRIE: 'Industrie', SANTE_SOCIAL: 'Santé / Social',
  SERV_ENTR: 'Services aux entreprises', SERV_FIN: 'Services financiers',
  SPORT_LOISIRS: 'Sport / Loisirs', TIC: 'TIC / Numérique',
  TRANSPORT: 'Transport', AUTRE: 'Autre',
};

const NATURE_APPUI_LIBELLES: Record<string, string> = {
  SUBVENTION: 'Subvention', MATERIEL: 'Matériel', FORMATION: 'Formation',
  MENTORAT: 'Mentorat', MISE_RELATION: 'Mise en relation',
  APPUI_MIXTE: 'Appui mixte', AUTRE: 'Autre',
};

const STATUT_CREATION_OPTIONS = [
  { value: 'creation', label: 'Création (nouvelle structure)' },
  { value: 'renforcement', label: 'Renforcement (structure existante)' },
  { value: 'relance', label: 'Relance' },
];

// =============================================================================
// Composant principal
// =============================================================================

type CollecteFormProps = {
  lien: InfoLienPublic;
};

type FormDataA = {
  prenom: string;
  nom: string;
  sexe: string;
  pays_code: string;
  projet_code: string;
  domaine_formation_code: string;
  annee_formation: string;
  telephone: string;
  courriel: string;
  tranche_age_declaree: string;
  consentement: boolean;
};

type FormDataB = {
  nom_structure: string;
  type_structure: string;
  secteur_activite: string;
  statut_creation: string;
  annee_appui: string;
  nature_appui: string;
  projet_code: string;
  pays_code: string;
  porteur_nom: string;
  porteur_prenom: string;
  porteur_sexe: string;
  telephone: string;
  courriel: string;
  intitule_initiative: string;
  consentement: boolean;
};

export function CollecteForm({ lien }: CollecteFormProps) {
  const [etat, setEtat] = useState<'formulaire' | 'succes' | 'erreur'>('formulaire');
  const [erreurMessage, setErreurMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  if (etat === 'succes') {
    return <SuccesMessage type={lien.type} />;
  }

  if (lien.type === 'A') {
    return (
      <FormulaireBeneficiaire
        lien={lien}
        isPending={isPending}
        erreur={erreurMessage}
        onSubmit={(donnees) => {
          startTransition(async () => {
            const result = await soumettreCollectePublique(lien.slug, donnees);
            if (result.status === 'succes') {
              setEtat('succes');
            } else {
              setErreurMessage(result.message ?? 'Erreur lors de la soumission.');
              setEtat('erreur');
            }
          });
        }}
      />
    );
  }

  return (
    <FormulaireStructure
      lien={lien}
      isPending={isPending}
      erreur={erreurMessage}
      onSubmit={(donnees) => {
        startTransition(async () => {
          const result = await soumettreCollectePublique(lien.slug, donnees);
          if (result.status === 'succes') {
            setEtat('succes');
          } else {
            setErreurMessage(result.message ?? 'Erreur lors de la soumission.');
            setEtat('erreur');
          }
        });
      }}
    />
  );
}

// =============================================================================
// Formulaire Type A — Bénéficiaire
// =============================================================================

function FormulaireBeneficiaire({
  lien,
  isPending,
  erreur,
  onSubmit,
}: {
  lien: InfoLienPublic;
  isPending: boolean;
  erreur: string;
  onSubmit: (donnees: Record<string, unknown>) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormDataA>({
    defaultValues: {
      projet_code: lien.projet_code ?? '',
      annee_formation: String(new Date().getFullYear()),
      consentement: false,
    },
  });

  const consentement = watch('consentement');

  const soumettre = (data: FormDataA) => {
    onSubmit({
      prenom: data.prenom,
      nom: data.nom,
      sexe: data.sexe,
      pays_code: data.pays_code,
      projet_code: data.projet_code || lien.projet_code,
      domaine_formation_code: data.domaine_formation_code,
      annee_formation: Number(data.annee_formation),
      telephone: data.telephone || null,
      courriel: data.courriel || null,
      tranche_age_declaree: data.tranche_age_declaree || null,
      consentement_recueilli: data.consentement,
    });
  };

  return (
    <form onSubmit={handleSubmit(soumettre)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vos informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prenom">Prénom <span className="text-destructive">*</span></Label>
              <Input
                id="prenom"
                placeholder="Votre prénom"
                {...register('prenom', { required: 'Le prénom est obligatoire' })}
              />
              {errors.prenom && <p className="text-destructive text-xs">{errors.prenom.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nom">Nom <span className="text-destructive">*</span></Label>
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
              <Label>Sexe <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={(v: string | null) => setValue('sexe', v ?? "")}
                {...register('sexe', { required: 'Le sexe est obligatoire' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {SEXE_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>{SEXE_LIBELLES[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sexe && <p className="text-destructive text-xs">{errors.sexe.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tranche d'âge</Label>
              <Select onValueChange={(v: string | null) => setValue('tranche_age_declaree', v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Facultatif…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jeune">Jeune (18–34 ans)</SelectItem>
                  <SelectItem value="adulte">Adulte (35 ans et +)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Pays <span className="text-destructive">*</span></Label>
            <Select
              onValueChange={(v: string | null) => setValue('pays_code', v ?? "")}
              {...register('pays_code', { required: 'Le pays est obligatoire' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Votre pays…" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {PAYS_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {PAYS_LIBELLES[code] ?? code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.pays_code && <p className="text-destructive text-xs">{errors.pays_code.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formation suivie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Domaine de formation <span className="text-destructive">*</span></Label>
            <Select
              onValueChange={(v: string | null) => setValue('domaine_formation_code', v ?? "")}
              {...register('domaine_formation_code', { required: 'Le domaine est obligatoire' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un domaine…" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {DOMAINES_FORMATION_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {DOMAINE_LIBELLES[code] ?? code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.domaine_formation_code && (
              <p className="text-destructive text-xs">{errors.domaine_formation_code.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="annee_formation">Année de formation <span className="text-destructive">*</span></Label>
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
              <Label>Projet OIF <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={(v: string | null) => setValue('projet_code', v ?? "")}
                {...register('projet_code', { required: 'Le code projet est obligatoire' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Code projet…" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {PROJETS_CODES.map((code) => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.projet_code && (
                <p className="text-destructive text-xs">{errors.projet_code.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact <span className="text-muted-foreground font-normal text-xs">(facultatif)</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Ces informations ne seront conservées que si vous donnez votre consentement ci-dessous.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                placeholder="+22676123456"
                {...register('telephone')}
                disabled={!consentement}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="courriel">Courriel</Label>
              <Input
                id="courriel"
                type="email"
                placeholder="votre@email.com"
                {...register('courriel')}
                disabled={!consentement}
              />
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="consentement"
              checked={consentement}
              onCheckedChange={(v) => setValue('consentement', v === true)}
            />
            <Label htmlFor="consentement" className="cursor-pointer text-sm leading-relaxed">
              J'accepte que mes informations de contact (téléphone, courriel) soient conservées par
              l'OIF aux fins de suivi du projet et ne soient pas transmises à des tiers.
            </Label>
          </div>
        </CardContent>
      </Card>

      {erreur && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {erreur}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full bg-[#5D0073] hover:bg-[#4a005c]">
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Envoi en cours…
          </>
        ) : (
          <>
            <Send className="mr-2 size-4" />
            Envoyer mon inscription
          </>
        )}
      </Button>
    </form>
  );
}

// =============================================================================
// Formulaire Type B — Structure
// =============================================================================

function FormulaireStructure({
  lien,
  isPending,
  erreur,
  onSubmit,
}: {
  lien: InfoLienPublic;
  isPending: boolean;
  erreur: string;
  onSubmit: (donnees: Record<string, unknown>) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormDataB>({
    defaultValues: {
      projet_code: lien.projet_code ?? '',
      annee_appui: String(new Date().getFullYear()),
      consentement: false,
    },
  });

  const consentement = watch('consentement');

  const soumettre = (data: FormDataB) => {
    onSubmit({
      nom_structure: data.nom_structure,
      type_structure: data.type_structure,
      secteur_activite: data.secteur_activite,
      statut_creation: data.statut_creation,
      annee_appui: Number(data.annee_appui),
      nature_appui: data.nature_appui,
      projet_code: data.projet_code || lien.projet_code,
      pays_code: data.pays_code,
      porteur_nom: data.porteur_nom,
      porteur_prenom: data.porteur_prenom || null,
      porteur_sexe: data.porteur_sexe,
      telephone: data.telephone || null,
      courriel: data.courriel || null,
      intitule_initiative: data.intitule_initiative || null,
      consentement_recueilli: data.consentement,
    });
  };

  return (
    <form onSubmit={handleSubmit(soumettre)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations sur la structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nom_structure">Nom de la structure <span className="text-destructive">*</span></Label>
            <Input
              id="nom_structure"
              placeholder="Nom complet de la structure"
              {...register('nom_structure', { required: 'Le nom est obligatoire' })}
            />
            {errors.nom_structure && <p className="text-destructive text-xs">{errors.nom_structure.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type de structure <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={(v: string | null) => setValue('type_structure', v ?? "")}
                {...register('type_structure', { required: 'Le type est obligatoire' })}
              >
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {TYPES_STRUCTURE_CODES.map((c) => (
                    <SelectItem key={c} value={c}>{TYPE_STRUCTURE_LIBELLES[c] ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type_structure && <p className="text-destructive text-xs">{errors.type_structure.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Secteur d'activité <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={(v: string | null) => setValue('secteur_activite', v ?? "")}
                {...register('secteur_activite', { required: 'Le secteur est obligatoire' })}
              >
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent className="max-h-56">
                  {SECTEURS_ACTIVITE_CODES.map((c) => (
                    <SelectItem key={c} value={c}>{SECTEUR_LIBELLES[c] ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.secteur_activite && <p className="text-destructive text-xs">{errors.secteur_activite.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Statut <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={(v: string | null) => setValue('statut_creation', v ?? "")}
                {...register('statut_creation', { required: 'Le statut est obligatoire' })}
              >
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {STATUT_CREATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.statut_creation && <p className="text-destructive text-xs">{errors.statut_creation.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Nature de l'appui <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={(v: string | null) => setValue('nature_appui', v ?? "")}
                {...register('nature_appui', { required: "La nature de l'appui est obligatoire" })}
              >
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {NATURES_APPUI_CODES.map((c) => (
                    <SelectItem key={c} value={c}>{NATURE_APPUI_LIBELLES[c] ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.nature_appui && <p className="text-destructive text-xs">{errors.nature_appui.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Pays <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={(v: string | null) => setValue('pays_code', v ?? "")}
                {...register('pays_code', { required: 'Le pays est obligatoire' })}
              >
                <SelectTrigger><SelectValue placeholder="Pays…" /></SelectTrigger>
                <SelectContent className="max-h-56">
                  {PAYS_CODES.map((c) => (
                    <SelectItem key={c} value={c}>{PAYS_LIBELLES[c] ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.pays_code && <p className="text-destructive text-xs">{errors.pays_code.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="annee_appui">Année d'appui <span className="text-destructive">*</span></Label>
              <Input
                id="annee_appui"
                type="number"
                min={2020}
                max={2030}
                {...register('annee_appui', { required: "L'année est obligatoire" })}
              />
              {errors.annee_appui && <p className="text-destructive text-xs">{errors.annee_appui.message}</p>}
            </div>
          </div>

          {!lien.projet_code && (
            <div className="space-y-1.5">
              <Label>Projet OIF <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={(v: string | null) => setValue('projet_code', v ?? "")}
                {...register('projet_code', { required: 'Le code projet est obligatoire' })}
              >
                <SelectTrigger><SelectValue placeholder="Code projet…" /></SelectTrigger>
                <SelectContent className="max-h-56">
                  {PROJETS_CODES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.projet_code && <p className="text-destructive text-xs">{errors.projet_code.message}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="intitule_initiative">Intitulé de l'initiative</Label>
            <Input
              id="intitule_initiative"
              placeholder="Nom du projet / de l'initiative portée"
              {...register('intitule_initiative')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Responsable / Porteur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="porteur_nom">Nom <span className="text-destructive">*</span></Label>
              <Input
                id="porteur_nom"
                placeholder="Nom de famille"
                {...register('porteur_nom', { required: 'Le nom du porteur est obligatoire' })}
              />
              {errors.porteur_nom && <p className="text-destructive text-xs">{errors.porteur_nom.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="porteur_prenom">Prénom</Label>
              <Input id="porteur_prenom" placeholder="Prénom" {...register('porteur_prenom')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Sexe du porteur <span className="text-destructive">*</span></Label>
            <Select
              onValueChange={(v: string | null) => setValue('porteur_sexe', v ?? "")}
              {...register('porteur_sexe', { required: 'Le sexe est obligatoire' })}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>
                {SEXE_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>{SEXE_LIBELLES[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.porteur_sexe && <p className="text-destructive text-xs">{errors.porteur_sexe.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                placeholder="+22676123456"
                {...register('telephone')}
                disabled={!consentement}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="courriel">Courriel</Label>
              <Input
                id="courriel"
                type="email"
                placeholder="porteur@structure.org"
                {...register('courriel')}
                disabled={!consentement}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="consentement"
              checked={consentement}
              onCheckedChange={(v) => setValue('consentement', v === true)}
            />
            <Label htmlFor="consentement" className="cursor-pointer text-sm leading-relaxed">
              J'accepte que les coordonnées du porteur (téléphone, courriel) soient conservées
              par l'OIF aux fins de suivi du projet et ne soient pas transmises à des tiers.
            </Label>
          </div>
        </CardContent>
      </Card>

      {erreur && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {erreur}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full bg-[#5D0073] hover:bg-[#4a005c]">
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Envoi en cours…
          </>
        ) : (
          <>
            <Send className="mr-2 size-4" />
            Enregistrer la structure
          </>
        )}
      </Button>
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
