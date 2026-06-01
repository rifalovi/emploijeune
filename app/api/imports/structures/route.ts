import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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
  const ext = fichier.name.toLowerCase().split('.').pop() ?? '';
  if (!['xlsx', 'xlsm', 'xlsb', 'csv'].includes(ext)) {
    return NextResponse.json(
      { erreur: 'Formats acceptés : .xlsx, .xlsm ou .csv.' },
      { status: 400 },
    );
  }

  try {
    const buffer = await fichier.arrayBuffer();
    const bufNode = Buffer.from(buffer);
    const fichierHash = crypto.createHash('sha256').update(bufNode).digest('hex');

    const force = formData.get('force') === 'true';
    if (!force) {
      const supabase = await createSupabaseServerClient();
      const seuil7j = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recents } = await supabase
        .from('import_sessions')
        .select('id, created_at, created_by')
        .eq('fichier_hash', fichierHash)
        .gte('created_at', seuil7j)
        .neq('statut', 'annule_admin' as never)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recents && recents.length > 0) {
        return NextResponse.json({
          code: 'fichier_deja_importe',
          session_precedente: { id: recents[0]!.id, date: recents[0]!.created_at },
          message: 'Ce fichier semble avoir deja ete importe recemment.',
        }, { status: 409 });
      }
    }

    const nomOnglet = (formData.get('onglet') as string) || undefined;
    const codeProjetDefaut = (formData.get('code_projet_defaut') as string) || undefined;
    const result = await importerStructuresExcel({
      fichierBuffer: buffer,
      fichierNom: fichier.name,
      fichierTaille: fichier.size,
      nomOnglet,
      codeProjetDefaut,
    });
    return NextResponse.json(result);
  } catch (erreur) {
    console.error('[api/imports/structures] échec import Excel', {
      fichierNom: fichier.name,
      fichierTaille: fichier.size,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return NextResponse.json(
      {
        erreur:
          'Impossible de traiter le fichier Excel. Vérifiez le format et réessayez, ou contactez le support.',
      },
      { status: 500 },
    );
  }
}
