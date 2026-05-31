import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { listerOngletsExcel } from '@/lib/imports/parser-excel-flexible';

/**
 * POST /api/imports/onglets — liste les onglets d'un fichier Excel.
 *
 * Utilise le module partagé choisir-feuille.ts pour le scoring.
 * Le champ `type` ('beneficiaires' | 'structures') adapte le scoring.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  await requireUtilisateurValide();

  const formData = await request.formData();
  const fichier = formData.get('fichier');
  const typeImport = (formData.get('type') as string) ?? 'beneficiaires';

  if (!(fichier instanceof File)) {
    return NextResponse.json({ erreur: 'Aucun fichier fourni.' }, { status: 400 });
  }

  const ext = fichier.name.toLowerCase().split('.').pop() ?? '';
  if (!['xlsx', 'xlsm', 'xlsb'].includes(ext)) {
    return NextResponse.json(
      { onglets: [], message: 'La détection multi-onglets est réservée aux fichiers Excel.' },
    );
  }

  const buffer = await fichier.arrayBuffer();
  const type = typeImport === 'structures' ? 'structures' as const : 'beneficiaires' as const;
  const { onglets, erreur } = await listerOngletsExcel(buffer, type);

  if (erreur) {
    return NextResponse.json({ erreur }, { status: 400 });
  }

  return NextResponse.json({ onglets });
}
