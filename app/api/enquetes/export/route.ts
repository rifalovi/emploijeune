import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { enqueteFiltersSchema } from '@/lib/schemas/enquetes/schemas';
import { exporterEnquetesExcel } from '@/lib/enquetes/export';

/**
 * Route Handler d'export Excel des enquêtes (Étape 6f). Pattern miroir
 * de /api/structures/export et /api/beneficiaires/export.
 *
 * Sécurité : RLS Supabase appliquée naturellement (chaque rôle ne voit
 * que son périmètre). Côté UI, le bouton est visible admin_scs uniquement.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await requireUtilisateurValide();

  const { searchParams } = new URL(request.url);
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const parse = enqueteFiltersSchema.safeParse(raw);
  const filters = parse.success ? parse.data : enqueteFiltersSchema.parse({});

  try {
    const { buffer, filename, count } = await exporterEnquetesExcel(filters);

    const headers = new Headers();
    headers.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    headers.set(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    headers.set('X-Enquetes-Count', String(count));
    headers.set('Cache-Control', 'no-store');

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ erreur: message }, { status: 500 });
  }
}
