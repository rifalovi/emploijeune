'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { readServerEnv } from '@/lib/supabase/env';

/**
 * Server actions — gestion des documents PDF publics téléchargeables
 * (note de cadrage, etc.). Réservé admin_scs + super_admin.
 *
 * Le bucket Supabase Storage `documents-publics` est public en lecture,
 * écriture admin_scs/super_admin via RLS. On utilise quand même le
 * service_role client pour simplifier la gestion d'erreurs et bypass
 * d'éventuels soucis de cookies/session côté server action.
 */

type Resultat = { status: 'succes' } | { status: 'erreur'; message: string };

const BUCKET = 'documents-publics';
const TAILLE_MAX_OCTETS = 20 * 1024 * 1024; // 20 Mo

const uploadSchema = z.object({
  cle: z.string().trim().min(1).max(64),
  libelle: z.string().trim().min(1).max(200),
  nomFichier: z.string().trim().min(1).max(255),
  contentType: z.literal('application/pdf'),
  taille: z.number().int().positive().max(TAILLE_MAX_OCTETS),
  fichierBase64: z.string().min(1),
});

export async function uploaderDocumentPublic(payload: {
  cle: string;
  libelle: string;
  nomFichier: string;
  contentType: string;
  taille: number;
  fichierBase64: string;
}): Promise<Resultat> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur) return { status: 'erreur', message: 'non_authentifie' };
  if (utilisateur.role !== 'super_admin' && utilisateur.role !== 'admin_scs') {
    return { status: 'erreur', message: 'reserve_admin' };
  }

  const parsed = uploadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 'erreur',
      message: `payload_invalide: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsed.data.fichierBase64, 'base64');
  } catch {
    return { status: 'erreur', message: 'base64_invalide' };
  }
  if (buffer.length === 0 || buffer.length !== parsed.data.taille) {
    return { status: 'erreur', message: 'taille_incoherente' };
  }

  // Chemin Storage : on horodate pour éviter la mise en cache CDN agressive
  // quand on remplace un fichier (`{cle}/{timestamp}-{nom}`).
  const slug = parsed.data.nomFichier
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  const chemin = `${parsed.data.cle}/${Date.now()}-${slug}`;

  const env = readServerEnv();
  const supabase = createSupabaseAdminClient();

  // 1. Lire l'ancien chemin avant upload pour pouvoir le supprimer après succès.
  const { data: ancien } = await supabase
    .from('documents_publics')
    .select('chemin_storage')
    .eq('cle', parsed.data.cle)
    .maybeSingle();

  // 2. Upload du nouveau fichier
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(chemin, buffer, {
    contentType: parsed.data.contentType,
    upsert: false,
    cacheControl: '3600',
  });
  if (uploadError) {
    return { status: 'erreur', message: `upload_storage: ${uploadError.message}` };
  }

  const urlPublique = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${chemin}`;

  // 3. Upsert métadonnées
  const { error: dbError } = await supabase.from('documents_publics').upsert(
    {
      cle: parsed.data.cle,
      libelle: parsed.data.libelle,
      nom_fichier: parsed.data.nomFichier,
      chemin_storage: chemin,
      url_publique: urlPublique,
      taille_octets: parsed.data.taille,
      content_type: parsed.data.contentType,
      uploaded_at: new Date().toISOString(),
      uploaded_by: utilisateur.user_id,
    },
    { onConflict: 'cle' },
  );
  if (dbError) {
    // Rollback storage si l'écriture BDD a échoué
    await supabase.storage.from(BUCKET).remove([chemin]);
    return { status: 'erreur', message: `update_bdd: ${dbError.message}` };
  }

  // 4. Supprimer l'ancien fichier maintenant que le nouveau est référencé
  if (ancien?.chemin_storage && ancien.chemin_storage.length > 0) {
    await supabase.storage.from(BUCKET).remove([ancien.chemin_storage]);
  }

  revalidatePath('/referentiels');
  revalidatePath('/admin/documents-publics');
  return { status: 'succes' };
}

export async function supprimerDocumentPublic(cle: string): Promise<Resultat> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur) return { status: 'erreur', message: 'non_authentifie' };
  if (utilisateur.role !== 'super_admin' && utilisateur.role !== 'admin_scs') {
    return { status: 'erreur', message: 'reserve_admin' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: actuel } = await supabase
    .from('documents_publics')
    .select('chemin_storage')
    .eq('cle', cle)
    .maybeSingle();

  if (actuel?.chemin_storage && actuel.chemin_storage.length > 0) {
    await supabase.storage.from(BUCKET).remove([actuel.chemin_storage]);
  }

  const { error } = await supabase
    .from('documents_publics')
    .update({
      nom_fichier: '',
      chemin_storage: '',
      url_publique: '',
      taille_octets: 0,
      uploaded_at: new Date().toISOString(),
      uploaded_by: utilisateur.user_id,
    })
    .eq('cle', cle);
  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/referentiels');
  revalidatePath('/admin/documents-publics');
  return { status: 'succes' };
}
