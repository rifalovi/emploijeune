/**
 * Schémas Zod des indicateurs d'enquête (Étape 6b).
 *
 * Architecture : 1 schéma Zod par indicateur calculé. Le `donnees` JSONB
 * d'une ligne `reponses_enquetes` est validé par le schéma correspondant
 * à `indicateur_code`.
 *
 * Une soumission complète d'un questionnaire (A ou B) est validée par
 * les schémas de soumission qui agrègent tous les indicateurs cibles.
 *
 * Pattern de validation conditionnelle :
 *   - Les champs « affichage conditionnel » sont marqués `.optional()`.
 *   - Les `superRefine` cross-field appliquent les règles métier
 *     (« Si Q403 = oui alors Q404 obligatoire » etc.).
 */

import { z } from 'zod';
import {
  Q_A203_TYPE_FORMATION_VALUES,
  Q_A205_DUREE_FORMATION_VALUES,
  Q_A206_ACHEVEMENT_VALUES,
  ECHELLE_SATISFACTION_VALUES,
  ECHELLE_COMPETENCE_VALUES,
  Q_A401_SITUATION_AVANT_VALUES,
  Q_A405_NATURE_ACTIVITE_VALUES,
  Q_A406_DUREE_ACTIVITE_VALUES,
  Q_A408_EVOLUTION_REVENU_VALUES,
  Q_A409_PROPORTION_AUGMENTATION_VALUES,
  Q_B211_TYPE_EMPLOI_VALUES,
  VAGUES_ENQUETE_VALUES,
  CANAUX_COLLECTE_VALUES,
} from './nomenclatures';

// =============================================================================
// Helpers réutilisables
// =============================================================================

const anneeCourante = new Date().getFullYear();

const optionalString = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined) return undefined;
      const t = v.trim();
      return t === '' ? undefined : t;
    })
    .pipe(z.string().max(max).optional());

const optionalAnneeRecente = z
  .union([z.coerce.number().int(), z.literal(''), z.null(), z.undefined()])
  .transform((v) => (v === '' || v === null || v === undefined ? undefined : (v as number)))
  .pipe(
    z
      .number()
      .int()
      .min(1980)
      .max(anneeCourante + 1)
      .optional(),
  );

const entierPositifOptionnel = (max: number) =>
  z
    .union([z.coerce.number().int().nonnegative(), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null || v === undefined ? undefined : (v as number)))
    .pipe(z.number().int().nonnegative().max(max).optional());

const montantOptionnel = z
  .union([z.coerce.number().nonnegative(), z.literal(''), z.null(), z.undefined()])
  .transform((v) => (v === '' || v === null || v === undefined ? undefined : (v as number)))
  .pipe(z.number().nonnegative().max(1_000_000_000_000).optional());

// =============================================================================
// QUESTIONNAIRE A — Schémas par indicateur
// =============================================================================

/**
 * Indicateur A2 — Taux d'achèvement de la formation.
 * Source : Q A201, A202, A203, A204, A205, A206, A207.
 */
export const a2Schema = z
  .object({
    a_participe: z.boolean(), // Q A201
    nb_formations: entierPositifOptionnel(50), // Q A202 (si participé)
    type_formation: z.enum([...Q_A203_TYPE_FORMATION_VALUES] as [string, ...string[]]).optional(),
    type_formation_autre: optionalString(200), // Q A204 (si AUTRE)
    duree_formation: z.enum([...Q_A205_DUREE_FORMATION_VALUES] as [string, ...string[]]).optional(),
    achevement: z.enum([...Q_A206_ACHEVEMENT_VALUES] as [string, ...string[]]).optional(),
    raison_non_achevement: optionalString(500), // Q A207 (si != ACHEVEE_100)
  })
  .superRefine((data, ctx) => {
    if (data.a_participe) {
      if (!data.type_formation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['type_formation'],
          message: 'Type de formation obligatoire si vous avez participé à une formation',
        });
      }
      if (!data.duree_formation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['duree_formation'],
          message: 'Durée de la formation obligatoire',
        });
      }
      if (!data.achevement) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['achevement'],
          message: 'Niveau d’achèvement obligatoire',
        });
      }
    }
    if (data.type_formation === 'AUTRE' && !data.type_formation_autre) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type_formation_autre'],
        message: 'Précisez le type de formation lorsque vous choisissez « Autre »',
      });
    }
  });

/** Indicateur A3 — Taux de certification. Source : Q A208. */
export const a3Schema = z.object({
  certifie: z.boolean(), // Q A208 (0/1)
});

/** Indicateur A4 — Gain de compétences. Source : Q A301, A302, A303. */
export const a4Schema = z
  .object({
    niveau_avant: z.enum([...ECHELLE_COMPETENCE_VALUES] as [string, ...string[]]),
    niveau_apres: z.enum([...ECHELLE_COMPETENCE_VALUES] as [string, ...string[]]),
    competences_acquises: optionalString(2000),
  })
  .superRefine((data, ctx) => {
    // Règle métier : on n'oblige pas progression mais on alerte si régression
    // (cas suspect — incohérence terrain à signaler à l'enquêteur).
    const ordre: ReadonlyArray<string> = ECHELLE_COMPETENCE_VALUES;
    const idxAvant = ordre.indexOf(data.niveau_avant);
    const idxApres = ordre.indexOf(data.niveau_apres);
    if (idxApres < idxAvant) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['niveau_apres'],
        message:
          'Régression de niveau improbable post-formation — vérifiez la saisie ou ajoutez une note dans les compétences acquises',
      });
    }
  });

/**
 * Indicateur A5 — Insertion professionnelle.
 * Source : Q A401, A402, A403, A404, A405, A406, A408, A409, A410, A411, A412.
 * (Q A407 est traitée séparément par f1Schema.)
 */
export const a5Schema = z
  .object({
    situation_avant: z.enum([...Q_A401_SITUATION_AVANT_VALUES] as [string, ...string[]]),
    situation_avant_autre: optionalString(200), // Q A402
    a_accede: z.boolean(), // Q A403
    annee_acces: optionalAnneeRecente, // Q A404
    nature_activite: z.enum([...Q_A405_NATURE_ACTIVITE_VALUES] as [string, ...string[]]).optional(),
    duree_activite: z.enum([...Q_A406_DUREE_ACTIVITE_VALUES] as [string, ...string[]]).optional(),
    evolution_revenu: z
      .enum([...Q_A408_EVOLUTION_REVENU_VALUES] as [string, ...string[]])
      .optional(),
    proportion_augmentation: z
      .enum([...Q_A409_PROPORTION_AUGMENTATION_VALUES] as [string, ...string[]])
      .optional(),
    effets_constates: optionalString(2000), // Q A410
    observations: optionalString(2000), // Q A411
    temoignage: optionalString(2000), // Q A412
  })
  .superRefine((data, ctx) => {
    if (data.situation_avant === 'AUTRE' && !data.situation_avant_autre) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['situation_avant_autre'],
        message: 'Précisez votre situation lorsque vous choisissez « Autre »',
      });
    }
    if (data.a_accede) {
      if (!data.annee_acces) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['annee_acces'],
          message: 'Année d’accès obligatoire',
        });
      }
      if (!data.nature_activite) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nature_activite'],
          message: 'Nature de l’activité obligatoire',
        });
      }
      if (!data.duree_activite) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['duree_activite'],
          message: 'Durée de l’activité obligatoire',
        });
      }
    }
    if (data.evolution_revenu === 'AUGMENTE' && !data.proportion_augmentation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['proportion_augmentation'],
        message: 'Précisez la proportion d’augmentation du revenu',
      });
    }
  });

/** Indicateur F1 — Apport du français à l'employabilité. Source : Q A407. */
export const f1Schema = z.object({
  francais_facilite_emploi: z.boolean(),
});

/**
 * Indicateur C5 — Satisfaction / utilité (dérivé).
 * Source A : Q A209 + A210. Source B : Q B304.
 */
export const c5Schema = z
  .object({
    satisfaction: z.enum([...ECHELLE_SATISFACTION_VALUES] as [string, ...string[]]),
    raison_insatisfaction: optionalString(2000),
    /** 'A' ou 'B' — utilisé en aval pour traçabilité de la dérivation. */
    source_questionnaire: z.enum(['A', 'B']),
  })
  .superRefine((data, ctx) => {
    if (data.satisfaction === 'PAS_DU_TOUT' && !data.raison_insatisfaction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['raison_insatisfaction'],
        message: 'Précisez la raison de votre insatisfaction',
      });
    }
  });

// =============================================================================
// QUESTIONNAIRE B — Schémas par indicateur
// =============================================================================

/**
 * Indicateur B2 — Taux de survie de la structure.
 * Source : Q B201, B202, B203, B204, B205, B206, B207.
 */
export const b2Schema = z
  .object({
    a_activite_economique: z.boolean(), // Q B201
    annee_creation_activite: optionalAnneeRecente, // Q B202
    oif_a_permis: z.boolean().optional(), // Q B203 (si activité)
    toujours_active: z.boolean().optional(), // Q B204
    ca_annuel: montantOptionnel, // Q B205 (si toujours active)
    annee_arret: optionalAnneeRecente, // Q B206 (si arrêtée)
    raison_arret: optionalString(2000), // Q B207
  })
  .superRefine((data, ctx) => {
    if (data.a_activite_economique) {
      if (!data.annee_creation_activite) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['annee_creation_activite'],
          message: 'Année de création de l’activité obligatoire',
        });
      }
      if (data.oif_a_permis === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['oif_a_permis'],
          message: 'Indiquez si l’appui OIF a permis la création/renforcement',
        });
      }
      if (data.toujours_active === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['toujours_active'],
          message: 'Indiquez si l’activité est toujours active',
        });
      }
      if (data.toujours_active === false && !data.annee_arret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['annee_arret'],
          message: 'Année d’arrêt obligatoire si l’activité n’est plus active',
        });
      }
    }
    if (
      data.annee_creation_activite &&
      data.annee_arret &&
      data.annee_arret < data.annee_creation_activite
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['annee_arret'],
        message: 'L’année d’arrêt doit être postérieure à l’année de création',
      });
    }
  });

/**
 * Indicateur B3 — Emplois créés ou maintenus.
 * Source : Q B208, B209, B210, B211, B212, B213.
 */
export const b3Schema = z
  .object({
    remuneres_avant: entierPositifOptionnel(10_000), // Q B208
    maintenus_apres: entierPositifOptionnel(10_000), // Q B209
    nouveaux_apres: entierPositifOptionnel(10_000), // Q B210
    type_emploi: z.enum([...Q_B211_TYPE_EMPLOI_VALUES] as [string, ...string[]]).optional(),
    jeunes_remuneres: entierPositifOptionnel(10_000), // Q B212 (18-34 ans)
    femmes_remunerees: entierPositifOptionnel(10_000), // Q B213
  })
  .superRefine((data, ctx) => {
    // Cohérence : nb jeunes + femmes ne devrait pas excéder total rémunérés
    // (mais femmes peuvent recouper jeunes — on ne vérifie que l'extrême).
    const totalRemuneres = (data.maintenus_apres ?? 0) + (data.nouveaux_apres ?? 0);
    if ((data.jeunes_remuneres ?? 0) > totalRemuneres) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jeunes_remuneres'],
        message:
          'Le nombre de jeunes ne peut excéder le total des emplois rémunérés (maintenus + nouveaux)',
      });
    }
    if ((data.femmes_remunerees ?? 0) > totalRemuneres) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['femmes_remunerees'],
        message:
          'Le nombre de femmes ne peut excéder le total des emplois rémunérés (maintenus + nouveaux)',
      });
    }
  });

/** Indicateur B4 — Emplois indirects estimés. Source : Q B301, B302. */
export const b4Schema = z
  .object({
    a_genere_indirects: z.boolean(), // Q B301
    nombre_indirects: entierPositifOptionnel(100_000), // Q B302
  })
  .superRefine((data, ctx) => {
    if (data.a_genere_indirects && data.nombre_indirects === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nombre_indirects'],
        message: 'Estimation du nombre d’emplois indirects obligatoire',
      });
    }
  });

// =============================================================================
// Schémas de soumission complète (questionnaire entier)
// =============================================================================

/** Champs métadonnées partagés entre toutes les soumissions. */
const baseSoumission = z.object({
  cible_id: z.string().uuid('ID cible invalide'),
  vague_enquete: z.enum([...VAGUES_ENQUETE_VALUES] as [string, ...string[]]).default('ponctuelle'),
  canal_collecte: z
    .enum([...CANAUX_COLLECTE_VALUES] as [string, ...string[]])
    .default('formulaire_web'),
  date_collecte: z.coerce.date().default(() => new Date()),
  consentement_repondant: z.literal(true, {
    message: 'Le consentement du répondant (Q101) est obligatoire',
  }),
  observations_libres: optionalString(2000), // Q A411 / B305
  temoignage: optionalString(2000), // Q A412 / B306
  effets_impacts: optionalString(2000), // Q A410 / B303
});

/**
 * Soumission Questionnaire A : agrège A2/A3/A4/A5/F1/C5 + métadonnées
 * (cible_id = bénéficiaire UUID).
 */
export const soumissionQuestionnaireASchema = baseSoumission.extend({
  questionnaire: z.literal('A'),
  a2: a2Schema,
  a3: a3Schema,
  a4: a4Schema,
  a5: a5Schema,
  f1: f1Schema,
  c5: c5Schema,
});

/**
 * Soumission Questionnaire B : agrège B2/B3/B4/C5 + métadonnées
 * (cible_id = structure UUID).
 */
export const soumissionQuestionnaireBSchema = baseSoumission.extend({
  questionnaire: z.literal('B'),
  b2: b2Schema,
  b3: b3Schema,
  b4: b4Schema,
  c5: c5Schema,
});

export type SoumissionQuestionnaireA = z.input<typeof soumissionQuestionnaireASchema>;
export type SoumissionQuestionnaireAOutput = z.output<typeof soumissionQuestionnaireASchema>;
export type SoumissionQuestionnaireB = z.input<typeof soumissionQuestionnaireBSchema>;
export type SoumissionQuestionnaireBOutput = z.output<typeof soumissionQuestionnaireBSchema>;

// =============================================================================
// Filtres de la liste enquêtes (utilisés par /enquetes en 6c)
// =============================================================================

const enumOuTous = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal('tous'), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null || v === 'tous' ? undefined : v))
    .optional();

export const enqueteFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? undefined : v))
    .optional(),

  questionnaire: z
    .union([z.enum(['A', 'B']), z.literal('tous'), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null || v === 'tous' ? undefined : v))
    .optional(),

  vague_enquete: enumOuTous(VAGUES_ENQUETE_VALUES),
  canal_collecte: enumOuTous(CANAUX_COLLECTE_VALUES),

  /** Filtre par projet (via la cible bénéficiaire / structure). */
  projet_code: z
    .string()
    .regex(/^PROJ_A[0-9]{2}[a-z]?$/)
    .or(z.literal('tous'))
    .optional()
    .transform((v) => (v === 'tous' || v === '' ? undefined : v)),

  /** Filtre par cible (bénéficiaire ou structure spécifique). */
  cible_id: z.string().uuid().optional(),

  /** Période de collecte. */
  date_debut: z.coerce.date().optional(),
  date_fin: z.coerce.date().optional(),

  /** Filtre « uniquement mes saisies ». */
  mien: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),

  page: z.coerce.number().int().min(1).default(1),
});

export type EnqueteFilters = z.output<typeof enqueteFiltersSchema>;
