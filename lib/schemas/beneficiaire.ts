/**
 * Schémas Zod pour la validation des bénéficiaires (indicateur A1).
 *
 * Trois schémas exposés :
 *   1. `beneficiaireInsertSchema` : création d'une fiche
 *   2. `beneficiaireUpdateSchema` : édition partielle d'une fiche existante
 *   3. `beneficiaireFiltersSchema` : query string de la liste `/beneficiaires`
 *
 * Tous les champs métier (22 colonnes A1) sont validés avec les mêmes règles
 * que les CHECK constraints de la migration 001 :
 *   - RGPD : contacts impossibles sans consentement, et au moins un contact si consentement
 *   - Dates formation : fin >= début
 *   - Année : 2020..année+1
 *   - Téléphone : format international +XXX
 *   - Email : RFC 5322
 *
 * La validation est appliquée côté client (formulaire react-hook-form) ET côté
 * serveur (Server Action) pour défense en profondeur.
 */

import { z } from 'zod';
import {
  PROJETS_CODES,
  PAYS_CODES,
  SEXE_VALUES,
  DOMAINES_FORMATION_CODES,
  MODALITES_FORMATION_CODES,
  STATUTS_BENEFICIAIRE_CODES,
  PROGRAMMES_STRATEGIQUES_CODES,
} from './nomenclatures';

// =============================================================================
// Helpers réutilisables
// =============================================================================

/** Année courante côté serveur à la génération de la page. */
const anneeCourante = new Date().getFullYear();

/** Téléphone international : commence par + puis 6 à 20 chiffres. */
const telephoneRegex = /^\+\d{6,20}$/;

/** Nom/prénom : lettres accentuées, tirets, espaces, apostrophes. */
const nomPrenomRegex = /^[\p{L}\p{M}\s'’\-]+$/u;

/**
 * Coerce une chaîne en Date ou renvoie undefined si vide / invalide.
 * Accepte `string` (format yyyy-mm-dd d'un input type="date"), `Date`,
 * `null`, `undefined`, chaîne vide.
 */
const optionalDate = z
  .union([z.coerce.date(), z.literal(''), z.null(), z.undefined()])
  .transform((v) => (v instanceof Date && !isNaN(v.getTime()) ? v : undefined))
  .optional();

/** Chaîne optionnelle normalisée : trim, vide => undefined. */
const optionalString = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined) return undefined;
      const t = v.trim();
      return t === '' ? undefined : t;
    })
    .pipe(z.string().max(max).optional());

// =============================================================================
// 1. beneficiaireInsertSchema — création
// =============================================================================

const baseBeneficiaireSchema = z.object({
  // === 1. Identité ===
  prenom: z
    .string()
    .trim()
    .min(1, 'Le prénom est obligatoire')
    .max(100, 'Le prénom est trop long (max 100 caractères)')
    .regex(nomPrenomRegex, 'Le prénom contient des caractères non autorisés'),

  nom: z
    .string()
    .trim()
    .min(1, 'Le nom est obligatoire')
    .max(100, 'Le nom est trop long (max 100 caractères)')
    .regex(nomPrenomRegex, 'Le nom contient des caractères non autorisés')
    .transform((v) => v.toLocaleUpperCase('fr-FR')),

  sexe: z.enum([...SEXE_VALUES] as [string, ...string[]], {
    message: 'Sexe invalide',
  }),

  date_naissance: optionalDate.refine(
    (d) => !d || (d >= new Date('1900-01-01') && d <= new Date()),
    'Date de naissance hors plage (1900 — aujourd’hui)',
  ),

  // === 2. Rattachement ===
  projet_code: z.enum([...PROJETS_CODES] as [string, ...string[]], {
    message: 'Code projet invalide',
  }),

  pays_code: z.enum([...PAYS_CODES] as [string, ...string[]], {
    message: 'Code pays invalide',
  }),

  organisation_id: z.string().uuid().nullable().optional(),

  partenaire_accompagnement: optionalString(200),

  // === 3. Formation ===
  domaine_formation_code: z.enum([...DOMAINES_FORMATION_CODES] as [string, ...string[]], {
    message: 'Domaine de formation invalide',
  }),

  intitule_formation: optionalString(300),

  modalite_formation_code: z
    .union([
      z.enum([...MODALITES_FORMATION_CODES] as [string, ...string[]]),
      z.literal(''),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === null ? undefined : v))
    .optional(),

  annee_formation: z.coerce
    .number({ message: 'Année de formation invalide' })
    .int()
    .min(2020, 'Année minimum : 2020')
    .max(anneeCourante + 1, `Année maximum : ${anneeCourante + 1}`),

  date_debut_formation: optionalDate,
  date_fin_formation: optionalDate,

  statut_code: z
    .enum([...STATUTS_BENEFICIAIRE_CODES] as [string, ...string[]], {
      message: 'Statut invalide',
    })
    .default('INSCRIT'),

  fonction_actuelle: optionalString(200),

  // === 4. RGPD & contacts ===
  consentement_recueilli: z.coerce.boolean().default(false),
  consentement_date: optionalDate,
  telephone: optionalString(30).refine(
    (v) => !v || telephoneRegex.test(v),
    'Format attendu : +<indicatif><numéro> sans espace (ex. +22676123456)',
  ),
  courriel: z
    .union([z.string().email('Adresse courriel invalide'), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null ? undefined : v))
    .optional(),
  localite_residence: optionalString(200),

  // === 5. Commentaire ===
  commentaire: optionalString(2000),
});

/**
 * Contraintes inter-champs : RGPD + dates formation.
 * Extraites en fonction réutilisable pour insert + update (évite
 * l'intersection `.and()` qui perd les defaults en Zod v4).
 */
type BaseBeneficiaireShape = z.infer<typeof baseBeneficiaireSchema>;

function appliquerReglesMetier(data: BaseBeneficiaireShape, ctx: z.RefinementCtx): void {
  // Règle RGPD A : consentement=true => date consentement obligatoire
  if (data.consentement_recueilli && !data.consentement_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['consentement_date'],
      message: 'Date du consentement obligatoire lorsque le consentement est recueilli',
    });
  }
  // Règle RGPD B : consentement=true => au moins un contact
  if (data.consentement_recueilli && !data.telephone && !data.courriel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['telephone'],
      message: 'Au moins un moyen de contact (téléphone ou courriel) est obligatoire',
    });
  }
  // Règle RGPD C : consentement=false => pas de contact autorisé
  if (!data.consentement_recueilli && (data.telephone || data.courriel)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['consentement_recueilli'],
      message: 'Impossible de conserver des contacts sans consentement RGPD recueilli',
    });
  }
  // Règle dates : fin >= début
  if (
    data.date_debut_formation &&
    data.date_fin_formation &&
    data.date_fin_formation < data.date_debut_formation
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['date_fin_formation'],
      message: 'La date de fin doit être postérieure à la date de début',
    });
  }
}

export const beneficiaireInsertSchema = baseBeneficiaireSchema.superRefine(appliquerReglesMetier);

export type BeneficiaireInsertInput = z.input<typeof beneficiaireInsertSchema>;
export type BeneficiaireInsertOutput = z.output<typeof beneficiaireInsertSchema>;

// =============================================================================
// 2. beneficiaireUpdateSchema — édition d'une fiche existante
// =============================================================================

/**
 * L'édition reprend les mêmes règles de validation que la création (superRefine
 * inclus), mais ajoute l'`id` obligatoire. On utilise `.extend()` plutôt que
 * `z.object().and()` : Zod v4 ne propage pas correctement les `.default()`
 * à travers les intersections, ce qui empêchait le `statut_code` d'être
 * défini à 'INSCRIT' par défaut.
 */
export const beneficiaireUpdateSchema = baseBeneficiaireSchema
  .extend({ id: z.string().uuid('ID invalide') })
  .superRefine(appliquerReglesMetier);

export type BeneficiaireUpdateInput = z.input<typeof beneficiaireUpdateSchema>;
export type BeneficiaireUpdateOutput = z.output<typeof beneficiaireUpdateSchema>;

// =============================================================================
// 3. beneficiaireFiltersSchema — query string de la liste
// =============================================================================

export const beneficiaireFiltersSchema = z.object({
  /** Recherche textuelle sur prenom + nom (accent insensible côté DB). */
  q: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? undefined : v))
    .optional(),

  /** Filtre par projet officiel. */
  projet_code: z
    .union([
      z.enum([...PROJETS_CODES] as [string, ...string[]]),
      z.literal('tous'),
      z.literal(''),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === null || v === 'tous' ? undefined : v))
    .optional(),

  /** Filtre par Programme Stratégique (PS1/PS2/PS3) — complément au filtre projet. */
  ps: z
    .union([
      z.enum([...PROGRAMMES_STRATEGIQUES_CODES] as [string, ...string[]]),
      z.literal('tous'),
      z.literal(''),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === null || v === 'tous' ? undefined : v))
    .optional(),

  pays_code: z
    .union([
      z.enum([...PAYS_CODES] as [string, ...string[]]),
      z.literal('tous'),
      z.literal(''),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === null || v === 'tous' ? undefined : v))
    .optional(),

  domaine_formation_code: z
    .union([
      z.enum([...DOMAINES_FORMATION_CODES] as [string, ...string[]]),
      z.literal('tous'),
      z.literal(''),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === null || v === 'tous' ? undefined : v))
    .optional(),

  annee_formation: z
    .union([
      z.coerce
        .number()
        .int()
        .min(2020)
        .max(anneeCourante + 1),
      z.literal(''),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === undefined ? undefined : (v as number)))
    .optional(),

  statut_code: z
    .union([
      z.enum([...STATUTS_BENEFICIAIRE_CODES] as [string, ...string[]]),
      z.literal('tous'),
      z.literal(''),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === null || v === 'tous' ? undefined : v))
    .optional(),

  sexe: z
    .union([
      z.enum([...SEXE_VALUES] as [string, ...string[]]),
      z.literal('tous'),
      z.literal(''),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === null || v === 'tous' ? undefined : v))
    .optional(),

  /** Filtre « uniquement mes saisies » pour contributeur_partenaire. */
  mien: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),

  /** Page 1-indexed, défaut 1. */
  page: z.coerce.number().int().min(1).default(1),
});

export type BeneficiaireFilters = z.output<typeof beneficiaireFiltersSchema>;

/**
 * Params de pré-remplissage pour la saisie à la chaîne (Q1=B).
 * Transportés via URL query string après un enregistrement réussi pour que
 * l'utilisateur puisse immédiatement saisir un autre bénéficiaire de la même
 * cohorte en conservant les valeurs communes.
 */
export const repriseCohorteSchema = z.object({
  cohorte_projet: z.enum([...PROJETS_CODES] as [string, ...string[]]).optional(),
  cohorte_pays: z.enum([...PAYS_CODES] as [string, ...string[]]).optional(),
  cohorte_domaine: z.enum([...DOMAINES_FORMATION_CODES] as [string, ...string[]]).optional(),
  cohorte_annee: z.coerce
    .number()
    .int()
    .min(2020)
    .max(anneeCourante + 1)
    .optional(),
  cohorte_modalite: z.enum([...MODALITES_FORMATION_CODES] as [string, ...string[]]).optional(),
  cohorte_partenaire: z.string().trim().max(200).optional(),
});

export type RepriseCohorte = z.output<typeof repriseCohorteSchema>;
