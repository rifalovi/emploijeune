import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Lecture publique des documents PDF téléchargeables (note de cadrage, etc.).
 * Source : table `documents_publics` (lecture autorisée à anon via RLS).
 */

export type DocumentPublic = {
  cle: string;
  libelle: string;
  nomFichier: string;
  urlPublique: string;
  tailleOctets: number;
  uploadedAt: string;
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
  };
}

export async function listerDocumentsPublics(): Promise<DocumentPublic[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('documents_publics')
    .select('cle, libelle, nom_fichier, url_publique, taille_octets, uploaded_at')
    .order('cle');

  return (data ?? []).map((d) => ({
    cle: d.cle,
    libelle: d.libelle,
    nomFichier: d.nom_fichier,
    urlPublique: d.url_publique,
    tailleOctets: d.taille_octets,
    uploadedAt: d.uploaded_at,
  }));
}
