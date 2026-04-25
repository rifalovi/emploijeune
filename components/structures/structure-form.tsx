'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { structureInsertSchema, type StructureInsertInput } from '@/lib/schemas/structure';
import {
  SEXE_VALUES,
  SEXE_LIBELLES,
  TYPES_STRUCTURE_CODES,
  TYPE_STRUCTURE_LIBELLES,
  SECTEURS_ACTIVITE_CODES,
  SECTEUR_ACTIVITE_LIBELLES,
  NATURES_APPUI_CODES,
  NATURE_APPUI_LIBELLES,
  STATUTS_STRUCTURE_VALUES,
  STATUT_STRUCTURE_LIBELLES,
  DEVISES_CODES,
  DEVISE_LIBELLES,
} from '@/lib/schemas/nomenclatures';
import type {
  Sexe,
  TypeStructureCode,
  SecteurActiviteCode,
  NatureAppuiCode,
  StatutStructure,
  DeviseCode,
} from '@/lib/schemas/nomenclatures';
import { creerStructure, modifierStructure } from '@/lib/structures/mutations';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
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

import { RepriseApresEnregistrementStructure } from './reprise-apres-enregistrement-structure';
import { DialogueDoublonStructure } from './dialogue-doublon-structure';
import { EcranSuccesCreationStructure } from './ecran-succes-creation-structure';

/**
 * Mapping booléen→libellé pour le Select « Consentement RGPD ».
 */
const CONSENTEMENT_LIBELLES: Record<'true' | 'false', string> = {
  true: 'Oui — consentement recueilli',
  false: 'Non — pas de consentement',
};

/**
 * Helper d'affichage des libellés Select (Base-UI 1.3+ affiche la valeur
 * brute par défaut). Renvoie une fonction de rendu pour `<SelectValue>`.
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
 * Formulaire création / édition d'une structure (B1) — organisation
 * progressive Option B (4 sections essentielles + 3 sections détails
 * pliables).
 *
 * Comportements clés :
 *   - Validation Zod via react-hook-form (`structureInsertSchema`)
 *   - Contacts (téléphone, courriel) désactivés tant que le consentement
 *     n'est pas coché → UX RGPD
 *   - Détection doublon bloquante côté serveur (Q3 Étape 5) avec lien
 *     vers la fiche existante
 *   - Saisie à la chaîne (Q1=B) : bandeau de rappel si URL params
 *     cohorte_*, écran de succès avec 3 CTA après enregistrement
 *   - Mode `edition` : redirige vers `/structures/[id]` après succès
 */

type FormValues = StructureInsertInput;

type DoublonState = {
  id: string;
  nom_structure: string;
  pays_code: string;
  projet_code: string;
  similarity_score: number;
};

type SuccesState = {
  id: string;
  nom_structure: string;
  queryCohorte: string;
};

export type StructureFormInitialValues = Partial<FormValues>;

export type StructureFormProps = {
  nomenclatures: Nomenclatures;
  projetsOptions: Array<{ code: string; libelle: string }>;
  paysOptions: Array<{ code: string; libelle: string }>;
  mode: 'creation' | 'edition';
  /** Valeurs pré-remplies pour le mode saisie à la chaîne (création). */
  cohorte?: {
    projet?: string;
    pays?: string;
    secteur_activite?: string;
    nature_appui?: string;
    devise?: string;
    annee?: number;
  };
  /** Valeurs initiales pour l'édition. Obligatoire si mode='edition'. */
  initialValues?: StructureFormInitialValues;
  /** ID de la fiche à éditer. Obligatoire si mode='edition'. */
  structureId?: string;
};

export function StructureForm({
  nomenclatures,
  projetsOptions,
  paysOptions,
  mode,
  cohorte = {},
  initialValues,
  structureId,
}: StructureFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [doublon, setDoublon] = useState<DoublonState | null>(null);
  const [succes, setSucces] = useState<SuccesState | null>(null);

  // NOTE: cast `as any` pour zodResolver v5 + Zod v4 transforms (cf. A1).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolver = zodResolver(structureInsertSchema) as any;
  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      // Section 1 : Identité
      nom_structure: initialValues?.nom_structure ?? '',
      type_structure_code: initialValues?.type_structure_code ?? undefined,
      secteur_activite_code:
        initialValues?.secteur_activite_code ?? cohorte.secteur_activite ?? undefined,
      secteur_precis: initialValues?.secteur_precis ?? '',
      intitule_initiative: initialValues?.intitule_initiative ?? '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      date_creation: (initialValues?.date_creation as any) ?? undefined,
      statut_creation: initialValues?.statut_creation ?? 'creation',

      // Section 2 : Rattachement
      projet_code: initialValues?.projet_code ?? cohorte.projet ?? undefined,
      pays_code: initialValues?.pays_code ?? cohorte.pays ?? undefined,
      organisation_id: initialValues?.organisation_id ?? undefined,

      // Section 3 : Porteur
      porteur_prenom: initialValues?.porteur_prenom ?? '',
      porteur_nom: initialValues?.porteur_nom ?? '',
      porteur_sexe: initialValues?.porteur_sexe ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      porteur_date_naissance: (initialValues?.porteur_date_naissance as any) ?? undefined,
      fonction_porteur: initialValues?.fonction_porteur ?? '',

      // Section 4 : Appui
      annee_appui: (initialValues?.annee_appui ??
        cohorte.annee ??
        new Date().getFullYear()) as unknown as FormValues['annee_appui'],
      nature_appui_code: initialValues?.nature_appui_code ?? cohorte.nature_appui ?? undefined,
      montant_appui:
        (initialValues?.montant_appui as unknown as FormValues['montant_appui']) ?? undefined,
      devise_code: initialValues?.devise_code ?? cohorte.devise ?? undefined,

      // Section 5 : RGPD & contacts
      consentement_recueilli: initialValues?.consentement_recueilli ?? false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      consentement_date: (initialValues?.consentement_date as any) ?? undefined,
      telephone_porteur: initialValues?.telephone_porteur ?? '',
      courriel_porteur: initialValues?.courriel_porteur ?? '',
      localite: initialValues?.localite ?? '',
      adresse: initialValues?.adresse ?? '',
      ville: initialValues?.ville ?? '',
      latitude: (initialValues?.latitude as unknown as FormValues['latitude']) ?? undefined,
      longitude: (initialValues?.longitude as unknown as FormValues['longitude']) ?? undefined,

      // Section 7 : Indicateurs B
      chiffre_affaires:
        (initialValues?.chiffre_affaires as unknown as FormValues['chiffre_affaires']) ?? undefined,
      employes_permanents:
        (initialValues?.employes_permanents as unknown as FormValues['employes_permanents']) ??
        undefined,
      employes_temporaires:
        (initialValues?.employes_temporaires as unknown as FormValues['employes_temporaires']) ??
        undefined,
      emplois_crees:
        (initialValues?.emplois_crees as unknown as FormValues['emplois_crees']) ?? undefined,

      commentaire: initialValues?.commentaire ?? '',
    } as unknown as FormValues,
  });

  const consentement = form.watch('consentement_recueilli');

  // Maps code→libellé dérivés des options serveur (pour les SelectValue).
  const projetsLibelles = Object.fromEntries(projetsOptions.map((o) => [o.code, o.libelle]));
  const paysLibelles = Object.fromEntries(paysOptions.map((o) => [o.code, o.libelle]));

  const onSubmit = form.handleSubmit(async (values) => {
    setDoublon(null);
    startTransition(async () => {
      if (mode === 'edition') {
        if (!structureId) {
          toast.error('Impossible d’identifier la fiche à modifier');
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await modifierStructure({ ...(values as any), id: structureId });
        if (result.status === 'succes') {
          toast.success('Modifications enregistrées');
          router.push(`/structures/${structureId}`);
        } else if (result.status === 'doublon') {
          setDoublon(result.ficheExistante);
          toast.error('Une autre structure existe déjà avec ce nom');
        } else if (result.status === 'erreur_validation') {
          toast.error('Validation serveur : ' + result.issues.map((i) => i.message).join(', '));
        } else {
          toast.error(result.message);
        }
        return;
      }

      // Mode création
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await creerStructure(values as any);
      if (result.status === 'succes') {
        const params = new URLSearchParams();
        if (values.projet_code) params.set('cohorte_projet', String(values.projet_code));
        if (values.pays_code) params.set('cohorte_pays', String(values.pays_code));
        if (values.secteur_activite_code)
          params.set('cohorte_secteur_activite', String(values.secteur_activite_code));
        if (values.nature_appui_code)
          params.set('cohorte_nature_appui', String(values.nature_appui_code));
        if (values.devise_code) params.set('cohorte_devise', String(values.devise_code));
        if (values.annee_appui) params.set('cohorte_annee', String(values.annee_appui));
        setSucces({
          id: result.id,
          nom_structure: values.nom_structure,
          queryCohorte: params.toString(),
        });
        toast.success('Structure enregistrée');
      } else if (result.status === 'doublon') {
        setDoublon(result.ficheExistante);
        toast.error('Une structure similaire existe déjà');
      } else if (result.status === 'erreur_validation') {
        toast.error('Validation serveur : ' + result.issues.map((i) => i.message).join(', '));
      } else {
        toast.error(result.message);
      }
    });
  });

  // Écran de succès uniquement en mode création.
  if (mode === 'creation' && succes) {
    return (
      <div className="space-y-6">
        <RepriseApresEnregistrementStructure
          cohorteProjet={cohorte.projet}
          cohortePays={cohorte.pays}
          cohorteSecteurActivite={cohorte.secteur_activite}
          cohorteNatureAppui={cohorte.nature_appui}
          cohorteDevise={cohorte.devise}
          cohorteAnnee={cohorte.annee}
          nomenclatures={nomenclatures}
        />
        <EcranSuccesCreationStructure
          structureId={succes.id}
          nomStructure={succes.nom_structure}
          queryCohorte={succes.queryCohorte}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mode === 'creation' && (
        <RepriseApresEnregistrementStructure
          cohorteProjet={cohorte.projet}
          cohortePays={cohorte.pays}
          cohorteSecteurActivite={cohorte.secteur_activite}
          cohorteNatureAppui={cohorte.nature_appui}
          cohorteDevise={cohorte.devise}
          cohorteAnnee={cohorte.annee}
          nomenclatures={nomenclatures}
        />
      )}

      {doublon && (
        <DialogueDoublonStructure ficheExistante={doublon} onClose={() => setDoublon(null)} />
      )}

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* ============================================================== */}
          {/* SECTIONS ESSENTIELLES (visibles par défaut)                    */}
          {/* ============================================================== */}

          {/* === Section 1 : Identité structure === */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Identité structure</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="nom_structure"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nom de la structure *</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type_structure_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de structure *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={
                            field.value
                              ? TYPE_STRUCTURE_LIBELLES[field.value as TypeStructureCode]
                              : undefined
                          }
                        >
                          <SelectValue>
                            {afficherLibelle(TYPE_STRUCTURE_LIBELLES, 'Sélectionner')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPES_STRUCTURE_CODES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {TYPE_STRUCTURE_LIBELLES[c]}
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
                name="secteur_activite_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secteur d&apos;activité *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={
                            field.value
                              ? SECTEUR_ACTIVITE_LIBELLES[field.value as SecteurActiviteCode]
                              : undefined
                          }
                        >
                          <SelectValue>
                            {afficherLibelle(SECTEUR_ACTIVITE_LIBELLES, 'Sélectionner')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SECTEURS_ACTIVITE_CODES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {SECTEUR_ACTIVITE_LIBELLES[c]}
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
            </CardContent>
          </Card>

          {/* === Section 2 : Rattachement projet === */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Rattachement projet</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="projet_code"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
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
                name="annee_appui"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Année de l&apos;appui *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2000}
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
                name="statut_creation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? 'creation')}
                      value={field.value ?? 'creation'}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={
                            field.value
                              ? STATUT_STRUCTURE_LIBELLES[field.value as StatutStructure]
                              : undefined
                          }
                        >
                          <SelectValue>
                            {afficherLibelle(STATUT_STRUCTURE_LIBELLES, 'Sélectionner')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUTS_STRUCTURE_VALUES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {STATUT_STRUCTURE_LIBELLES[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Création (nouvelle), renforcement (existante), ou relance.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="porteur_nom"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Responsable / porteur *</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="Nom du porteur" />
                    </FormControl>
                    <FormDescription>
                      Nom de la personne référente (porteur, gérant, président·e…). Détails
                      complémentaires dans la section dépliable plus bas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="porteur_sexe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexe du porteur *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={field.value ? SEXE_LIBELLES[field.value as Sexe] : undefined}
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
            </CardContent>
          </Card>

          {/* === Section 3 : Initiative & appui === */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Initiative et appui</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="intitule_initiative"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Intitulé de l&apos;initiative</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nature_appui_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nature de l&apos;appui *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={
                            field.value
                              ? NATURE_APPUI_LIBELLES[field.value as NatureAppuiCode]
                              : undefined
                          }
                        >
                          <SelectValue>
                            {afficherLibelle(NATURE_APPUI_LIBELLES, 'Sélectionner')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NATURES_APPUI_CODES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {NATURE_APPUI_LIBELLES[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Si « Subvention », un montant strictement positif sera obligatoire.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="montant_appui"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant de l&apos;appui</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...field}
                        value={(field.value as number | string | undefined) ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder="0.00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="devise_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Devise</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      value={(field.value as string | undefined) ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger
                          title={
                            field.value ? DEVISE_LIBELLES[field.value as DeviseCode] : undefined
                          }
                        >
                          <SelectValue>
                            {afficherLibelle(DEVISE_LIBELLES, 'Sélectionner')}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEVISES_CODES.map((d) => (
                          <SelectItem key={d} value={d}>
                            {DEVISE_LIBELLES[d]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Obligatoire si un montant est saisi.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* === Section 4 : Contacts principaux === */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Contacts principaux</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="consentement_recueilli"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Consentement RGPD recueilli *</FormLabel>
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
                name="telephone_porteur"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone du responsable</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="courriel_porteur"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Courriel du responsable</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        disabled={!consentement}
                        placeholder="contact@structure.org"
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

          {/* ============================================================== */}
          {/* SECTIONS DÉTAILS PLIABLES (3 sections via <details>)          */}
          {/* ============================================================== */}

          <CollapsibleSection
            title="Afficher les détails supplémentaires"
            hint="Porteur · Géolocalisation · Indicateurs"
          >
            {/* === Section 5 : Détails du porteur === */}
            <div>
              <h3 className="mb-3 text-sm font-semibold tracking-tight">
                5. Détails du porteur (optionnels)
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="porteur_prenom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom du porteur</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="porteur_date_naissance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de naissance du porteur</FormLabel>
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
                      <FormDescription>Le porteur doit être majeur (≥ 18 ans).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fonction_porteur"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Fonction</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="Fondateur, gérant, président·e…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* === Section 6 : Géolocalisation === */}
            <div>
              <h3 className="mt-6 mb-3 text-sm font-semibold tracking-tight">
                6. Géolocalisation (optionnels)
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="adresse"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Adresse postale</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          {...field}
                          value={field.value ?? ''}
                          placeholder="Rue, numéro, quartier…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ville"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="localite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localité / commune</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude (GPS)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.000001"
                          min={-90}
                          max={90}
                          placeholder="12.6392"
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
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude (GPS)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.000001"
                          min={-180}
                          max={180}
                          placeholder="-8.0029"
                          {...field}
                          value={(field.value as number | string | undefined) ?? ''}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* === Section 7 : Indicateurs B === */}
            <div>
              <h3 className="mt-6 mb-3 text-sm font-semibold tracking-tight">
                7. Informations complémentaires (optionnels — alimentent les indicateurs B)
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="chiffre_affaires"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chiffre d&apos;affaires annuel</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          {...field}
                          value={(field.value as number | string | undefined) ?? ''}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormDescription>Dans la devise de la structure.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emplois_crees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emplois créés grâce à l&apos;appui</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="1"
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
                  name="employes_permanents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employés permanents</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="1"
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
                  name="employes_temporaires"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employés temporaires</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="1"
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
                  name="date_creation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de création de la structure</FormLabel>
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
                  name="secteur_precis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secteur précis</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="Ex. transformation de manioc"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="commentaire"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Notes / commentaire</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* ============================================================== */}
          {/* Boutons d'action                                              */}
          {/* ============================================================== */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" asChild>
              <a href="/structures">Annuler</a>
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? 'Enregistrement…'
                : mode === 'edition'
                  ? 'Enregistrer les modifications'
                  : 'Enregistrer la structure'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
