import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from './server';
import { createSupabaseAdminClient } from './admin';
import type { Database } from './database.types';

export type StatutValidation = 'en_attente' | 'valide' | 'rejete';
export type RoleUtilisateur = Database['public']['Enums']['role_utilisateur'];

export type UtilisateurProfile = {
  id: string;
  user_id: string;
  nom_complet: string;
  role: RoleUtilisateur;
  organisation_id: string | null;
  statut_validation: StatutValidation;
  actif: boolean;
};

/**
 * Récupère le user Supabase Auth courant ou null.
 * Ne déclenche pas de redirection, à utiliser dans les layouts.
 */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Récupère le profil métier (ligne dans public.utilisateurs) de l'utilisateur
 * courant. Retourne null si pas authentifié ou si aucune ligne utilisateur
 * n'existe encore (bootstrap pas fait).
 *
 * **Garde view-as (V1.1.5)** : si l'admin SCS est en mode view-as, cette
 * fonction THROW par défaut (sécurité écriture stricte). Les helpers de
 * lecture (layout, dashboard) doivent passer `{ allowViewAs: true }` pour
 * autoriser le retour normal pendant le rendu.
 *
 * Cette garde centralisée protège automatiquement toutes les Server Actions
 * qui utilisent `getCurrentUtilisateur()` comme pré-condition (~30 actions
 * au moment de la livraison V1.1.5) sans modification fichier par fichier.
 */
export async function getCurrentUtilisateur(
  options: { allowViewAs?: boolean } = {},
): Promise<UtilisateurProfile | null> {
  if (!options.allowViewAs) {
    const cookieStore = await cookies();
    const viewAsRaw = cookieStore.get('oif_view_as')?.value;
    if (viewAsRaw) {
      throw new Error(
        'Action impossible en mode visualisation (view-as). Cliquez sur « Revenir à mon admin » pour reprendre votre session.',
      );
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('utilisateurs')
    .select('id, user_id, nom_complet, role, organisation_id, statut_validation, actif')
    .eq('user_id', auth.user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;
  return data as UtilisateurProfile;
}

/**
 * Crée la ligne utilisateur au premier passage (bootstrap).
 * Utilise le client admin (service_role) car l'utilisateur en 'en_attente'
 * n'aura pas les droits RLS pour s'auto-insérer.
 *
 * Idempotent : ne fait rien si la ligne existe déjà.
 */
export async function bootstrapUtilisateurIfNeeded(user: User): Promise<UtilisateurProfile> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('utilisateurs')
    .select('id, user_id, nom_complet, role, organisation_id, statut_validation, actif')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) return existing as UtilisateurProfile;

  const emailPrefix = (user.email ?? 'utilisateur').split('@')[0] ?? 'utilisateur';

  const { data, error } = await admin
    .from('utilisateurs')
    .insert({
      user_id: user.id,
      nom_complet: emailPrefix,
      role: 'lecteur',
      organisation_id: null,
      statut_validation: 'en_attente',
      actif: true,
    })
    .select('id, user_id, nom_complet, role, organisation_id, statut_validation, actif')
    .single();

  if (error || !data) {
    throw new Error(`Bootstrap utilisateur impossible : ${error?.message ?? 'erreur inconnue'}`);
  }
  return data as UtilisateurProfile;
}

/**
 * Garde-fou pour les routes /dashboard/**.
 * - Redirige vers /connexion si pas authentifié.
 * - Redirige vers /en-attente-de-validation si statut != 'valide'.
 * - Signe out si statut = 'rejete'.
 * Retourne le profil validé pour les composants appelants.
 */
export async function requireUtilisateurValide(): Promise<UtilisateurProfile> {
  const user = await getAuthUser();
  if (!user) redirect('/connexion');

  // allowViewAs: true → ce helper est utilisé par les layouts/pages (rendu),
  // pas par les Server Actions mutantes. La garde view-as ne s'applique pas
  // ici (sinon le rendu casserait). Les Server Actions appellent directement
  // getCurrentUtilisateur() (sans options) qui throw en mode view-as.
  const profile = await getCurrentUtilisateur({ allowViewAs: true });
  if (!profile) {
    // Pas de ligne métier (cas limite : session active mais bootstrap non fait).
    // On lance le bootstrap ici par sécurité.
    const bootstrapped = await bootstrapUtilisateurIfNeeded(user);
    if (bootstrapped.statut_validation !== 'valide') {
      redirect('/en-attente-de-validation');
    }
    return bootstrapped;
  }

  if (profile.statut_validation === 'en_attente') redirect('/en-attente-de-validation');
  if (profile.statut_validation === 'rejete') redirect('/connexion?message=compte_refuse');
  if (!profile.actif) redirect('/connexion?message=compte_inactif');

  return profile;
}

/**
 * Récupère le nombre de notifications admin non lues (badge sidebar admin_scs).
 */
export async function getNotificationsAdminCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('notifications_admin_non_lues_count');
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}
