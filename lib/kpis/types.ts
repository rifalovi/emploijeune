import { z } from 'zod';

const tauxSchema = z.object({
  valeur: z.number(),
  numerateur: z.number().optional(),
  denominateur: z.number().optional(),
  alerte: z.boolean().optional(),
  proxy: z.boolean().optional(),
});

export const kpiAdminScsSchema = z.object({
  role: z.literal('admin_scs'),
  comptes_en_attente: z.number(),
  taux_rgpd: tauxSchema,
  alertes_qualite: z.number(),
  imports_recents: z.object({
    total: z.number(),
    avec_erreurs: z.number(),
    alerte: z.boolean(),
  }),
});
export type KpiAdminScs = z.infer<typeof kpiAdminScsSchema>;

export const kpiEditeurProjetSchema = z.object({
  role: z.literal('editeur_projet'),
  projets_geres: z.array(z.string()),
  beneficiaires_projets: z.number(),
  taux_achevement: tauxSchema,
  cohortes_a_enqueter: z.number(),
  contacts_valides: tauxSchema,
});
export type KpiEditeurProjet = z.infer<typeof kpiEditeurProjetSchema>;

export const kpiContributeurSchema = z.object({
  role: z.literal('contributeur_partenaire'),
  beneficiaires_saisis: z.number(),
  dernier_import: z
    .object({
      id: z.string(),
      fichier_nom: z.string(),
      statut: z.string(),
      nb_lignes_a1: z.number(),
      nb_lignes_b1: z.number(),
      nb_erreurs: z.number(),
      nb_avertissements: z.number(),
      demarre_a: z.string(),
      termine_a: z.string().nullable(),
    })
    .nullable(),
  completude: tauxSchema,
  formulaires_a_remplir: z.number(),
});
export type KpiContributeur = z.infer<typeof kpiContributeurSchema>;

export const kpiLecteurSchema = z.object({
  role: z.literal('lecteur'),
  beneficiaires_visibles: z.number(),
  structures_visibles: z.number(),
  projets_couverts: z.number(),
  pays_couverts: z.number(),
  derniere_maj: z.string().nullable(),
});
export type KpiLecteur = z.infer<typeof kpiLecteurSchema>;

export const kpiErrorSchema = z.object({
  erreur: z.string(),
  statut: z.string().optional(),
});
export type KpiError = z.infer<typeof kpiErrorSchema>;

export const kpiSchema = z.union([
  kpiAdminScsSchema,
  kpiEditeurProjetSchema,
  kpiContributeurSchema,
  kpiLecteurSchema,
  kpiErrorSchema,
]);
export type KpiResult = z.infer<typeof kpiSchema>;
