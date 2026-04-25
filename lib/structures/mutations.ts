'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { structureInsertSchema, structureUpdateSchema } from '@/lib/schemas/structure';

/**
 * Discriminated union des résultats de création / édition de structure.
 * Aligné sur le pattern A1 (`creerBeneficiaire`) pour permettre au client
 * de dispatcher sans parser de messages.
 */
export type CreerStructureResult =
  | { status: 'succes'; id: string }
  | {
      status: 'doublon';
      ficheExistante: {
        id: string;
        nom_structure: string;
        pays_code: string;
        projet_code: string;
        similarity_score: number;
      };
    }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_rls'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export type ModifierStructureResult = CreerStructureResult;

/**
 * Crée une structure après :
 *   1. Validation Zod (défense en profondeur)
 *   2. Détection doublon via `find_structure_doublon` SQL (clé : nom +
 *      pays + projet, tolérance similarity 0.85)
 *   3. INSERT avec RLS appliquée
 *   4. Invalidation du cache `/structures` et `/dashboard`
 */
export async function creerStructure(raw: unknown): Promise<CreerStructureResult> {
  const parse = structureInsertSchema.safeParse(raw);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      issues: parse.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const data = parse.data;

  const supabase = await createSupabaseServerClient();

  // Détection doublon bloquante (Q3 Étape 5)
  const { data: doublons } = await supabase.rpc('find_structure_doublon', {
    p_nom_structure: data.nom_structure,
    p_pays_code: data.pays_code,
    p_projet_code: data.projet_code,
  });
  const d = doublons?.[0];
  if (d) {
    return {
      status: 'doublon',
      ficheExistante: {
        id: d.id,
        nom_structure: d.nom_structure,
        pays_code: d.pays_code,
        projet_code: d.projet_code,
        similarity_score: d.similarity_score,
      },
    };
  }

  const utilisateur = await getCurrentUtilisateur();

  const insertPayload = {
    nom_structure: data.nom_structure,
    type_structure_code: data.type_structure_code,
    secteur_activite_code: data.secteur_activite_code,
    secteur_precis: data.secteur_precis ?? null,
    intitule_initiative: data.intitule_initiative ?? null,
    date_creation: data.date_creation ? data.date_creation.toISOString().slice(0, 10) : null,
    statut_creation: data.statut_creation as 'creation' | 'renforcement' | 'relance',
    projet_code: data.projet_code,
    pays_code: data.pays_code,
    organisation_id: data.organisation_id ?? utilisateur?.organisation_id ?? null,
    porteur_prenom: data.porteur_prenom ?? null,
    porteur_nom: data.porteur_nom,
    porteur_sexe: data.porteur_sexe as 'F' | 'M' | 'Autre',
    porteur_date_naissance: data.porteur_date_naissance
      ? data.porteur_date_naissance.toISOString().slice(0, 10)
      : null,
    fonction_porteur: data.fonction_porteur ?? null,
    annee_appui: data.annee_appui,
    nature_appui_code: data.nature_appui_code,
    montant_appui: data.montant_appui ?? null,
    devise_code: data.devise_code ?? null,
    consentement_recueilli: data.consentement_recueilli,
    consentement_date: data.consentement_date
      ? data.consentement_date.toISOString().slice(0, 10)
      : null,
    telephone_porteur: data.telephone_porteur ?? null,
    courriel_porteur: data.courriel_porteur ?? null,
    adresse: data.adresse ?? null,
    ville: data.ville ?? null,
    localite: data.localite ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    chiffre_affaires: data.chiffre_affaires ?? null,
    employes_permanents: data.employes_permanents ?? null,
    employes_temporaires: data.employes_temporaires ?? null,
    emplois_crees: data.emplois_crees ?? null,
    commentaire: data.commentaire ?? null,
    source_import: 'manuelle' as const,
  };

  const { data: insere, error } = await supabase
    .from('structures')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        status: 'erreur_inconnue',
        message:
          'Une structure identique existe déjà mais se trouve hors de votre périmètre. Contactez le SCS.',
      };
    }
    if (error.code === '23514') {
      return {
        status: 'erreur_validation',
        issues: [{ path: '_global', message: 'Règle métier violée : ' + error.message }],
      };
    }
    if (error.code === '42501' || error.message.includes('row-level security')) {
      return {
        status: 'erreur_rls',
        message:
          "Vous n'avez pas le droit de créer une structure dans ce projet. Contactez le SCS.",
      };
    }
    return { status: 'erreur_inconnue', message: error.message };
  }

  revalidatePath('/structures');
  revalidatePath('/dashboard');

  return { status: 'succes', id: insere.id };
}

/**
 * Met à jour une structure existante. Mêmes garanties que `creerStructure` ;
 * la détection doublon utilise `p_exclude_id` pour ne pas se détecter
 * elle-même.
 */
export async function modifierStructure(raw: unknown): Promise<ModifierStructureResult> {
  const parse = structureUpdateSchema.safeParse(raw);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      issues: parse.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const data = parse.data;

  const supabase = await createSupabaseServerClient();

  const { data: doublons } = await supabase.rpc('find_structure_doublon', {
    p_nom_structure: data.nom_structure,
    p_pays_code: data.pays_code,
    p_projet_code: data.projet_code,
    p_exclude_id: data.id,
  });
  const d = doublons?.[0];
  if (d) {
    return {
      status: 'doublon',
      ficheExistante: {
        id: d.id,
        nom_structure: d.nom_structure,
        pays_code: d.pays_code,
        projet_code: d.projet_code,
        similarity_score: d.similarity_score,
      },
    };
  }

  const updatePayload = {
    nom_structure: data.nom_structure,
    type_structure_code: data.type_structure_code,
    secteur_activite_code: data.secteur_activite_code,
    secteur_precis: data.secteur_precis ?? null,
    intitule_initiative: data.intitule_initiative ?? null,
    date_creation: data.date_creation ? data.date_creation.toISOString().slice(0, 10) : null,
    statut_creation: data.statut_creation as 'creation' | 'renforcement' | 'relance',
    projet_code: data.projet_code,
    pays_code: data.pays_code,
    porteur_prenom: data.porteur_prenom ?? null,
    porteur_nom: data.porteur_nom,
    porteur_sexe: data.porteur_sexe as 'F' | 'M' | 'Autre',
    porteur_date_naissance: data.porteur_date_naissance
      ? data.porteur_date_naissance.toISOString().slice(0, 10)
      : null,
    fonction_porteur: data.fonction_porteur ?? null,
    annee_appui: data.annee_appui,
    nature_appui_code: data.nature_appui_code,
    montant_appui: data.montant_appui ?? null,
    devise_code: data.devise_code ?? null,
    consentement_recueilli: data.consentement_recueilli,
    consentement_date: data.consentement_date
      ? data.consentement_date.toISOString().slice(0, 10)
      : null,
    telephone_porteur: data.telephone_porteur ?? null,
    courriel_porteur: data.courriel_porteur ?? null,
    adresse: data.adresse ?? null,
    ville: data.ville ?? null,
    localite: data.localite ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    chiffre_affaires: data.chiffre_affaires ?? null,
    employes_permanents: data.employes_permanents ?? null,
    employes_temporaires: data.employes_temporaires ?? null,
    emplois_crees: data.emplois_crees ?? null,
    commentaire: data.commentaire ?? null,
  };

  const { error } = await supabase
    .from('structures')
    .update(updatePayload)
    .eq('id', data.id)
    .is('deleted_at', null);

  if (error) {
    if (error.code === '23505') {
      return {
        status: 'erreur_inconnue',
        message:
          'Une structure identique existe déjà mais se trouve hors de votre périmètre. Contactez le SCS.',
      };
    }
    if (error.code === '23514') {
      return {
        status: 'erreur_validation',
        issues: [{ path: '_global', message: 'Règle métier violée : ' + error.message }],
      };
    }
    if (error.code === '42501' || error.message.includes('row-level security')) {
      return {
        status: 'erreur_rls',
        message: "Vous n'avez pas le droit de modifier cette structure. Contactez le SCS.",
      };
    }
    return { status: 'erreur_inconnue', message: error.message };
  }

  revalidatePath('/structures');
  revalidatePath(`/structures/${data.id}`);
  revalidatePath('/dashboard');

  return { status: 'succes', id: data.id };
}
