import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { genererRapportExcel, nomFichierRapport } from '@/lib/imports/rapport-excel';
import type { RapportImport } from '@/lib/imports/types';

/**
 * Génère et renvoie le rapport d'import en Excel téléchargeable (Étape 7).
 * POST avec body JSON contenant le RapportImport renvoyé par /api/imports/*.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  await requireUtilisateurValide();

  let rapport: RapportImport;
  try {
    rapport = (await request.json()) as RapportImport;
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide' }, { status: 400 });
  }

  if (!rapport || typeof rapport !== 'object' || !Array.isArray(rapport.erreurs)) {
    return NextResponse.json({ erreur: 'Format de rapport invalide' }, { status: 400 });
  }

  const buffer = await genererRapportExcel(rapport);
  const filename = nomFichierRapport(rapport.fichier_nom || 'import');

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
