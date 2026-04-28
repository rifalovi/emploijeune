'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { beneficiaireInsertSchema, beneficiaireUpdateSchema } from '@/lib/schemas/beneficiaire';

/**
 * Résultat détaillé de la tentative de création d'un bénéficiaire.
 * Le client peut dispatcher finement selon `status` :
 *   - 'succes' → afficher l'écran de succès avec 3 CTA
 *   - 'doublon' → afficher le message « Un bénéficiaire … existe déjà »
 *     avec un lien vers la fiche existante
 *   - 'erreur_validation' → n'arrive normalement pas (le formulaire valide côté
 *     client) mais serveur-of-truth : on renvoie les erreurs Zod
 *   - 'erreur_rls' → RLS a refusé (l'utilisateur n'a pas le droit d'insérer
 *     dans ce projet) — message courtois pointant vers le SCS
 *   - 'erreur_inconnue' → erreur réseau, BDD indisponible, cas non prévu
 */
export type CreerBeneficiaireResult =
  | { status: 'succes'; id: string }
  | {
      status: 'doublon';
      ficheExistante: {
        id: string;
        prenom: string;
        nom: string;
        date_naissance: string | null;
        projet_code: string;
      };
    }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_rls'; message: string }
  | { status: 'erreur_inconnue'; message: string };

/**
 * Crée un bénéficiaire après :
 *   1. Validation Zod (défense en profondeur — le client valide déjà)
 *   2. Détection doublon via `find_beneficiaire_doublon` SQL
 *   3. INSERT avec RLS appliquée (le client Supabase serveur utilise la clé
 *      anon, la policy `beneficiaires_insert` autorise selon le rôle)
 *   4. Invalidation du cache `/beneficiaires` et `/dashboard` pour refléter
 *      la nouvelle fiche côté liste et compteur KPI
 */
export async function creerBeneficiaire(raw: unknown): Promise<CreerBeneficiaireResult> {
  // 1. Validation Zod ---------------------------------------------------------
  const parse = beneficiaireInsertSchema.safeParse(raw);
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

  // 2. Détection doublon bloquante (Q7) ---------------------------------------
  // La fonction SQL respecte la RLS : si l'utilisateur ne peut pas voir une
  // fiche existante hors périmètre, on ne la détectera pas ici. L'INSERT
  // échouera alors au niveau de la contrainte unique avec code 23505 et on
  // tombera dans le bloc d'erreur plus bas.
  if (data.date_naissance) {
    const { data: doublons } = await supabase.rpc('find_beneficiaire_doublon', {
      p_prenom: data.prenom,
      p_nom: data.nom,
      p_date_naissance: data.date_naissance.toISOString().slice(0, 10),
      p_projet_code: data.projet_code,
    });
    const d = doublons?.[0];
    if (d) {
      return {
        status: 'doublon',
        ficheExistante: {
          id: d.id,
          prenom: d.prenom,
          nom: d.nom,
          date_naissance: d.date_naissance,
          projet_code: d.projet_code,
        },
      };
    }
  }

  // 3. INSERT -----------------------------------------------------------------
  const utilisateur = await getCurrentUtilisateur();

  const insertPayload = {
    prenom: data.prenom,
    nom: data.nom,
    sexe: data.sexe as 'F' | 'M' | 'Autre',
    date_naissance: data.date_naissance ? data.date_naissance.toISOString().slice(0, 10) : null,
    projet_code: data.projet_code,
    pays_code: data.pays_code,
    organisation_id: data.organisation_id ?? utilisateur?.organisation_id ?? null,
    partenaire_accompagnement: data.partenaire_accompagnement ?? null,
    domaine_formation_code: data.domaine_formation_code,
    intitule_formation: data.intitule_formation ?? null,
    modalite_formation_code: data.modalite_formation_code ?? null,
    annee_formation: data.annee_formation,
    date_debut_formation: data.date_debut_formation
      ? data.date_debut_formation.toISOString().slice(0, 10)
      : null,
    date_fin_formation: data.date_fin_formation
      ? data.date_fin_formation.toISOString().slice(0, 10)
      : null,
    statut_code: data.statut_code,
    fonction_actuelle: data.fonction_actuelle ?? null,
    consentement_recueilli: data.consentement_recueilli,
    consentement_date: data.consentement_date
      ? data.consentement_date.toISOString().slice(0, 10)
      : null,
    telephone: data.telephone ?? null,
    courriel: data.courriel ?? null,
    localite_residence: data.localite_residence ?? null,
    commentaire: data.commentaire ?? null,
    source_import: 'manuelle' as const,
  };

  const { data: insere, error } = await supabase
    .from('beneficiaires')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    // Violation contrainte unique : doublon qu'on n'avait pas pu détecter en
    // amont (RLS masquait la fiche, ou course condition).
    if (error.code === '23505') {
      return {
        status: 'erreur_inconnue',
        message:
          'Un bénéficiaire identique existe déjà mais se trouve hors de votre périmètre. Contactez le SCS.',
      };
    }
    // Violation CHECK constraint (RGPD, dates, etc.)
    if (error.code === '23514') {
      return {
        status: 'erreur_validation',
        issues: [{ path: '_global', message: 'Règle métier violée : ' + error.message }],
      };
    }
    // RLS — empty insert car policy refuse
    if (error.code === '42501' || error.message.includes('row-level security')) {
      return {
        status: 'erreur_rls',
        message:
          "Vous n'avez pas le droit de créer un bénéficiaire dans ce projet. Contactez le SCS.",
      };
    }
    return {
      status: 'erreur_inconnue',
      message: error.message,
    };
  }

  // 4. Revalidation cache -----------------------------------------------------
  revalidatePath('/beneficiaires');
  revalidatePath('/dashboard');

  return { status: 'succes', id: insere.id };
}

// =============================================================================
// modifierBeneficiaire : mise à jour d'une fiche existante
// =============================================================================

export type ModifierBeneficiaireResult =
  | { status: 'succes'; id: string }
  | {
      status: 'doublon';
      ficheExistante: {
        id: string;
        prenom: string;
        nom: string;
        date_naissance: string | null;
        projet_code: string;
      };
    }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_rls'; message: string }
  | { status: 'erreur_inconnue'; message: string };

/**
 * Met à jour un bénéficiaire existant.
 *
 * Différences avec `creerBeneficiaire` :
 *   - Utilise `beneficiaireUpdateSchema` (qui exige `id`)
 *   - La détection de doublon passe `p_exclude_id = id` pour que la fiche
 *     ne se détecte pas elle-même
 *   - UPDATE plutôt que INSERT ; la RLS `beneficiaires_update` s'applique
 *   - Revalide aussi `/beneficiaires/[id]` pour rafraîchir la fiche détail
 */
export async function modifierBeneficiaire(raw: unknown): Promise<ModifierBeneficiaireResult> {
  const parse = beneficiaireUpdateSchema.safeParse(raw);
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

  // Détection doublon excluant la fiche courante
  if (data.date_naissance) {
    const { data: doublons } = await supabase.rpc('find_beneficiaire_doublon', {
      p_prenom: data.prenom,
      p_nom: data.nom,
      p_date_naissance: data.date_naissance.toISOString().slice(0, 10),
      p_projet_code: data.projet_code,
      p_exclude_id: data.id,
    });
    const d = doublons?.[0];
    if (d) {
      return {
        status: 'doublon',
        ficheExistante: {
          id: d.id,
          prenom: d.prenom,
          nom: d.nom,
          date_naissance: d.date_naissance,
          projet_code: d.projet_code,
        },
      };
    }
  }

  const updatePayload = {
    prenom: data.prenom,
    nom: data.nom,
    sexe: data.sexe as 'F' | 'M' | 'Autre',
    date_naissance: data.date_naissance ? data.date_naissance.toISOString().slice(0, 10) : null,
    projet_code: data.projet_code,
    pays_code: data.pays_code,
    partenaire_accompagnement: data.partenaire_accompagnement ?? null,
    domaine_formation_code: data.domaine_formation_code,
    intitule_formation: data.intitule_formation ?? null,
    modalite_formation_code: data.modalite_formation_code ?? null,
    annee_formation: data.annee_formation,
    date_debut_formation: data.date_debut_formation
      ? data.date_debut_formation.toISOString().slice(0, 10)
      : null,
    date_fin_formation: data.date_fin_formation
      ? data.date_fin_formation.toISOString().slice(0, 10)
      : null,
    statut_code: data.statut_code,
    fonction_actuelle: data.fonction_actuelle ?? null,
    consentement_recueilli: data.consentement_recueilli,
    consentement_date: data.consentement_date
      ? data.consentement_date.toISOString().slice(0, 10)
      : null,
    telephone: data.telephone ?? null,
    courriel: data.courriel ?? null,
    localite_residence: data.localite_residence ?? null,
    commentaire: data.commentaire ?? null,
  };

  const { error } = await supabase
    .from('beneficiaires')
    .update(updatePayload)
    .eq('id', data.id)
    .is('deleted_at', null);

  if (error) {
    if (error.code === '23505') {
      return {
        status: 'erreur_inconnue',
        message:
          'Un bénéficiaire identique existe déjà mais se trouve hors de votre périmètre. Contactez le SCS.',
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
        message: "Vous n'avez pas le droit de modifier cette fiche. Contactez le SCS.",
      };
    }
    return { status: 'erreur_inconnue', message: error.message };
  }

  revalidatePath('/beneficiaires');
  revalidatePath(`/beneficiaires/${data.id}`);
  revalidatePath('/dashboard');

  return { status: 'succes', id: data.id };
}

// =============================================================================
// setBeneficiaireDeleted : soft-delete admin_scs uniquement
// =============================================================================

export type SetBeneficiaireDeletedResult =
  | { status: 'succes' }
  | { status: 'erreur_rls'; message: string }
  | { status: 'erreur_inconnue'; message: string };

/**
 * Marque une fiche bénéficiaire comme supprimée (soft-delete). Réservé
 * `admin_scs`. Vérifie le rôle via `getCurrentUtilisateur()` avant d'effectuer
 * l'UPDATE pour émettre un message d'erreur utilisable si un autre rôle y
 * accède (rare via UI, possible via API).
 *
 * L'UPDATE positionne :
 *   - deleted_at = NOW()
 *   - deleted_by = user_id courant
 *   - deleted_reason = raison optionnelle saisie par l'admin
 *
 * Le trigger existant `trg_beneficiaires_audit` insère automatiquement une
 * entrée `action='SOFT_DELETE'` dans `journaux_audit` avec le diff complet.
 */
export async function setBeneficiaireDeleted(
  id: string,
  raison?: string,
): Promise<SetBeneficiaireDeletedResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin')) {
    return {
      status: 'erreur_rls',
      message: 'Seul un administrateur SCS peut supprimer un bénéficiaire.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const raisonTrim = raison?.trim();

  const { error } = await supabase
    .from('beneficiaires')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: utilisateur.user_id,
      deleted_reason: raisonTrim && raisonTrim.length > 0 ? raisonTrim : null,
    })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    if (error.code === '42501' || error.message.includes('row-level security')) {
      return {
        status: 'erreur_rls',
        message: 'Action refusée par la base de données.',
      };
    }
    return { status: 'erreur_inconnue', message: error.message };
  }

  revalidatePath('/beneficiaires');
  revalidatePath(`/beneficiaires/${id}`);
  revalidatePath('/dashboard');

  return { status: 'succes' };
}
