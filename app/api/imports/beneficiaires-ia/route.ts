import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { importerBeneficiairesDepuisIA } from '@/lib/imports/import-beneficiaires-ia';
import type { FormatFichier } from '@/lib/imports/ia-extractor';

/**
 * Route Handler d'import bénéficiaires depuis un document non-structuré
 * (PDF / DOCX / TXT) — Phase 4 du sprint Import IA.
 *
 * Détection du format via l'extension. Le pipeline d'extraction IA
 * (claude-haiku-4-5) est gardé par le feature flag `import_ia` côté serveur.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORMATS_AUTORISES: Record<string, FormatFichier> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
};

export async function POST(request: NextRequest) {
  await requireUtilisateurValide();

  const formData = await request.formData();
  const fichier = formData.get('fichier');
  if (!(fichier instanceof File)) {
    return NextResponse.json(
      { erreur: 'Aucun fichier fourni (champ "fichier" attendu).' },
      { status: 400 },
    );
  }

  const extension = fichier.name.toLowerCase().split('.').pop() ?? '';
  const fichierType = FORMATS_AUTORISES[extension];
  if (!fichierType) {
    return NextResponse.json(
      {
        erreur: `Format ${extension || '?'} non supporté. Formats acceptés : PDF, DOCX, TXT.`,
      },
      { status: 400 },
    );
  }

  // Limite taille : 10 MB max pour les imports IA (parsing + envoi Claude)
  const MAX_SIZE_IA = 10 * 1024 * 1024;
  if (fichier.size > MAX_SIZE_IA) {
    return NextResponse.json(
      { erreur: 'Fichier trop volumineux (max 10 MB). Scindez le document et réimportez.' },
      { status: 400 },
    );
  }

  try {
    const buffer = await fichier.arrayBuffer();
    const result = await importerBeneficiairesDepuisIA({
      fichierBuffer: buffer,
      fichierNom: fichier.name,
      fichierTaille: fichier.size,
      fichierType,
    });
    return NextResponse.json(result);
  } catch (erreur) {
    console.error('[api/imports/beneficiaires-ia] échec extraction IA', {
      fichierNom: fichier.name,
      fichierTaille: fichier.size,
      fichierType,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return NextResponse.json(
      {
        erreur:
          'Impossible de traiter le fichier avec l\'analyse IA. Réessayez ou utilisez le format Excel standard.',
      },
      { status: 500 },
    );
  }
}
