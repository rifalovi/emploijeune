import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import {
  extraireIndicateursAvecIA,
  type FormatRapport,
} from '@/lib/imports/ia-extractor-indicateurs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EXT_FORMAT: Record<string, FormatRapport> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
  xlsx: 'xlsx',
  xlsm: 'xlsx',
};

/**
 * Extraction IA des valeurs d'indicateurs (synthèse d'ensemble) depuis un
 * rapport d'enquête. Réservé au super_admin (la saisie manuelle d'indicateurs
 * l'est aussi). Ne fait QUE l'extraction → renvoie un aperçu à valider ;
 * l'enregistrement se fait ensuite via la Server Action dédiée.
 */
export async function POST(request: NextRequest) {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || utilisateur.role !== 'super_admin') {
    return NextResponse.json(
      { erreur: 'Réservé au super_admin (saisie des indicateurs).' },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const fichier = formData.get('fichier');
  if (!(fichier instanceof File)) {
    return NextResponse.json({ erreur: 'Aucun fichier fourni.' }, { status: 400 });
  }

  const ext = fichier.name.toLowerCase().split('.').pop() ?? '';
  const format = EXT_FORMAT[ext];
  if (!format) {
    return NextResponse.json(
      { erreur: 'Formats acceptés : .pdf, .docx, .txt, .xlsx.' },
      { status: 400 },
    );
  }
  if (fichier.size > 10 * 1024 * 1024) {
    return NextResponse.json({ erreur: 'Fichier trop volumineux (max 10 MB).' }, { status: 400 });
  }

  try {
    const buffer = await fichier.arrayBuffer();
    const result = await extraireIndicateursAvecIA(buffer, fichier.name, format);
    if (result.status === 'erreur') {
      return NextResponse.json({ erreur: result.message }, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (erreur) {
    console.error('[api/imports/rapport-indicateurs] échec', {
      nom: fichier.name,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return NextResponse.json(
      { erreur: 'Impossible de traiter le rapport. Vérifiez le format et réessayez.' },
      { status: 500 },
    );
  }
}
