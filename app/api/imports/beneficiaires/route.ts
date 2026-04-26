import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { importerBeneficiairesExcel } from '@/lib/imports/import-beneficiaires';

/**
 * Route Handler d'import Excel bénéficiaires (Étape 7).
 *
 * POST multipart/form-data avec champ `fichier` contenant un .xlsx.
 * Limite 5 MB côté Server Action. Pas de redirect : la réponse JSON
 * contient le rapport complet pour affichage immédiat dans l'UI.
 */
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
  const result = await importerBeneficiairesExcel({
    fichierBuffer: buffer,
    fichierNom: fichier.name,
    fichierTaille: fichier.size,
  });

  return NextResponse.json(result);
}
