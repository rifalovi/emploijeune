'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { beneficiaireInsertSchema, type BeneficiaireInsertInput } from '@/lib/schemas/beneficiaire';
import {
  SEXE_VALUES,
  SEXE_LIBELLES,
  MODALITES_FORMATION_CODES,
  MODALITE_FORMATION_LIBELLES,
  STATUTS_BENEFICIAIRE_CODES,
  STATUT_BENEFICIAIRE_LIBELLES,
} from '@/lib/schemas/nomenclatures';
import { creerBeneficiaire, modifierBeneficiaire } from '@/lib/beneficiaires/mutations';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { PickerIndicatifPays } from './picker-indicatif-pays';
import { WarningQualite, messageWarningQualiteStatut } from './warning-qualite';
import { RepriseApresEnregistrement } from './reprise-apres-enregistrement';
import { DialogueDoublon } from './dialogue-doublon';
import { EcranSuccesCreation } from './ecran-succes-creation';
import { calculerTrancheAge } from './tranche-age';

/**
 * Mapping booléen→libellé pour le Select « Consentement RGPD ».
 * Valeur du form : `boolean`. Valeur passée au Select : stringifiée via
 * ternaire côté parent. Ce Record doit donc indexer par `'true'`/`'false'`.
 */
const CONSENTEMENT_LIBELLES: Record<'true' | 'false', string> = {
  true: 'Oui — consentement recueilli',
  false: 'Non — pas de consentement',
};

/**
 * Helper : renvoie une fonction de rendu pour `<SelectValue>` qui résout la
 * valeur brute Base-UI (Base-UI 1.3+ affiche la valeur brute par défaut) en
 * libellé utilisateur via le map fourni. Si aucune valeur n'est sélectionnée,
 * affiche le placeholder en grisé.
 */
function afficherLibelle(map: Record<string, string>, placeholder: string) {
  function LibelleRender(value: string | null | undefined) {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }
    return map[value] ?? value;
  }
  LibelleRender.displayName = 'LibelleRender';
  return LibelleRender;
}

/**
 * Formulaire de création d'un bénéficiaire (5 sections).
 *
 * Comportements clés :
 *   - Validation Zod via react-hook-form (beneficiaireInsertSchema)
 *   - Contacts (téléphone, courriel) désactivés tant que le consentement
 *     n'est pas coché → UX conforme RGPD
 *   - Picker rapide d'indicatif téléphonique (5 pays)
 *   - Warning non bloquant si statut = FORMATION_ACHEVEE/ABANDON sans
 *     date_fin_formation (Q2)
 *   - Détection doublon bloquante côté serveur (Q7) : affichage d'un
 *     bandeau avec lien vers la fiche existante
 *   - Saisie à la chaîne (Q1=B) : bandeau de rappel en tête si URL params
 *     cohorte_*, et écran de succès avec 3 CTA après enregistrement
 */

type FormValues = BeneficiaireInsertInput;

type DoublonState = {
  id: string;
  prenom: string;
  nom: string;
  date_naissance: string | null;
  projet_code: string;
};

type SuccesState = {
  id: string;
  prenom: string;
  nom: string;
  queryCohorte: string;
};

/**
 * Valeurs initiales complètes pour le mode édition. Toutes les clés sont
 * remplies depuis la fiche existante (BeneficiaireDetail côté page serveur).
 */
export type BeneficiaireFormInitialValues = Partial<FormValues>;

export type BeneficiaireFormProps = {
  nomenclatures: Nomenclatures;
  projetsOptions: Array<{ code: string; libelle: string }>;
  paysOptions: Array<{ code: string; libelle: string }>;
  domainesOptions: Array<{ code: string; libelle: string }>;
  /**
   * - `creation` : formulaire vierge, cohorte éventuelle via URL params,
   *   écran de succès avec 3 CTA après submit.
   * - `edition` : formulaire pré-rempli avec `initialValues`, redirection
   *   vers la fiche détail + toast après submit réussi.
   */
  mode: 'creation' | 'edition';
  /** Valeurs pré-remplies pour le mode saisie à la chaîne (création). */
  cohorte?: {
    projet?: string;
    pays?: string;
    domaine?: string;
    annee?: number;
    modalite?: string;
    partenaire?: string;
  };
  /** Valeurs initiales complètes pour l'édition. Obligatoire si mode='edition'. */
  initialValues?: BeneficiaireFormInitialValues;
  /** ID de la fiche à éditer. Obligatoire si mode='edition'. */
  beneficiaireId?: string;
};

export function BeneficiaireForm({
  nomenclatures,
  projetsOptions,
  paysOptions,
  domainesOptions,
  mode,
  cohorte = {},
  initialValues,
  beneficiaireId,
}: BeneficiaireFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [doublon, setDoublon] = useState<DoublonState | null>(null);
  const [succes, setSucces] = useState<SuccesState | null>(null);

  // NOTE: zodResolver v5 + Zod v4 transforms = conflit de types impossible à
  // réconcilier statiquement (optionnalité de la clé vs optionalité de la
  // valeur). On cast en `never` pour neutraliser ; la validation runtime via
  // Zod est parfaitement fonctionnelle et couvre tous les cas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolver = zodResolver(beneficiaireInsertSchema) as any;
  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      prenom: initialValues?.prenom ?? '',
      nom: initialValues?.nom ?? '',
      sexe: initialValues?.sexe ?? undefined,
      date_naissance: initialValues?.date_naissance ?? undefined,
      projet_code: initialValues?.projet_code ?? cohorte.projet ?? undefined,
      pays_code: initialValues?.pays_code ?? cohorte.pays ?? undefined,
      partenaire_accompagnement:
        initialValues?.partenaire_accompagnement ?? cohorte.partenaire ?? '',
      domaine_formation_code: initialValues?.domaine_formation_code ?? cohorte.domaine ?? undefined,
      intitule_formation: initialValues?.intitule_formation ?? '',
      modalite_formation_code:
        initialValues?.modalite_formation_code ?? cohorte.modalite ?? undefined,
      annee_formation: (initialValues?.annee_formation ??
        cohorte.annee ??
        new Date().getFullYear()) as unknown as FormValues['annee_formation'],
      date_debut_formation: initialValues?.date_debut_formation ?? undefined,
      date_fin_formation: initialValues?.date_fin_formation ?? undefined,
      statut_code: initialValues?.statut_code ?? 'INSCRIT',
      fonction_actuelle: initialValues?.fonction_actuelle ?? '',
      consentement_recueilli: initialValues?.consentement_recueilli ?? false,
      consentement_date: initialValues?.consentement_date ?? undefined,
      telephone: initialValues?.telephone ?? '',
      courriel: initialValues?.courriel ?? '',
      localite_residence: initialValues?.localite_residence ?? '',
      commentaire: initialValues?.commentaire ?? '',
    } as unknown as FormValues,
  });

  // Watches pour les comportements dynamiques
  const consentement = form.watch('consentement_recueilli');
  const dateNaissance = form.watch('date_naissance');
  const statut = form.watch('statut_code');
  const dateFinFormation = form.watch('date_fin_formation');
  const telephone = form.watch('telephone') ?? '';

  // Maps code→libellé dérivés des options serveur, pour afficher le libellé
  // dans le trigger Select après sélection (Base-UI 1.3+ affiche la valeur
  // brute par défaut).
  const projetsLibelles = Object.fromEntries(projetsOptions.map((o) => [o.code, o.libelle]));
  const paysLibelles = Object.fromEntries(paysOptions.map((o) => [o.code, o.libelle]));
  const domainesLibelles = Object.fromEntries(domainesOptions.map((o) => [o.code, o.libelle]));

  const warningQualite = messageWarningQualiteStatut(statut, dateFinFormation);

  const onSubmit = form.handleSubmit(async (values) => {
    setDoublon(null);
    startTransition(async () => {
      if (mode === 'edition') {
        if (!beneficiaireId) {
          toast.error('Impossible d’identifier la fiche à modifier');
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await modifierBeneficiaire({ ...(values as any), id: beneficiaireId });
        if (result.status === 'succes') {
          toast.success('Modifications enregistrées');
          router.push(`/beneficiaires/${beneficiaireId}`);
        } else if (result.status === 'doublon') {
          setDoublon(result.ficheExistante);
          toast.error('Un autre bénéficiaire existe déjà avec ces informations');
        } else if (result.status === 'erreur_validation') {
          toast.error('Validation serveur : ' + result.issues.map((i) => i.message).join(', '));
        } else {
          toast.error(result.message);
        }
        return;
      }

      // Mode création
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await creerBeneficiaire(values as any);
      if (result.status === 'succes') {
        const params = new URLSearchParams();
        if (values.projet_code) params.set('cohorte_projet', String(values.projet_code));
        if (values.pays_code) params.set('cohorte_pays', String(values.pays_code));
        if (values.domaine_formation_code)
          params.set('cohorte_domaine', String(values.domaine_formation_code));
        if (values.annee_formation) params.set('cohorte_annee', String(values.annee_formation));
        if (values.modalite_formation_code)
          params.set('cohorte_modalite', String(values.modalite_formation_code));
        if (values.partenaire_accompagnement)
          params.set('cohorte_partenaire', String(values.partenaire_accompagnement));
        setSucces({
          id: result.id,
          prenom: values.prenom,
          nom: values.nom,
          queryCohorte: params.toString(),
        });
        toast.success('Bénéficiaire enregistré');
      } else if (result.status === 'doublon') {
        setDoublon(result.ficheExistante);
        toast.error('Un bénéficiaire identique existe déjà');
      } else if (result.status === 'erreur_validation') {
        toast.error('Validation serveur : ' + result.issues.map((i) => i.message).join(', '));
      } else {
        toast.error(result.message);
      }
    });
  });

  // Écran de succès uniquement en mode création. Le mode édition fait un
  // router.push vers la fiche détail avec un toast dès le succès.
  if (mode === 'creation' && succes) {
    return (
      <div className="space-y-6">
        <RepriseApresEnregistrement
          cohorteProjet={cohorte.projet}
          cohortePays={cohorte.pays}
          cohorteDomaine={cohorte.domaine}
          cohorteAnnee={cohorte.annee}
          nomenclatures={nomenclatures}
        />
        <EcranSuccesCreation
          beneficiaireId={succes.id}
          prenom={succes.prenom}
          nom={succes.nom}
          queryCohorte={succes.queryCohorte}
        />
      </div>
    );
  }

  const trancheAge = calculerTrancheAge(
    typeof dateNaissance === 'string' || dateNaissance instanceof Date ? dateNaissance : null,
  );

  return (
    <div className="space-y-6">
      {mode === 'creation' && (
        <RepriseApresEnregistrement
          cohorteProjet={cohorte.projet}
          cohortePays={cohorte.pays}
          cohorteDomaine={cohorte.domaine}
          cohorteAnnee={cohorte.annee}
          nomenclatures={nomenclatures}
        />
      )}

      {doublon && <DialogueDoublon ficheExistante={doublon} onClose={() => setDoublon(null)} />}

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* ===== Section 1 : Identité ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Identité</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom *</FormLabel>
                    <FormControl>
                      <Input autoComplete="given-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input autoComplete="family-name" {...field} />
                    </FormControl>
                    <FormDescription>
                      Normalisé en majuscules à l&apos;enregistrement.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sexe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexe *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={
                            field.value
                              ? SEXE_LIBELLES[field.value as keyof typeof SEXE_LIBELLES]
                              : undefined
                          }
                        >
                          <SelectValue>
                            {afficherLibelle(SEXE_LIBELLES, 'Sélectionner')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SEXE_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SEXE_LIBELLES[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date_naissance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de naissance</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : ((field.value as string | undefined) ?? '')
                        }
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>Tranche d&apos;âge : {trancheAge}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ===== Section 2 : Rattachement ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Rattachement</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="projet_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projet *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={field.value ? projetsLibelles[field.value] : undefined}
                        >
                          <SelectValue>
                            {afficherLibelle(projetsLibelles, 'Sélectionner un projet')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projetsOptions.map((opt) => (
                          <SelectItem key={opt.code} value={opt.code}>
                            {opt.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pays_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger title={field.value ? paysLibelles[field.value] : undefined}>
                          <SelectValue>
                            {afficherLibelle(paysLibelles, 'Sélectionner un pays')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paysOptions.map((opt) => (
                          <SelectItem key={opt.code} value={opt.code}>
                            {opt.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partenaire_accompagnement"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Partenaire d&apos;accompagnement</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ===== Section 3 : Formation ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Formation</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="domaine_formation_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domaine de formation *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={field.value ? domainesLibelles[field.value] : undefined}
                        >
                          <SelectValue>
                            {afficherLibelle(domainesLibelles, 'Sélectionner un domaine')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {domainesOptions.map((opt) => (
                          <SelectItem key={opt.code} value={opt.code}>
                            {opt.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="intitule_formation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intitulé précis de la formation</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="modalite_formation_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modalité</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={(field.value as string | undefined) ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={
                            field.value
                              ? MODALITE_FORMATION_LIBELLES[
                                  field.value as keyof typeof MODALITE_FORMATION_LIBELLES
                                ]
                              : undefined
                          }
                        >
                          <SelectValue>
                            {afficherLibelle(MODALITE_FORMATION_LIBELLES, 'Sélectionner')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MODALITES_FORMATION_CODES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {MODALITE_FORMATION_LIBELLES[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="annee_formation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Année de formation *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2020}
                        max={new Date().getFullYear() + 1}
                        {...field}
                        value={(field.value as number | string | undefined) ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date_debut_formation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de début</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : ((field.value as string | undefined) ?? '')
                        }
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date_fin_formation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : ((field.value as string | undefined) ?? '')
                        }
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="statut_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? 'INSCRIT')}
                      value={field.value ?? 'INSCRIT'}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={
                            field.value
                              ? STATUT_BENEFICIAIRE_LIBELLES[
                                  field.value as keyof typeof STATUT_BENEFICIAIRE_LIBELLES
                                ]
                              : undefined
                          }
                        >
                          <SelectValue>
                            {afficherLibelle(STATUT_BENEFICIAIRE_LIBELLES, 'Sélectionner')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUTS_BENEFICIAIRE_CODES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUT_BENEFICIAIRE_LIBELLES[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fonction_actuelle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fonction / Statut actuel</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {warningQualite && (
                <div className="sm:col-span-2">
                  <WarningQualite message={warningQualite} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== Section 4 : RGPD & Contacts ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. RGPD et contacts</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="consentement_recueilli"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Consentement recueilli *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === 'true')}
                      value={field.value ? 'true' : 'false'}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={CONSENTEMENT_LIBELLES[field.value ? 'true' : 'false']}
                        >
                          <SelectValue>
                            {afficherLibelle(CONSENTEMENT_LIBELLES, 'Sélectionner')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Oui — consentement recueilli</SelectItem>
                        <SelectItem value="false">Non — pas de consentement</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Sans consentement, les coordonnées téléphone et courriel ne pourront pas être
                      conservées.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consentement_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date du consentement</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        disabled={!consentement}
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : ((field.value as string | undefined) ?? '')
                        }
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="localite_residence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localité de résidence</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Téléphone (avec indicatif international)</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        inputMode="tel"
                        disabled={!consentement}
                        placeholder="+22676123456"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    {Boolean(consentement) && (
                      <PickerIndicatifPays
                        valeur={typeof telephone === 'string' ? telephone : ''}
                        onChange={(nouvelle) => form.setValue('telephone', nouvelle)}
                      />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="courriel"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Courriel</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        disabled={!consentement}
                        placeholder="prenom.nom@example.org"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ===== Section 5 : Notes ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">5. Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="commentaire"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commentaire libre</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" asChild>
              <a href="/beneficiaires">Annuler</a>
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? 'Enregistrement…'
                : mode === 'edition'
                  ? 'Enregistrer les modifications'
                  : 'Enregistrer le bénéficiaire'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
