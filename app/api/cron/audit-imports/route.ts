import { type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Cron job — audit des sessions d'import zombies.
 * Schedule : toutes les 6h (vercel.json).
 * Securise par CRON_SECRET (Vercel Cron injecte le Bearer token).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // Sessions en_cours depuis plus de 30 minutes
  const seuil = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: sessions } = await admin
    .from('import_sessions')
    .select('id, fichier_nom, created_by, created_at')
    .eq('statut', 'en_cours')
    .lt('created_at', seuil);

  if (!sessions || sessions.length === 0) {
    return Response.json({ audit: 'ok', zombies_detectees: 0 });
  }

  // Verifier que chaque session a des lignes orphelines en base
  const zombies: Array<{ id: string; fichier_nom: string; lignes: number }> = [];
  for (const s of sessions) {
    const { count } = await admin
      .from('beneficiaires')
      .select('id', { count: 'exact', head: true })
      .eq('import_session_id', s.id)
      .is('deleted_at', null);
    if (count && count > 0) {
      zombies.push({ id: s.id, fichier_nom: s.fichier_nom, lignes: count });
    }
  }

  if (zombies.length === 0) {
    return Response.json({ audit: 'ok', zombies_detectees: 0 });
  }

  // Creer alerte qualite globale (idempotent par type)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from as any)('alertes_qualite').upsert(
    {
      type: 'import_zombie',
      severite: 'critique',
      message: `${zombies.length} session(s) d'import zombie(s) detectee(s). Voir /super-admin/import-sessions.`,
      statut: 'ouvert',
    },
    { onConflict: 'type', ignoreDuplicates: false },
  );

  // Audit log
  await admin.from('journaux_audit').insert({
    table_affectee: 'import_sessions',
    ligne_id: zombies[0]!.id,
    action: 'UPDATE' as const,
    diff: {
      contexte: 'audit_zombies_cron',
      zombies: zombies.map((z) => z.id),
      count: zombies.length,
    },
    horodatage: new Date().toISOString(),
  } as never);

  return Response.json({
    audit: 'completed',
    zombies_detectees: zombies.length,
    sessions: zombies,
  });
}
