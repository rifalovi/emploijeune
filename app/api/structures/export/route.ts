import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { structureFiltersSchema } from '@/lib/schemas/structure';
import { exporterStructuresExcel } from '@/lib/structures/export';

/**
 * Route Handler d'export Excel B1 (structures). Pattern miroir de
 * `app/api/beneficiaires/export/route.ts` (Étape 4e).
 *
 * Sécurité :
 *   - `requireUtilisateurValide` : redirige vers /connexion si pas de
 *     session, ou vers /en-attente-de-validation si statut != 'valide'.
 *   - La RLS Supabase filtre ensuite naturellement le périmètre.
 *   - Restriction supplémentaire 5e : le bouton n'est visible qu'aux
 *     `admin_scs` côté UI ; côté API on garde la RLS comme barrière de
 *     défense en profondeur (un éditeur projet pourra exporter son propre
 *     périmètre s'il appelle l'URL directement, comportement intentionnel).
 *
 * Cache : `dynamic = 'force-dynamic'` car l'export dépend du user et des
 * filtres courants.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await requireUtilisateurValide();

  const { searchParams } = new URL(request.url);
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const parse = structureFiltersSchema.safeParse(raw);
  const filters = parse.success ? parse.data : structureFiltersSchema.parse({});

  try {
    const { buffer, filename, count } = await exporterStructuresExcel(filters);

    const headers = new Headers();
    headers.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    headers.set(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    headers.set('X-Structures-Count', String(count));
    headers.set('Cache-Control', 'no-store');

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ erreur: message }, { status: 500 });
  }
}
