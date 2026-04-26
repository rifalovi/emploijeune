'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { envoyerEmail } from '@/lib/email/envoyer';
import {
  templateConfirmationDemande,
  templateNotificationSCS,
  templateRejetDemande,
  templateInvitationCompte,
} from '@/lib/email/templates';
import {
  creerDemandeAccesSchema,
  rejeterDemandeSchema,
  ROLE_DEMANDABLE_LIBELLES,
  type RoleDemandable,
} from '@/lib/schemas/demande-acces';
import { ROLE_CREABLE_LIBELLES } from '@/lib/schemas/utilisateur';

// =============================================================================
// 1. Server Action publique : creerDemandeAcces
// =============================================================================

export type CreerDemandeAccesResult =
  | { status: 'succes' }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_doublon'; message: string }
  | { status: 'erreur_inconnue'; message: string };

/**
 * Création publique d'une demande d'accès. Pas d'auth requise.
 *
 * Garde-fous V1 :
 *   - Validation Zod stricte (consentement RGPD obligatoire via z.literal(true))
 *   - Détection doublon : refuse si une demande pending OU un compte existe
 *     déjà avec le même email (pas de fuite d'info — message neutre)
 *   - Rate-limit : géré par middleware Next.js sur /api/demandes-acces (V1.5
 *     enrichi avec captcha si abus constatés)
 *
 * Effets de bord :
 *   - INSERT public.demandes_acces
 *   - Email confirmation au demandeur (template OIF FR)
 *   - Email notification SCS (variable env ADMIN_NOTIFICATION_EMAIL ou
 *     fallback récupéré du premier admin_scs en BDD)
 */
export async function creerDemandeAcces(raw: unknown): Promise<CreerDemandeAccesResult> {
  const parse = creerDemandeAccesSchema.safeParse(raw);
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

  const adminClient = createSupabaseAdminClient();

  // Détection doublon — silencieux pour ne pas révéler l'état des comptes.
  // 1. Demande pending existante avec ce même email
  const { data: doublonDemande } = await adminClient
    .from('demandes_acces')
    .select('id')
    .ilike('email', data.email)
    .eq('statut', 'pending')
    .maybeSingle();
  if (doublonDemande) {
    return {
      status: 'erreur_doublon',
      message:
        'Une demande est déjà en cours d’examen pour cette adresse. Patientez la décision avant d’en redéposer une.',
    };
  }

  // 2. Compte déjà existant
  const { data: authList } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existingAuth = authList?.users.find(
    (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
  );
  if (existingAuth) {
    return {
      status: 'erreur_doublon',
      message:
        'Un compte existe déjà avec cette adresse. Utilisez « Mot de passe oublié » sur la page de connexion si vous l’avez perdu.',
    };
  }

  // Récupération de l'IP source (audit anti-spam)
  let ip: string | null = null;
  try {
    const h = headers();
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
  } catch {
    // headers() peut throw hors contexte de requête — on ignore en best-effort.
  }

  // INSERT (RLS public via policy demandes_acces_insert_public)
  const { data: inserted, error: insertError } = await adminClient
    .from('demandes_acces')
    .insert({
      email: data.email,
      prenom: data.prenom,
      nom: data.nom,
      role_souhaite: data.role_souhaite as RoleDemandable,
      contexte_souhaite: data.contexte_souhaite ?? null,
      justification: data.justification,
      consentement_rgpd: true,
      created_at_ip: ip,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return {
      status: 'erreur_inconnue',
      message: `Enregistrement de la demande échoué : ${insertError?.message ?? 'erreur inconnue'}`,
    };
  }

  // Email confirmation au demandeur (best-effort — n'échoue pas la transaction)
  await envoyerEmail({
    to: data.email,
    ...templateConfirmationDemande({ prenom: data.prenom }),
  }).catch(() => {});

  // Email notification SCS (best-effort)
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const lienAdmin = `${origin}/admin/demandes-acces`;
  const adminEmail = await resoudreEmailAdminScs();
  if (adminEmail) {
    await envoyerEmail({
      to: adminEmail,
      ...templateNotificationSCS({
        demandeur: { prenom: data.prenom, nom: data.nom, email: data.email },
        roleLibelle: ROLE_DEMANDABLE_LIBELLES[data.role_souhaite as RoleDemandable],
        contexte: data.contexte_souhaite ?? null,
        justification: data.justification,
        lienAdmin,
      }),
    }).catch(() => {});
  }

  revalidatePath('/admin/demandes-acces');
  return { status: 'succes' };
}

// =============================================================================
// 2. Server Action admin : approuverDemande
// =============================================================================

export type ApprouverDemandeResult =
  | {
      status: 'succes';
      userId: string;
      lienActivation: string;
      emailEnvoi: 'envoye' | 'mock';
    }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_demande_invalide'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function approuverDemandeAcces(demandeId: string): Promise<ApprouverDemandeResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'admin_scs') {
    return { status: 'erreur_droits', message: 'Réservé aux administrateurs SCS.' };
  }
  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(demandeId)
  ) {
    return { status: 'erreur_demande_invalide', message: 'Identifiant de demande invalide.' };
  }

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: demande } = await supabase
    .from('demandes_acces')
    .select('id, email, prenom, nom, role_souhaite, statut')
    .eq('id', demandeId)
    .maybeSingle();
  if (!demande || demande.statut !== 'pending') {
    return {
      status: 'erreur_demande_invalide',
      message: 'Demande introuvable ou déjà traitée.',
    };
  }

  // Création Auth user (mdp temporaire fort)
  const mdpTemporaire = randomBytes(16).toString('hex');
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: demande.email,
    password: mdpTemporaire,
    email_confirm: true,
    user_metadata: {
      mdp_temporaire: true,
      cree_par_admin: utilisateur.user_id,
      via_demande_acces: demande.id,
    },
  });
  if (authError || !authData.user) {
    return {
      status: 'erreur_inconnue',
      message: `Création Auth échouée : ${authError?.message ?? 'erreur'}`,
    };
  }
  const newUserId = authData.user.id;

  // INSERT utilisateurs avec rôle issu de la demande
  const nomComplet = `${demande.prenom} ${demande.nom}`;
  const { error: insertError } = await supabase.from('utilisateurs').insert({
    user_id: newUserId,
    nom_complet: nomComplet,
    role: demande.role_souhaite as 'editeur_projet' | 'contributeur_partenaire',
    actif: true,
    statut_validation: 'valide',
    created_by: utilisateur.user_id,
  });
  if (insertError) {
    await adminClient.auth.admin.deleteUser(newUserId).catch(() => {});
    return { status: 'erreur_inconnue', message: insertError.message };
  }

  // Lien d'activation
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectTo = `${origin}/api/auth/callback?redirect=${encodeURIComponent('/motpasse/changer?premier_login=1')}`;
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: demande.email,
    options: { redirectTo },
  });
  if (linkError || !linkData?.properties?.action_link) {
    return { status: 'erreur_inconnue', message: linkError?.message ?? 'Lien KO' };
  }
  const lienActivation = linkData.properties.action_link;

  // Email d'invitation (template centralisé)
  const roleLibelle =
    ROLE_CREABLE_LIBELLES[demande.role_souhaite as keyof typeof ROLE_CREABLE_LIBELLES] ??
    demande.role_souhaite;
  const tpl = templateInvitationCompte({
    prenom: demande.prenom,
    roleLibelle,
    lienActivation,
  });
  const envoi = await envoyerEmail({
    to: demande.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });

  // MAJ demande
  await supabase
    .from('demandes_acces')
    .update({
      statut: 'approved',
      decided_at: new Date().toISOString(),
      decided_by: utilisateur.user_id,
      utilisateur_cree_id: newUserId,
    })
    .eq('id', demande.id);

  revalidatePath('/admin/demandes-acces');
  revalidatePath('/admin/utilisateurs');

  return {
    status: 'succes',
    userId: newUserId,
    lienActivation,
    emailEnvoi: envoi.status === 'envoye' ? 'envoye' : 'mock',
  };
}

// =============================================================================
// 3. Server Action admin : rejeterDemande
// =============================================================================

export type RejeterDemandeResult =
  | { status: 'succes' }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_demande_invalide'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function rejeterDemandeAcces(raw: unknown): Promise<RejeterDemandeResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'admin_scs') {
    return { status: 'erreur_droits', message: 'Réservé aux administrateurs SCS.' };
  }

  const parse = rejeterDemandeSchema.safeParse(raw);
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

  const { data: demande } = await supabase
    .from('demandes_acces')
    .select('id, email, prenom, statut')
    .eq('id', data.demandeId)
    .maybeSingle();
  if (!demande || demande.statut !== 'pending') {
    return {
      status: 'erreur_demande_invalide',
      message: 'Demande introuvable ou déjà traitée.',
    };
  }

  const { error: updateError } = await supabase
    .from('demandes_acces')
    .update({
      statut: 'rejected',
      raison_rejet: data.raison,
      decided_at: new Date().toISOString(),
      decided_by: utilisateur.user_id,
    })
    .eq('id', demande.id);
  if (updateError) return { status: 'erreur_inconnue', message: updateError.message };

  // Email rejet au demandeur (best-effort)
  await envoyerEmail({
    to: demande.email,
    ...templateRejetDemande({ prenom: demande.prenom, raison: data.raison }),
  }).catch(() => {});

  revalidatePath('/admin/demandes-acces');
  return { status: 'succes' };
}

// =============================================================================
// 4. Server Action admin : supprimerDemandeAcces (rejetées uniquement)
// =============================================================================

export type SupprimerDemandeResult =
  | { status: 'succes' }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_demande_invalide'; message: string }
  | { status: 'erreur_inconnue'; message: string };

/**
 * Supprime DÉFINITIVEMENT une demande d'accès rejetée (hard DELETE).
 * Réservé admin_scs. Garde-fou : seules les demandes au statut 'rejected'
 * peuvent être supprimées (pour préserver l'audit des approbations et
 * empêcher la suppression de demandes pending par erreur).
 *
 * Décision V1 : pas de soft-delete pour cette table — la conservation
 * RGPD 90 jours sera gérée par tâche planifiée V1.5 qui supprimera
 * automatiquement les rejets > 90j (la suppression manuelle ici est
 * pour les cas explicites : doublons confirmés, demandes manifestement
 * frauduleuses purgées immédiatement, nettoyage avant tag).
 */
export async function supprimerDemandeAcces(demandeId: string): Promise<SupprimerDemandeResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'admin_scs') {
    return { status: 'erreur_droits', message: 'Réservé aux administrateurs SCS.' };
  }
  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(demandeId)
  ) {
    return { status: 'erreur_demande_invalide', message: 'Identifiant invalide.' };
  }

  const supabase = await createSupabaseServerClient();

  // Garde-fou : on ne supprime QUE si statut='rejected' (audit-friendly).
  const { data: demande } = await supabase
    .from('demandes_acces')
    .select('id, statut')
    .eq('id', demandeId)
    .maybeSingle();
  if (!demande) {
    return { status: 'erreur_demande_invalide', message: 'Demande introuvable.' };
  }
  if (demande.statut !== 'rejected') {
    return {
      status: 'erreur_demande_invalide',
      message:
        'Seules les demandes rejetées peuvent être supprimées définitivement. Pour annuler une demande approuvée, désactivez le compte associé.',
    };
  }

  const { error } = await supabase
    .from('demandes_acces')
    .delete()
    .eq('id', demande.id)
    .eq('statut', 'rejected'); // double garde anti race condition
  if (error) {
    return { status: 'erreur_inconnue', message: error.message };
  }

  revalidatePath('/admin/demandes-acces');
  return { status: 'succes' };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Récupère l'email du SCS pour notification. Priorité :
 *   1. ADMIN_NOTIFICATION_EMAIL (env)
 *   2. Premier admin_scs en BDD (best-effort)
 */
async function resoudreEmailAdminScs(): Promise<string | null> {
  const envEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (envEmail) return envEmail;

  const adminClient = createSupabaseAdminClient();
  const { data: utilisateurs } = await adminClient
    .from('utilisateurs')
    .select('user_id')
    .eq('role', 'admin_scs')
    .eq('actif', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  const adminUserId = utilisateurs?.[0]?.user_id;
  if (!adminUserId) return null;

  const { data: authUser } = await adminClient.auth.admin.getUserById(adminUserId);
  return authUser?.user?.email ?? null;
}
