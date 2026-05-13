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
  // Accepter .xlsx ET .xlsm (macro-enabled Excel — format envoyé par les
  // coordonnateurs OIF, ex. « Base de sondage P6 »). Les deux formats sont
  // identiques structurellement (ZIP + XML) et lus par openpyxl / exceljs.
  const extFichier = fichier.name.toLowerCase().split('.').pop() ?? '';
  if (!['xlsx', 'xlsm', 'xlsb'].includes(extFichier)) {
    return NextResponse.json(
      { erreur: 'Seuls les fichiers .xlsx et .xlsm sont acceptés.' },
      { status: 400 },
    );
  }

  // Vérification du type MIME côté serveur (en plus de l'extension).
  // Normalisation en minuscules : certains navigateurs/OS envoient
  // "macroenabled" (tout minuscule) au lieu de "macroEnabled" — la
  // comparaison doit être insensible à la casse.
  const MIME_TYPES_ACCEPTES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel.sheet.macroenabled.12', // .xlsm (minuscules — Chrome/macOS)
    'application/vnd.ms-excel.sheet.macroenabled.12'.replace('macroenabled', 'macroEnabled'), // .xlsm (casse mixte — spec officielle)
    'application/vnd.ms-excel.sheet.binary.macroenabled.12', // .xlsb
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12', // .xlsb (casse mixte)
    'application/octet-stream', // certains navigateurs/OS envoient ce type générique
    'application/zip', // xlsx/xlsm sont des zips — accepté comme fallback
    '', // type vide (certains OS)
  ];
  const mimeNormalise = fichier.type.toLowerCase();
  if (fichier.type && !MIME_TYPES_ACCEPTES.map((m) => m.toLowerCase()).includes(mimeNormalise)) {
    return NextResponse.json(
      {
        erreur: `Type MIME non accepté : ${fichier.type}. Utilisez un fichier .xlsx ou .xlsm valide.`,
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
    const result = await importerBeneficiairesExcel({
      fichierBuffer: buffer,
      fichierNom: fichier.name,
      fichierTaille: fichier.size,
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
