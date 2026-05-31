import { NextResponse, type NextRequest } from 'next/server';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { listerOngletsExcel } from '@/lib/imports/parser-excel-flexible';
import { HEADERS_B1 } from '@/lib/imports/mapping-structures';

/**
 * POST /api/imports/onglets — liste les onglets d'un fichier Excel.
 *
 * Retourne le nom, nombre de lignes/colonnes et score de pertinence
 * pour chaque onglet. Permet à l'UI d'afficher un dropdown de sélection
 * avant de lancer l'import réel.
 *
 * Le body contient le fichier en multipart + un champ `type` optionnel
 * ('beneficiaires' | 'structures') pour adapter le scoring.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// En-têtes attendus pour les bénéficiaires (même constante que dans import-beneficiaires.ts)
const HEADERS_BENEFICIAIRES = [
  'Code projet *',
  'Code pays bénéficiaire *',
  'Prénom *',
  'Nom *',
  'Sexe *',
  'Domaine de formation *',
  'Modalité *',
  'Année de la formation *',
  'Statut *',
  'Consentement *',
  'Courriel',
  'Téléphone (avec indicatif)',
  "Partenaire d'accompagnement",
  'Fonction / Statut actuel',
  "Tranche d'âge déclarée",
] as const;

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
  const headers = typeImport === 'structures' ? HEADERS_B1 : HEADERS_BENEFICIAIRES;
  const typeParam = typeImport === 'structures' ? 'structures' as const : 'beneficiaires' as const;
  const { onglets, erreur } = await listerOngletsExcel(buffer, headers, typeParam);

  if (erreur) {
    return NextResponse.json({ erreur }, { status: 400 });
  }

  return NextResponse.json({ onglets });
}
