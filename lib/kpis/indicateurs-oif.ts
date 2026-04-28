import { z } from 'zod';

/**
 * Schéma Zod du payload renvoyé par la fonction PostgreSQL
 * `get_indicateurs_oif_v1(p_periode TEXT)` (Étape 9 — Dashboards V1).
 *
 * Vit hors `'use server'` (cf. hotfix 6.5h-quater) : utilisé par la page
 * dashboard server-side ET par les Client Components qui rafraîchissent
 * la période sélectionnée.
 */

export const PERIODES = ['7j', '30j', '90j', 'all'] as const;
export type Periode = (typeof PERIODES)[number];

export const PERIODE_LIBELLES: Record<Periode, string> = {
  '7j': '7 derniers jours',
  '30j': '30 derniers jours',
  '90j': '90 derniers jours',
  all: 'Depuis toujours',
};

const indicateurValeurSchema = z.object({
  libelle: z.string(),
  valeur: z.number().nullable(),
  femmes: z.number().optional(),
  hommes: z.number().optional(),
  proxy: z.string().optional(),
  mention: z.string().optional(),
});

export const indicateursOifSchema = z.object({
  role: z.enum([
    'super_admin',
    'admin_scs',
    'editeur_projet',
    'contributeur_partenaire',
    'lecteur',
  ]),
  periode: z.enum(PERIODES),
  scope: z.enum(['global', 'projets_geres', 'organisation']),
  indicateurs: z.object({
    A1: indicateurValeurSchema,
    A4: indicateurValeurSchema,
    B1: indicateurValeurSchema,
    B4: indicateurValeurSchema,
    F1: indicateurValeurSchema,
  }),
  bar_projets: z.array(
    z.object({
      code: z.string(),
      libelle: z.string().nullable(),
      beneficiaires: z.number(),
    }),
  ),
  pie_programmes: z.array(
    z.object({
      code: z.string(),
      libelle: z.string().nullable(),
      beneficiaires: z.number(),
    }),
  ),
  // Hotfix v1.2.7 — Top 10 pays par bénéficiaires (KPI clé démo).
  // Optional pour rétrocompat avec les BDD non encore migrées.
  bar_pays: z
    .array(
      z.object({
        code: z.string(),
        libelle: z.string().nullable(),
        beneficiaires: z.number(),
      }),
    )
    .optional()
    .default([]),
});

export type IndicateursOif = z.infer<typeof indicateursOifSchema>;

/**
 * Conversion EUR ↔ FCFA (zone CFA, taux fixe Banque Centrale).
 * 1 EUR = 655,957 FCFA (parité fixe).
 */
export const TAUX_FCFA_PAR_EUR = 655.957;

export function convertirEur(montantEur: number, devise: 'EUR' | 'FCFA'): number {
  if (devise === 'EUR') return montantEur;
  return montantEur * TAUX_FCFA_PAR_EUR;
}

export function formaterMontant(
  montantEur: number,
  devise: 'EUR' | 'FCFA',
  options: { decimales?: number } = {},
): string {
  const valeur = convertirEur(montantEur, devise);
  const dec = options.decimales ?? (devise === 'EUR' ? 2 : 0);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise === 'EUR' ? 'EUR' : 'XOF',
    maximumFractionDigits: dec,
    minimumFractionDigits: dec,
  }).format(valeur);
}
