import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Lecture publique des documents PDF téléchargeables (note de cadrage, etc.).
 * Source : table `documents_publics` (lecture autorisée à anon via RLS).
 */

/**
 * Slots "protégés" — utilisés en dur dans des pages spécifiques (note_cadrage
 * sur /referentiels). On peut remplacer/vider leur fichier mais pas supprimer
 * la ligne définitivement. Doit rester synchronisé avec SLOTS_PROTEGES dans
 * lib/documents-publics/server-actions.ts.
 */
export const SLOTS_PROTEGES = new Set(['note_cadrage']);

export function estSlotProtege(cle: string): boolean {
  return SLOTS_PROTEGES.has(cle);
}

export type DocumentPublic = {
  cle: string;
  libelle: string;
  nomFichier: string;
  urlPublique: string;
  tailleOctets: number;
  uploadedAt: string;
  protege: boolean;
};

export async function getDocumentPublic(cle: string): Promise<DocumentPublic | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('documents_publics')
    .select('cle, libelle, nom_fichier, url_publique, taille_octets, uploaded_at')
    .eq('cle', cle)
    .maybeSingle();

  if (!data || !data.url_publique) return null;

  return {
    cle: data.cle,
    libelle: data.libelle,
    nomFichier: data.nom_fichier,
    urlPublique: data.url_publique,
    tailleOctets: data.taille_octets,
    uploadedAt: data.uploaded_at,
    protege: estSlotProtege(data.cle),
  };
}

/**
 * Liste tous les documents (protégés en premier, puis libres par date desc).
 * Utilisé par l'admin pour afficher la bibliothèque complète.
 */
export async function listerDocumentsPublics(): Promise<DocumentPublic[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('documents_publics')
    .select('cle, libelle, nom_fichier, url_publique, taille_octets, uploaded_at')
    .order('uploaded_at', { ascending: false });

  const docs = (data ?? []).map((d) => ({
    cle: d.cle,
    libelle: d.libelle,
    nomFichier: d.nom_fichier,
    urlPublique: d.url_publique,
    tailleOctets: d.taille_octets,
    uploadedAt: d.uploaded_at,
    protege: estSlotProtege(d.cle),
  }));

  // Slots protégés en tête (ordre stable), puis libres triés par upload desc.
  return [...docs.filter((d) => d.protege), ...docs.filter((d) => !d.protege)];
}

/**
 * Liste les documents UPLOADÉS (avec un fichier non vide) — pour la
 * bibliothèque publique /documents. Pas de slots vides ni masqués.
 */
export async function listerDocumentsPublicsAvecFichier(): Promise<DocumentPublic[]> {
  const tous = await listerDocumentsPublics();
  return tous.filter((d) => d.urlPublique.length > 0);
}
