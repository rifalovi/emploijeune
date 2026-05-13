import { z } from 'zod';

/**
 * Schéma Zod du payload retourné par la RPC
 * `lister_indicateurs_avec_valeurs_annuelles()` — migration 20260512200001.
 *
 * Couvre les 18 indicateurs CMR. Pour chaque indicateur :
 *   - statut_calcul : 'calcule' | 'non_mesurable' | 'pas_de_donnees'
 *   - valeurs_par_annee : tableau (vide si statut ≠ 'calcule')
 *   - nb_annees_avec_donnees : utilisé pour décider de l'affichage graphique
 *   - mention : explication (uniquement si statut = 'non_mesurable')
 */

const valeurAnneeSchema = z.object({
  annee: z.number().int(),
  valeur: z.number().nullable(),
  numerateur: z.number().int().nullable().optional(),
  denominateur: z.number().int().nullable().optional(),
  femmes: z.number().int().optional(),
  hommes: z.number().int().optional(),
  creation: z.number().int().optional(),
  renforcement: z.number().int().optional(),
  nb_avec_montant: z.number().int().optional(),
  /** Origine de la valeur — 'auto' (calcul BDD), 'saisie' (saisie manuelle),
   *  'mixte' (BDD + complément saisi). */
  source: z.enum(['auto', 'saisie', 'mixte']).optional(),
  /** État de publication — uniquement renvoyé pour les saisies manuelles. */
  publie: z.boolean().optional(),
});

const indicateurSchema = z.object({
  code: z.string(),
  statut_calcul: z.enum(['calcule', 'non_mesurable', 'pas_de_donnees', 'saisie_manuelle']),
  mention: z.string().optional(),
  valeurs_par_annee: z.array(valeurAnneeSchema),
  nb_annees_avec_donnees: z.number().int(),
  derniere_valeur: z.number().nullable(),
  derniere_annee: z.number().int().nullable(),
});

export const indicateursAnnuelsSchema = z.object({
  role: z.enum([
    'super_admin',
    'admin_scs',
    'editeur_projet',
    'contributeur_partenaire',
    'lecteur',
  ]),
  annee_min: z.number().int(),
  annee_max: z.number().int(),
  indicateurs: z.array(indicateurSchema),
});

export type ValeurAnnee = z.infer<typeof valeurAnneeSchema>;
export type IndicateurAvecValeurs = z.infer<typeof indicateurSchema>;
export type IndicateursAnnuelsPayload = z.infer<typeof indicateursAnnuelsSchema>;

/**
 * Ligne brute lue directement dans `valeurs_indicateurs_saisies`.
 * Utilisé par SaisieValeursClient pour afficher le tableau des saisies
 * même quand la RPC renvoie `source: 'auto'` (cas A2 — calcul BDD prioritaire).
 */
export type SaisieIndicateurBrute = {
  annee: number;
  numerateur: number | null;
  denominateur: number | null;
  valeur_directe: number | null;
  note: string | null;
  publie: boolean;
};

/**
 * Règle d'activation de la visualisation graphique pour un indicateur.
 *
 *   - Si le super_admin a forcé un choix via `indicateurs_config.visu_forcee`
 *     → on respecte sa décision (visu_activee).
 *   - Sinon : visualisation auto-activée si ≥ 2 années de données collectées.
 *
 * @param nbAnnees   nb_annees_avec_donnees retourné par la RPC.
 * @param visuForcee TRUE si le super_admin a forcé un choix manuel.
 * @param visuActivee Valeur du toggle si forcée.
 */
export function doitAfficherVisualisation(
  nbAnnees: number,
  visuForcee: boolean,
  visuActivee: boolean,
): boolean {
  if (visuForcee) return visuActivee;
  return nbAnnees >= 2;
}

/** Types de graphique disponibles pour la page détail d'un indicateur. */
export const TYPES_GRAPHIQUE = ['barres', 'ligne', 'aire', 'secteur'] as const;
export type TypeGraphique = (typeof TYPES_GRAPHIQUE)[number];

export const TYPE_GRAPHIQUE_LIBELLES: Record<TypeGraphique, string> = {
  barres: 'Barres',
  ligne: 'Ligne',
  aire: 'Aire',
  secteur: 'Secteur (camembert)',
};
