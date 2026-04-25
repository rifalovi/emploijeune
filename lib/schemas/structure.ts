/**
 * Schémas Zod pour la validation des structures (indicateur B1).
 *
 * Quatre schémas exposés :
 *   1. `structureInsertSchema` : création d'une fiche
 *   2. `structureUpdateSchema` : édition (ajoute `id` obligatoire)
 *   3. `structureFiltersSchema` : query string de la liste `/structures`
 *   4. `repriseCohorteStructureSchema` : pré-remplissage pour saisie à la chaîne
 *
 * Les 26 champs métier (cf. `public.structures`) sont validés aux mêmes
 * règles que les CHECK constraints de la migration 001 :
 *   - RGPD : contacts `telephone_porteur` / `courriel_porteur` interdits si
 *     `consentement_recueilli = false`
 *   - RGPD : `consentement_date` obligatoire si consentement recueilli, et
 *     antérieure ou égale à `date_creation` si celle-ci est saisie
 *   - Montant : obligation `montant_appui IS NOT NULL → devise_code IS NOT NULL`
 *   - Année appui : 2000..année+1
 *   - Latitude/longitude : plages géographiques (−90..90 et −180..180)
 *   - Téléphone : format international +XXX (6..20 chiffres)
 *
 * Défense en profondeur : ces règles sont vérifiées côté client (formulaire
 * RHF) ET côté serveur (Server Actions). La BDD est la source de vérité
 * ultime via les CHECK constraints et les fonctions SQL d'unicité.
 */

import { z } from 'zod';
import {
  PROJETS_CODES,
  PAYS_CODES,
  SEXE_VALUES,
  TYPES_STRUCTURE_CODES,
  SECTEURS_ACTIVITE_CODES,
  NATURES_APPUI_CODES,
  DEVISES_CODES,
  STATUTS_STRUCTURE_VALUES,
  PROGRAMMES_STRATEGIQUES_CODES,
} from './nomenclatures';

// =============================================================================
// Helpers réutilisables (alignés sur le pattern beneficiaire.ts)
// =============================================================================

const anneeCourante = new Date().getFullYear();

/** Téléphone international : commence par + puis 6 à 20 chiffres. */
const telephoneRegex = /^\+\d{6,20}$/;

/** Nom/prénom porteur : lettres accentuées, tirets, espaces, apostrophes. */
const nomPrenomRegex = /^[\p{L}\p{M}\s'’\-]+$/u;

/**
 * Nom de structure : plus permissif qu'un nom de personne — on accepte
 * chiffres, ponctuation courante, caractères spéciaux limités. Interdit
 * uniquement les chevrons (protection XSS) et les guillemets doubles.
 */
const nomStructureRegex = /^[^<>"]+$/;

const optionalDate = z
  .union([z.coerce.date(), z.literal(''), z.null(), z.undefined()])
  .transform((v) => (v instanceof Date && !isNaN(v.getTime()) ? v : undefined))
  .optional();

const optionalString = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined) return undefined;
      const t = v.trim();
      return t === '' ? undefined : t;
    })
    .pipe(z.string().max(max).optional());

/** Latitude / longitude : nombre décimal dans la plage géographique. */
const coordonneeOptionnelle = (min: number, max: number) =>
  z
    .union([z.coerce.number(), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null || v === undefined ? undefined : (v as number)))
    .pipe(z.number().min(min).max(max).optional());

// =============================================================================
// 1. baseStructureSchema — champs métier (sans contraintes cross-field)
// =============================================================================

const baseStructureSchema = z.object({
  // === Section 1 : Identité structure ===
  nom_structure: z
    .string()
    .trim()
    .min(1, 'Le nom de la structure est obligatoire')
    .max(200, 'Le nom est trop long (max 200 caractères)')
    .regex(nomStructureRegex, 'Le nom contient des caractères non autorisés'),

  type_structure_code: z.enum([...TYPES_STRUCTURE_CODES] as [string, ...string[]], {
    message: 'Type de structure invalide',
  }),

  secteur_activite_code: z.enum([...SECTEURS_ACTIVITE_CODES] as [string, ...string[]], {
    message: 'Secteur d’activité invalide',
  }),

  secteur_precis: optionalString(200),

  intitule_initiative: optionalString(300),

  date_creation: optionalDate.refine(
    (d) => !d || (d >= new Date('1900-01-01') && d <= new Date()),
    'Date de création hors plage (1900 — aujourd’hui)',
  ),

  statut_creation: z.enum([...STATUTS_STRUCTURE_VALUES] as [string, ...string[]], {
    message: 'Statut création invalide',
  }),

  // === Section 2 : Rattachement ===
  projet_code: z.enum([...PROJETS_CODES] as [string, ...string[]], {
    message: 'Code projet invalide',
  }),

  pays_code: z.enum([...PAYS_CODES] as [string, ...string[]], {
    message: 'Code pays invalide',
  }),

  organisation_id: z.string().uuid().nullable().optional(),

  // === Section 3 : Porteur ===
  porteur_prenom: optionalString(100).refine(
    (v) => !v || nomPrenomRegex.test(v),
    'Le prénom du porteur contient des caractères non autorisés',
  ),

  porteur_nom: z
    .string()
    .trim()
    .min(1, 'Le nom du porteur est obligatoire')
    .max(100, 'Le nom est trop long (max 100 caractères)')
    .regex(nomPrenomRegex, 'Le nom contient des caractères non autorisés')
    .transform((v) => v.toLocaleUpperCase('fr-FR')),

  porteur_sexe: z.enum([...SEXE_VALUES] as [string, ...string[]], {
    message: 'Sexe du porteur invalide',
  }),

  porteur_date_naissance: optionalDate.refine(
    (d) => !d || (d >= new Date('1900-01-01') && d <= new Date()),
    'Date de naissance hors plage (1900 — aujourd’hui)',
  ),

  // === Section 4 : Appui ===
  annee_appui: z.coerce
    .number({ message: 'Année d’appui invalide' })
    .int()
    .min(2000, 'Année minimum : 2000')
    .max(anneeCourante + 1, `Année maximum : ${anneeCourante + 1}`),

  nature_appui_code: z.enum([...NATURES_APPUI_CODES] as [string, ...string[]], {
    message: 'Nature d’appui invalide',
  }),

  montant_appui: z
    .union([z.coerce.number().nonnegative(), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null || v === undefined ? undefined : (v as number)))
    .pipe(z.number().nonnegative().max(1_000_000_000_000).optional()),

  devise_code: z
    .union([
      z.enum([...DEVISES_CODES] as [string, ...string[]]),
      z.literal(''),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === null ? undefined : v))
    .optional(),

  // === Section 5 : RGPD & contacts ===
  consentement_recueilli: z.coerce.boolean().default(false),
  consentement_date: optionalDate,

  telephone_porteur: optionalString(30).refine(
    (v) => !v || telephoneRegex.test(v),
    'Format attendu : +<indicatif><numéro> sans espace (ex. +22676123456)',
  ),

  courriel_porteur: z
    .union([z.string().email('Adresse courriel invalide'), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null ? undefined : v))
    .optional(),

  localite: optionalString(200),

  latitude: coordonneeOptionnelle(-90, 90),
  longitude: coordonneeOptionnelle(-180, 180),

  commentaire: optionalString(2000),
});

/**
 * Contraintes inter-champs : RGPD + dates + montant↔devise.
 * Extraite en fonction réutilisable pour insert + update.
 */
type BaseStructureShape = z.infer<typeof baseStructureSchema>;

function appliquerReglesMetierStructure(data: BaseStructureShape, ctx: z.RefinementCtx): void {
  // Règle RGPD A : consentement=true → date consentement obligatoire
  if (data.consentement_recueilli && !data.consentement_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['consentement_date'],
      message: 'Date du consentement obligatoire lorsque le consentement est recueilli',
    });
  }
  // Règle RGPD B : consentement=true → au moins un contact porteur
  if (data.consentement_recueilli && !data.telephone_porteur && !data.courriel_porteur) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['telephone_porteur'],
      message: 'Au moins un moyen de contact (téléphone ou courriel) est obligatoire',
    });
  }
  // Règle RGPD C : consentement=false → pas de contact porteur autorisé
  if (!data.consentement_recueilli && (data.telephone_porteur || data.courriel_porteur)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['consentement_recueilli'],
      message: 'Impossible de conserver des contacts sans consentement RGPD recueilli',
    });
  }
  // Règle RGPD D : date consentement ≤ date création (si les deux sont saisis)
  if (
    data.consentement_recueilli &&
    data.consentement_date &&
    data.date_creation &&
    data.consentement_date > data.date_creation
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['consentement_date'],
      message:
        'La date de consentement doit être antérieure ou égale à la date de création de la structure (exigence RGPD : le consentement précède le traitement).',
    });
  }
  // Règle Montant ↔ Devise : aligné sur `chk_structures_montant_devise`
  if (data.montant_appui !== undefined && !data.devise_code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['devise_code'],
      message: 'Une devise est obligatoire si un montant d’appui est saisi',
    });
  }
}

// =============================================================================
// 2. structureInsertSchema — création
// =============================================================================

export const structureInsertSchema = baseStructureSchema.superRefine(
  appliquerReglesMetierStructure,
);

export type StructureInsertInput = z.input<typeof structureInsertSchema>;
export type StructureInsertOutput = z.output<typeof structureInsertSchema>;

// =============================================================================
// 3. structureUpdateSchema — édition
// =============================================================================

export const structureUpdateSchema = baseStructureSchema
  .extend({ id: z.string().uuid('ID invalide') })
  .superRefine(appliquerReglesMetierStructure);

export type StructureUpdateInput = z.input<typeof structureUpdateSchema>;
export type StructureUpdateOutput = z.output<typeof structureUpdateSchema>;

// =============================================================================
// 4. structureFiltersSchema — query string de la liste
// =============================================================================

const enumOuTous = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal('tous'), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null || v === 'tous' ? undefined : v))
    .optional();

export const structureFiltersSchema = z.object({
  /** Recherche textuelle sur `nom_structure` (accent insensible côté DB). */
  q: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? undefined : v))
    .optional(),

  projet_code: enumOuTous(PROJETS_CODES),
  ps: enumOuTous(PROGRAMMES_STRATEGIQUES_CODES),
  pays_code: enumOuTous(PAYS_CODES),
  type_structure_code: enumOuTous(TYPES_STRUCTURE_CODES),
  secteur_activite_code: enumOuTous(SECTEURS_ACTIVITE_CODES),
  nature_appui_code: enumOuTous(NATURES_APPUI_CODES),
  statut_creation: enumOuTous(STATUTS_STRUCTURE_VALUES),

  annee_appui: z
    .union([
      z.coerce
        .number()
        .int()
        .min(2000)
        .max(anneeCourante + 1),
      z.literal(''),
      z.undefined(),
    ])
    .transform((v) => (v === '' || v === undefined ? undefined : (v as number)))
    .optional(),

  /** Filtre « uniquement mes saisies » pour contributeur_partenaire. */
  mien: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),

  page: z.coerce.number().int().min(1).default(1),
});

export type StructureFilters = z.output<typeof structureFiltersSchema>;

// =============================================================================
// 5. repriseCohorteStructureSchema — pré-remplissage saisie à la chaîne
// =============================================================================

export const repriseCohorteStructureSchema = z.object({
  cohorte_projet: z.enum([...PROJETS_CODES] as [string, ...string[]]).optional(),
  cohorte_pays: z.enum([...PAYS_CODES] as [string, ...string[]]).optional(),
  cohorte_secteur_activite: z
    .enum([...SECTEURS_ACTIVITE_CODES] as [string, ...string[]])
    .optional(),
  cohorte_nature_appui: z.enum([...NATURES_APPUI_CODES] as [string, ...string[]]).optional(),
  cohorte_devise: z.enum([...DEVISES_CODES] as [string, ...string[]]).optional(),
  cohorte_annee: z.coerce
    .number()
    .int()
    .min(2000)
    .max(anneeCourante + 1)
    .optional(),
});

export type RepriseCohorteStructure = z.output<typeof repriseCohorteStructureSchema>;
