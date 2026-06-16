import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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
  // Accepter .xlsx ET .xlsm (macro-enabled Excel — format envoyé par les
  // coordonnateurs OIF, ex. « Base de sondage P6 »). Les deux formats sont
  // identiques structurellement (ZIP + XML) et lus par openpyxl / exceljs.
  const extFichier = fichier.name.toLowerCase().split('.').pop() ?? '';
  if (!['xlsx', 'xlsm', 'xlsb', 'csv'].includes(extFichier)) {
    return NextResponse.json(
      { erreur: 'Formats acceptés : .xlsx, .xlsm ou .csv.' },
      { status: 400 },
    );
  }

  // Vérification du type MIME côté serveur (en plus de l'extension).
  const MIME_TYPES_ACCEPTES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel.sheet.macroenabled.12', // .xlsm (minuscules — Chrome/macOS)
    'application/vnd.ms-excel.sheet.macroenabled.12'.replace('macroenabled', 'macroEnabled'), // .xlsm (casse mixte)
    'application/vnd.ms-excel.sheet.binary.macroenabled.12', // .xlsb
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12', // .xlsb (casse mixte)
    'text/csv', // .csv
    'text/plain', // certains OS classent les .csv en text/plain
    'application/octet-stream', // certains navigateurs/OS envoient ce type générique
    'application/zip', // xlsx/xlsm sont des zips — accepté comme fallback
    '', // type vide (certains OS)
  ];
  const mimeNormalise = fichier.type.toLowerCase();
  if (fichier.type && !MIME_TYPES_ACCEPTES.map((m) => m.toLowerCase()).includes(mimeNormalise)) {
    return NextResponse.json(
      {
        erreur: `Type MIME non accepté : ${fichier.type}. Formats acceptés : .xlsx, .xlsm ou .csv.`,
      },
      { status: 400 },
    );
  }

  // Limite taille côté API (double vérification — aussi dans la Server Action)
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (fichier.size > MAX_SIZE) {
    return NextResponse.json({ erreur: 'Fichier trop volumineux (max 10 MB).' }, { status: 400 });
  }

  try {
    const buffer = await fichier.arrayBuffer();
    const bufNode = Buffer.from(buffer);
    const fichierHash = crypto.createHash('sha256').update(bufNode).digest('hex');

    // Anti-doublon : vérifier si ce fichier a été importé dans les 7 derniers jours
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
        return NextResponse.json(
          {
            code: 'fichier_deja_importe',
            session_precedente: {
              id: recents[0]!.id,
              date: recents[0]!.created_at,
            },
            message: 'Ce fichier semble avoir deja ete importe recemment.',
          },
          { status: 409 },
        );
      }
    }

    const nomOnglet = (formData.get('onglet') as string) || undefined;
    const codeProjetDefaut = (formData.get('code_projet_defaut') as string) || undefined;
    const forcerDoublons = formData.get('force_doublons') === 'true';
    const result = await importerBeneficiairesExcel({
      fichierBuffer: buffer,
      fichierNom: fichier.name,
      fichierTaille: fichier.size,
      fichierHash,
      nomOnglet,
      codeProjetDefaut,
      forcerDoublons,
    });
    return NextResponse.json(result);
  } catch (erreur) {
    console.error('[api/imports/beneficiaires] échec import Excel', {
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
