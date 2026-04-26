import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { importerStructuresExcel } from '@/lib/imports/import-structures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  if (!fichier.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json(
      { erreur: 'Seuls les fichiers .xlsx sont acceptés.' },
      { status: 400 },
    );
  }

  const buffer = await fichier.arrayBuffer();
  const result = await importerStructuresExcel({
    fichierBuffer: buffer,
    fichierNom: fichier.name,
    fichierTaille: fichier.size,
  });

  return NextResponse.json(result);
}
