'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { readServerEnv } from '@/lib/supabase/env';

/**
 * Server actions — gestion des documents PDF publics téléchargeables.
 * Réservé admin_scs + super_admin.
 *
 * Deux familles de documents :
 *   • Slots protégés (cle dans SLOTS_PROTEGES) — utilisés en dur sur des
 *     pages spécifiques (ex. `note_cadrage` sur /referentiels). On peut
 *     remplacer/vider leur fichier mais pas supprimer la ligne.
 *   • Documents libres — créés depuis l'UI admin, apparaissent dans la
 *     bibliothèque publique /documents. Supprimables définitivement.
 */

type Resultat = { status: 'succes'; cle?: string } | { status: 'erreur'; message: string };

const BUCKET = 'documents-publics';
const TAILLE_MAX_OCTETS = 20 * 1024 * 1024; // 20 Mo
const SLOTS_PROTEGES = new Set(['note_cadrage']);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function exigerAdmin() {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur) return { erreur: 'non_authentifie' as const };
  if (utilisateur.role !== 'super_admin' && utilisateur.role !== 'admin_scs') {
    return { erreur: 'reserve_admin' as const };
  }
  return { utilisateur };
}

function slugifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function nomFichierStorage(nomFichier: string): string {
  return nomFichier
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function decoderBase64(b64: string, tailleAttendue: number): Buffer | null {
  try {
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length === 0 || buffer.length !== tailleAttendue) return null;
    return buffer;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// uploaderDocumentPublic — remplace le fichier d'un slot existant
// ─────────────────────────────────────────────────────────────────────────────

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
  const garde = await exigerAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur ?? 'erreur_auth' };

  const parsed = uploadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 'erreur',
      message: `payload_invalide: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    };
  }

  const buffer = decoderBase64(parsed.data.fichierBase64, parsed.data.taille);
  if (!buffer) return { status: 'erreur', message: 'taille_incoherente' };

  const chemin = `${parsed.data.cle}/${Date.now()}-${nomFichierStorage(parsed.data.nomFichier)}`;
  const env = readServerEnv();
  const supabase = createSupabaseAdminClient();

  const { data: ancien } = await supabase
    .from('documents_publics')
    .select('chemin_storage')
    .eq('cle', parsed.data.cle)
    .maybeSingle();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(chemin, buffer, {
    contentType: parsed.data.contentType,
    upsert: false,
    cacheControl: '3600',
  });
  if (uploadError) {
    return { status: 'erreur', message: `upload_storage: ${uploadError.message}` };
  }

  const urlPublique = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${chemin}`;

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
      uploaded_by: garde.utilisateur.user_id,
    },
    { onConflict: 'cle' },
  );
  if (dbError) {
    await supabase.storage.from(BUCKET).remove([chemin]);
    return { status: 'erreur', message: `update_bdd: ${dbError.message}` };
  }

  if (ancien?.chemin_storage && ancien.chemin_storage.length > 0) {
    await supabase.storage.from(BUCKET).remove([ancien.chemin_storage]);
  }

  revalidatePath('/referentiels');
  revalidatePath('/documents');
  revalidatePath('/admin/documents-publics');
  return { status: 'succes' };
}

// ─────────────────────────────────────────────────────────────────────────────
// ajouterDocument — crée un nouveau slot (auto-cle) avec son fichier
// ─────────────────────────────────────────────────────────────────────────────

const ajoutSchema = z.object({
  libelle: z.string().trim().min(3).max(200),
  nomFichier: z.string().trim().min(1).max(255),
  contentType: z.literal('application/pdf'),
  taille: z.number().int().positive().max(TAILLE_MAX_OCTETS),
  fichierBase64: z.string().min(1),
});

export async function ajouterDocument(payload: {
  libelle: string;
  nomFichier: string;
  contentType: string;
  taille: number;
  fichierBase64: string;
}): Promise<Resultat> {
  const garde = await exigerAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur ?? 'erreur_auth' };

  const parsed = ajoutSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 'erreur',
      message: `payload_invalide: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    };
  }

  const buffer = decoderBase64(parsed.data.fichierBase64, parsed.data.taille);
  if (!buffer) return { status: 'erreur', message: 'taille_incoherente' };

  // Clé auto-générée : slug du libellé + horodatage court (collision quasi impossible)
  const slugLibelle = slugifier(parsed.data.libelle) || 'document';
  const cle = `${slugLibelle}_${Date.now().toString(36)}`;

  const chemin = `${cle}/${Date.now()}-${nomFichierStorage(parsed.data.nomFichier)}`;
  const env = readServerEnv();
  const supabase = createSupabaseAdminClient();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(chemin, buffer, {
    contentType: parsed.data.contentType,
    upsert: false,
    cacheControl: '3600',
  });
  if (uploadError) {
    return { status: 'erreur', message: `upload_storage: ${uploadError.message}` };
  }

  const urlPublique = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${chemin}`;

  const { error: dbError } = await supabase.from('documents_publics').insert({
    cle,
    libelle: parsed.data.libelle,
    nom_fichier: parsed.data.nomFichier,
    chemin_storage: chemin,
    url_publique: urlPublique,
    taille_octets: parsed.data.taille,
    content_type: parsed.data.contentType,
    uploaded_at: new Date().toISOString(),
    uploaded_by: garde.utilisateur.user_id,
  });
  if (dbError) {
    await supabase.storage.from(BUCKET).remove([chemin]);
    return { status: 'erreur', message: `insert_bdd: ${dbError.message}` };
  }

  revalidatePath('/documents');
  revalidatePath('/admin/documents-publics');
  return { status: 'succes', cle };
}

// ─────────────────────────────────────────────────────────────────────────────
// renommerDocument — change uniquement le libellé
// ─────────────────────────────────────────────────────────────────────────────

const renommeSchema = z.object({
  cle: z.string().trim().min(1).max(64),
  libelle: z.string().trim().min(3).max(200),
});

export async function renommerDocument(payload: {
  cle: string;
  libelle: string;
}): Promise<Resultat> {
  const garde = await exigerAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur ?? 'erreur_auth' };

  const parsed = renommeSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('documents_publics')
    .update({ libelle: parsed.data.libelle })
    .eq('cle', parsed.data.cle);
  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/referentiels');
  revalidatePath('/documents');
  revalidatePath('/admin/documents-publics');
  return { status: 'succes' };
}

// ─────────────────────────────────────────────────────────────────────────────
// viderDocument — efface le fichier mais conserve le slot (vide).
//                 Utilisé pour les slots protégés (note_cadrage).
// ─────────────────────────────────────────────────────────────────────────────

export async function viderDocument(cle: string): Promise<Resultat> {
  const garde = await exigerAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur ?? 'erreur_auth' };

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
      uploaded_by: garde.utilisateur.user_id,
    })
    .eq('cle', cle);
  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/referentiels');
  revalidatePath('/documents');
  revalidatePath('/admin/documents-publics');
  return { status: 'succes' };
}

// Alias rétro-compatible (anciennement appelé supprimerDocumentPublic).
export async function supprimerDocumentPublic(cle: string): Promise<Resultat> {
  return viderDocument(cle);
}

// ─────────────────────────────────────────────────────────────────────────────
// supprimerDocumentDefinitif — supprime la ligne + le fichier.
//                              Bloqué pour les slots protégés.
// ─────────────────────────────────────────────────────────────────────────────

export async function supprimerDocumentDefinitif(cle: string): Promise<Resultat> {
  const garde = await exigerAdmin();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur ?? 'erreur_auth' };

  if (SLOTS_PROTEGES.has(cle)) {
    return {
      status: 'erreur',
      message: 'slot_protege_utiliser_vider',
    };
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

  const { error } = await supabase.from('documents_publics').delete().eq('cle', cle);
  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/documents');
  revalidatePath('/admin/documents-publics');
  return { status: 'succes' };
}
