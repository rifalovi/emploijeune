import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * RAG documentaire pour les rapports de l'Atelier : liste les documents de la
 * base documentaire de la plateforme (documents_publics) et en extrait le texte
 * (PDF via unpdf, Word via mammoth, texte brut sinon) pour servir de CONTEXTE de
 * cadrage aux rapports IA — sans jamais en tirer de chiffres.
 */

const BUCKET = 'documents-publics';
const CAP_PAR_DOC = 15000; // caractères max extraits par document
const CAP_TOTAL = 45000; // budget total de contexte documentaire

export type DocumentReference = { cle: string; libelle: string; nomFichier: string };

/** Liste des documents de référence disponibles pour le RAG. */
export async function listerDocumentsReference(): Promise<DocumentReference[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('documents_publics')
    .select('cle, libelle, nom_fichier')
    .order('libelle', { ascending: true });
  if (error || !data) return [];
  return data.map((d) => ({ cle: d.cle, libelle: d.libelle, nomFichier: d.nom_fichier }));
}

function extension(nom: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(nom || '');
  return m ? m[1]!.toLowerCase() : '';
}

async function extraireUnDocument(
  buffer: Buffer,
  nomFichier: string,
  contentType: string,
): Promise<string> {
  const ext = extension(nomFichier);
  const ct = (contentType || '').toLowerCase();
  try {
    if (ext === 'pdf' || ct.includes('pdf')) {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return Array.isArray(text) ? text.join('\n') : text;
    }
    if (ext === 'docx' || ct.includes('officedocument.wordprocessingml')) {
      const mammoth = (await import('mammoth')).default ?? (await import('mammoth'));
      const { value } = await (
        mammoth as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> }
      ).extractRawText({ buffer });
      return value;
    }
    if (['txt', 'csv', 'md', 'json', 'tsv'].includes(ext) || ct.startsWith('text/')) {
      return buffer.toString('utf-8');
    }
  } catch {
    return '';
  }
  return '';
}

/**
 * Extrait et concatène le texte des documents choisis (par `cle`), sous un
 * budget de caractères. Renvoie un bloc de contexte prêt à insérer dans le
 * prompt, ou une chaîne vide si rien n'a pu être extrait.
 */
export async function extraireTexteDocuments(cles: string[]): Promise<string> {
  if (!cles || cles.length === 0) return '';
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('documents_publics')
    .select('cle, libelle, nom_fichier, chemin_storage, content_type')
    .in('cle', cles);
  if (error || !data) return '';

  const blocs: string[] = [];
  let total = 0;
  for (const doc of data) {
    if (total >= CAP_TOTAL) break;
    const { data: blob, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(doc.chemin_storage);
    if (dlErr || !blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    let texte = (await extraireUnDocument(buffer, doc.nom_fichier, doc.content_type)).trim();
    if (!texte) continue;
    texte = texte.replace(/\s+\n/g, '\n').slice(0, Math.min(CAP_PAR_DOC, CAP_TOTAL - total));
    total += texte.length;
    blocs.push(`### Document : ${doc.libelle} (${doc.nom_fichier})\n${texte}`);
  }
  return blocs.join('\n\n');
}
