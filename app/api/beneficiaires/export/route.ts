import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { beneficiaireFiltersSchema } from '@/lib/schemas/beneficiaire';
import { exporterBeneficiairesExcel } from '@/lib/beneficiaires/export';

/**
 * Route Handler d'export Excel. Préféré à une Server Action pour le retour
 * binaire (Content-Disposition natif, pas de base64 encoding côté client).
 *
 * Sécurité :
 *   - `requireUtilisateurValide` : redirige vers /connexion si pas de session,
 *     ou vers /en-attente-de-validation si statut != 'valide'. La RLS
 *     s'applique ensuite naturellement dans la requête Supabase.
 *   - Les filtres sont validés via `beneficiaireFiltersSchema` (défense en
 *     profondeur — les query params peuvent être manipulés).
 *
 * Cache : `dynamic = 'force-dynamic'` car l'export dépend du user authentifié
 * et des filtres courants.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Garde-fou auth : redirige si non authentifié (Next.js renverra une 307)
  await requireUtilisateurValide();

  const { searchParams } = new URL(request.url);
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const parse = beneficiaireFiltersSchema.safeParse(raw);
  const filters = parse.success ? parse.data : beneficiaireFiltersSchema.parse({});

  try {
    const { buffer, filename, count } = await exporterBeneficiairesExcel(filters);

    const headers = new Headers();
    headers.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    headers.set(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    headers.set('X-Beneficiaires-Count', String(count));
    headers.set('Cache-Control', 'no-store');

    // `buffer` est un ArrayBuffer ; on le coerce en Uint8Array, un BodyInit
    // valide pour NextResponse (fetch accepte ArrayBufferView).
    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ erreur: message }, { status: 500 });
  }
}
