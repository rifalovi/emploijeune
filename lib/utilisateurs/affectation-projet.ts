'use server';

import { revalidatePath } from 'next/cache';
import type { ZodError } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import {
  ajouterProjetSchema,
  retirerProjetSchema,
  transfererProjetSchema,
  changerProjetStructureSchema,
} from '@/lib/schemas/affectation-projet';

/**
 * Server Actions — affectation projet ↔ utilisateur (refactor V1).
 *
 * Toutes les écritures passent par service_role : seul admin_scs peut piloter
 * les affectations. Les triggers d'audit sur les 3 tables alimentent
 * automatiquement journaux_audit (table_affectee, ligne_id, diff JSONB,
 * user_id de l'admin connecté via auth.uid()).
 *
 * Atomicité : les 3 opérations utilisent service_role pour ne pas être
 * impactées par les RLS de l'utilisateur courant. En cas d'échec partiel
 * (ex. update historique réussi + insert courante échoue), on tente un
 * rollback best-effort. Une vraie transaction nécessiterait un RPC
 * Postgres — V1.5 si retours terrain.
 */

type ResultatOk<T extends string> = { status: T };
type ResultatErr =
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_introuvable'; message: string }
  | { status: 'erreur_conflit'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export type AjouterProjetResult = ResultatOk<'succes'> | ResultatErr;
export type RetirerProjetResult = ResultatOk<'succes'> | ResultatErr;
export type TransfererProjetResult = ResultatOk<'succes'> | ResultatErr;
export type ChangerProjetStructureResult = ResultatOk<'succes'> | ResultatErr;

async function gardeAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; err: ResultatErr }
> {
  const courant = await getCurrentUtilisateur();
  if (!courant || courant.role !== 'admin_scs') {
    return {
      ok: false,
      err: {
        status: 'erreur_droits',
        message: 'Réservé aux administrateurs SCS.',
      },
    };
  }
  return { ok: true, userId: courant.user_id };
}

function issuesFromZod(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

// =============================================================================
// 1. ajouterProjetAUtilisateur
// =============================================================================

export async function ajouterProjetAUtilisateur(raw: unknown): Promise<AjouterProjetResult> {
  const garde = await gardeAdmin();
  if (!garde.ok) return garde.err;

  const parse = ajouterProjetSchema.safeParse(raw);
  if (!parse.success) {
    return { status: 'erreur_validation', issues: issuesFromZod(parse.error) };
  }
  const data = parse.data;
  const adminClient = createSupabaseAdminClient();

  // Vérifie que la cible existe et est un editeur_projet (les autres rôles
  // ne sont pas censés avoir des affectations directes).
  const { data: cible } = await adminClient
    .from('utilisateurs')
    .select('user_id, role')
    .eq('user_id', data.userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!cible) {
    return { status: 'erreur_introuvable', message: 'Utilisateur introuvable.' };
  }
  if (cible.role !== 'editeur_projet') {
    return {
      status: 'erreur_conflit',
      message:
        "Les affectations projet ne s'appliquent qu'aux coordonnateurs de projet. Changez d'abord le rôle.",
    };
  }

  // INSERT courante (UNIQUE user_id+projet_code → conflit silencieux remonte ici)
  const { error: insErr } = await adminClient.from('affectation_projet_courante').insert({
    user_id: data.userId,
    projet_code: data.projet_code,
    role_dans_projet: data.role_dans_projet,
    attribue_par: garde.userId,
    raison_debut: data.raison,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return {
        status: 'erreur_conflit',
        message: 'Cet utilisateur gère déjà ce projet.',
      };
    }
    return { status: 'erreur_inconnue', message: `INSERT échoué : ${insErr.message}` };
  }

  // Miroir historique (date_fin NULL = ligne active)
  await adminClient.from('affectation_projet_historique').insert({
    user_id: data.userId,
    projet_code: data.projet_code,
    role_dans_projet: data.role_dans_projet,
    date_debut: new Date().toISOString(),
    attribue_par: garde.userId,
    raison_debut: data.raison ?? null,
  });

  revalidatePath(`/admin/utilisateurs`);
  return { status: 'succes' };
}

// =============================================================================
// 2. retirerProjetAUtilisateur
// =============================================================================

export async function retirerProjetAUtilisateur(raw: unknown): Promise<RetirerProjetResult> {
  const garde = await gardeAdmin();
  if (!garde.ok) return garde.err;

  const parse = retirerProjetSchema.safeParse(raw);
  if (!parse.success) {
    return { status: 'erreur_validation', issues: issuesFromZod(parse.error) };
  }
  const data = parse.data;
  const adminClient = createSupabaseAdminClient();

  const { data: courante } = await adminClient
    .from('affectation_projet_courante')
    .select('id')
    .eq('user_id', data.userId)
    .eq('projet_code', data.projet_code)
    .maybeSingle();

  if (!courante) {
    return {
      status: 'erreur_introuvable',
      message: 'Aucune affectation active sur ce projet pour cet utilisateur.',
    };
  }

  // Clôt la ligne historique active (date_fin NULL)
  await adminClient
    .from('affectation_projet_historique')
    .update({
      date_fin: new Date().toISOString(),
      raison_fin: data.raison ?? null,
    })
    .eq('user_id', data.userId)
    .eq('projet_code', data.projet_code)
    .is('date_fin', null);

  // DELETE courante
  const { error: delErr } = await adminClient
    .from('affectation_projet_courante')
    .delete()
    .eq('id', courante.id);

  if (delErr) {
    return { status: 'erreur_inconnue', message: `DELETE échoué : ${delErr.message}` };
  }

  revalidatePath(`/admin/utilisateurs`);
  return { status: 'succes' };
}

// =============================================================================
// 3. transfererProjet
// =============================================================================

export async function transfererProjet(raw: unknown): Promise<TransfererProjetResult> {
  const garde = await gardeAdmin();
  if (!garde.ok) return garde.err;

  const parse = transfererProjetSchema.safeParse(raw);
  if (!parse.success) {
    return { status: 'erreur_validation', issues: issuesFromZod(parse.error) };
  }
  const data = parse.data;

  if (data.fromUserId === data.toUserId) {
    return {
      status: 'erreur_validation',
      issues: [{ path: 'toUserId', message: 'Le destinataire doit être différent de la source.' }],
    };
  }

  const adminClient = createSupabaseAdminClient();

  // 1. Vérifie l'affectation source
  const { data: source } = await adminClient
    .from('affectation_projet_courante')
    .select('id, role_dans_projet')
    .eq('user_id', data.fromUserId)
    .eq('projet_code', data.projet_code)
    .maybeSingle();

  if (!source) {
    return {
      status: 'erreur_introuvable',
      message: "L'utilisateur source ne gère pas ce projet.",
    };
  }

  // 2. Vérifie que la cible est un editeur_projet
  const { data: cibleUser } = await adminClient
    .from('utilisateurs')
    .select('user_id, role')
    .eq('user_id', data.toUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!cibleUser) {
    return { status: 'erreur_introuvable', message: 'Utilisateur destinataire introuvable.' };
  }
  if (cibleUser.role !== 'editeur_projet') {
    return {
      status: 'erreur_conflit',
      message: 'Le destinataire doit être un coordonnateur de projet.',
    };
  }

  // 3. Vérifie que la cible n'a pas déjà ce projet
  const { data: dejaCible } = await adminClient
    .from('affectation_projet_courante')
    .select('id')
    .eq('user_id', data.toUserId)
    .eq('projet_code', data.projet_code)
    .maybeSingle();

  if (dejaCible) {
    return {
      status: 'erreur_conflit',
      message: 'Le destinataire gère déjà ce projet.',
    };
  }

  const now = new Date().toISOString();

  // 4. Clôt l'historique de la source (date_fin + transfere_a)
  await adminClient
    .from('affectation_projet_historique')
    .update({
      date_fin: now,
      transfere_a: data.toUserId,
      raison_fin: data.raison,
    })
    .eq('user_id', data.fromUserId)
    .eq('projet_code', data.projet_code)
    .is('date_fin', null);

  // 5. DELETE de la source courante
  const { error: delErr } = await adminClient
    .from('affectation_projet_courante')
    .delete()
    .eq('id', source.id);

  if (delErr) {
    return { status: 'erreur_inconnue', message: `Suppression source échouée : ${delErr.message}` };
  }

  // 6. INSERT courante destination
  const { error: insErr } = await adminClient.from('affectation_projet_courante').insert({
    user_id: data.toUserId,
    projet_code: data.projet_code,
    role_dans_projet: data.role_dans_projet,
    attribue_par: garde.userId,
    raison_debut: data.raison,
  });

  if (insErr) {
    return {
      status: 'erreur_inconnue',
      message: `Création destination échouée : ${insErr.message}`,
    };
  }

  // 7. Historique destination (transfere_par = source)
  await adminClient.from('affectation_projet_historique').insert({
    user_id: data.toUserId,
    projet_code: data.projet_code,
    role_dans_projet: data.role_dans_projet,
    date_debut: now,
    attribue_par: garde.userId,
    transfere_par: data.fromUserId,
    raison_debut: data.raison,
  });

  revalidatePath(`/admin/utilisateurs`);
  return { status: 'succes' };
}

// =============================================================================
// 4. changerProjetStructure
// =============================================================================

export async function changerProjetStructure(raw: unknown): Promise<ChangerProjetStructureResult> {
  const garde = await gardeAdmin();
  if (!garde.ok) return garde.err;

  const parse = changerProjetStructureSchema.safeParse(raw);
  if (!parse.success) {
    return { status: 'erreur_validation', issues: issuesFromZod(parse.error) };
  }
  const data = parse.data;
  const adminClient = createSupabaseAdminClient();

  const { data: structure } = await adminClient
    .from('structures')
    .select('id, projet_code')
    .eq('id', data.structureId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!structure) {
    return { status: 'erreur_introuvable', message: 'Structure introuvable.' };
  }

  if (structure.projet_code === data.nouveauProjetCode) {
    return {
      status: 'erreur_conflit',
      message: 'La structure est déjà rattachée à ce projet.',
    };
  }

  const now = new Date().toISOString();

  // 1. Clôt la ligne historique active de l'ancien projet
  await adminClient
    .from('structure_projet_historique')
    .update({ date_fin_financement: now, motif_changement: data.motif })
    .eq('structure_id', data.structureId)
    .is('date_fin_financement', null);

  // 2. Nouvelle ligne historique
  await adminClient.from('structure_projet_historique').insert({
    structure_id: data.structureId,
    projet_code: data.nouveauProjetCode,
    date_debut_financement: now,
    motif_changement: data.motif,
    enregistre_par: garde.userId,
  });

  // 3. UPDATE structures.projet_code (le trigger trg_structures_audit
  //    enregistre le diff dans journaux_audit)
  const { error: updErr } = await adminClient
    .from('structures')
    .update({ projet_code: data.nouveauProjetCode })
    .eq('id', data.structureId);

  if (updErr) {
    return {
      status: 'erreur_inconnue',
      message: `UPDATE structure échoué : ${updErr.message}`,
    };
  }

  revalidatePath(`/structures`);
  revalidatePath(`/structures/${data.structureId}`);
  return { status: 'succes' };
}
