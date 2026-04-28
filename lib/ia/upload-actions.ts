'use server';

import { z } from 'zod';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Server Actions — upload de fichiers pour le chat assistant IA — V2.2.1.
 *
 * Formats supportés :
 *   • Texte : .txt, .md, .csv (lecture directe)
 *   • Images : .jpg, .jpeg, .png, .webp (envoi à Claude Vision en base64)
 *   • PDF / DOCX : différé V2.3 (nécessite pdf-parse / mammoth)
 *
 * Limites :
 *   • 10 MB par fichier
 *   • 5 fichiers par message
 *   • Module IA actif requis
 */

const TYPES_TEXTE = new Set(['text/plain', 'text/markdown', 'text/csv']);
const TYPES_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const TAILLE_MAX_OCTETS = 10 * 1024 * 1024; // 10 MB

export type FichierTraite =
  | { type: 'texte'; nom: string; contenu_text: string; taille: number }
  | {
      type: 'image';
      nom: string;
      mime: string;
      base64: string;
      taille: number;
    };

export type ResultatUpload =
  | { status: 'succes'; fichiers: FichierTraite[] }
  | { status: 'erreur'; message: string };

const tailleSchema = z.number().int().positive().max(TAILLE_MAX_OCTETS);

export async function traiterUploadIa(formData: FormData): Promise<ResultatUpload> {
  // Auth + permission module IA
  const utilisateur = await getCurrentUtilisateur({ allowViewAs: true });
  if (!utilisateur) return { status: 'erreur', message: 'Connexion requise.' };

  const supabase = await createSupabaseServerClient();
  const { data: actif } = await supabase.rpc('module_ia_actif_pour_courant');
  if (!actif) return { status: 'erreur', message: 'Module IA non activé pour votre rôle.' };

  // Lecture des fichiers depuis le FormData
  const fichiersBruts = formData.getAll('fichiers').filter((f): f is File => f instanceof File);
  if (fichiersBruts.length === 0) {
    return { status: 'erreur', message: 'Aucun fichier reçu.' };
  }
  if (fichiersBruts.length > 5) {
    return { status: 'erreur', message: 'Maximum 5 fichiers par message.' };
  }

  const fichiers: FichierTraite[] = [];

  for (const fichier of fichiersBruts) {
    // Validation taille
    const tailleParse = tailleSchema.safeParse(fichier.size);
    if (!tailleParse.success) {
      return {
        status: 'erreur',
        message: `Fichier "${fichier.name}" trop volumineux (max 10 MB).`,
      };
    }

    if (TYPES_TEXTE.has(fichier.type) || /\.(txt|md|csv)$/i.test(fichier.name)) {
      // Lecture texte
      const buffer = await fichier.arrayBuffer();
      let contenu = new TextDecoder('utf-8').decode(buffer);
      // Limite raisonnable pour ne pas exploser le contexte Claude
      if (contenu.length > 50_000) {
        contenu = contenu.slice(0, 50_000) + '\n\n[…tronqué à 50 000 caractères…]';
      }
      fichiers.push({
        type: 'texte',
        nom: fichier.name,
        contenu_text: contenu,
        taille: fichier.size,
      });
      continue;
    }

    if (TYPES_IMAGE.has(fichier.type)) {
      // Encodage base64 pour Claude Vision
      const buffer = await fichier.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      fichiers.push({
        type: 'image',
        nom: fichier.name,
        mime: fichier.type,
        base64,
        taille: fichier.size,
      });
      continue;
    }

    if (
      fichier.type === 'application/pdf' ||
      fichier.name.toLowerCase().endsWith('.pdf') ||
      fichier.name.toLowerCase().endsWith('.docx')
    ) {
      return {
        status: 'erreur',
        message: `Format ${fichier.name.split('.').pop()?.toUpperCase()} non supporté en V2.2.1 (PDF/DOCX prévus en V2.3). Veuillez copier-coller le texte directement.`,
      };
    }

    return {
      status: 'erreur',
      message: `Format non supporté : ${fichier.name} (type ${fichier.type}).`,
    };
  }

  return { status: 'succes', fichiers };
}
