'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { revalidatePath } from 'next/cache';
import { structureInsertSchema } from '@/lib/schemas/structure';
import { parseExcelFlexible } from './parser-excel-flexible';
import { parseCsv } from './parser-csv';
import { HEADERS_B1, mapLigneVersStructure } from './mapping-structures';
import type { ErreurImport, ResultatImport } from './types';

/**
 * Import en masse de structures depuis un fichier Excel (Étape 7).
 * Pattern miroir d'`importerBeneficiairesExcel`.
 */

export type ImporterStructuresInput = {
  fichierBuffer: ArrayBuffer | Buffer;
  fichierNom: string;
  fichierTaille: number;
  /** Nom de l'onglet à importer (multi-onglets). Si absent, auto-détection. */
  nomOnglet?: string;
  /** Code projet à appliquer par défaut si absent des cellules. */
  codeProjetDefaut?: string;
};

export async function importerStructuresExcel(
  input: ImporterStructuresInput,
): Promise<ResultatImport> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs', 'editeur_projet'].includes(utilisateur.role)) {
    return {
      status: 'erreur_droits',
      message: 'Réservé aux administrateurs SCS et coordonnateurs de projet.',
    };
  }

  if (input.fichierTaille > 5 * 1024 * 1024) {
    return {
      status: 'erreur_fichier',
      message: 'Fichier trop volumineux (max 5 MB). Scindez le fichier.',
    };
  }

  // Parsing flexible : CSV ou Excel selon l'extension, avec sélection d'onglet
  const estCsv = input.fichierNom.toLowerCase().endsWith('.csv');
  const { lignes, erreursStructure } = estCsv
    ? await parseCsv(input.fichierBuffer, HEADERS_B1)
    : await parseExcelFlexible(input.fichierBuffer, HEADERS_B1, input.nomOnglet, 'structures');

  if (erreursStructure.length > 0) {
    return {
      status: 'succes',
      rapport: {
        fichier_nom: input.fichierNom,
        nb_lignes_total: 0,
        nb_lignes_inserees: 0,
        nb_lignes_ignorees: 0,
        erreurs: erreursStructure,
        import_id: null,
        execute_a: new Date().toISOString(),
      },
    };
  }

  const erreurs: ErreurImport[] = [];
  let nbInserees = 0;

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  for (const { numLigne, donnees } of lignes) {
    const { donneesParsees, erreursMapping } = mapLigneVersStructure(donnees);
    if (erreursMapping.length > 0) {
      for (const e of erreursMapping) {
        erreurs.push({ ligne: numLigne, colonne: e.colonne, valeur: e.valeur, message: e.message });
      }
      continue;
    }
    if (!donneesParsees) continue;

    const parse = structureInsertSchema.safeParse(donneesParsees);
    if (!parse.success) {
      for (const issue of parse.error.issues) {
        erreurs.push({
          ligne: numLigne,
          colonne: issue.path.join('.'),
          valeur: null,
          message: issue.message,
        });
      }
      continue;
    }

    const { error: insertError } = await adminClient.from('structures').insert({
      ...parse.data,
      source_import: 'excel_v1',
      created_by: utilisateur.user_id,
    } as never);

    if (insertError) {
      erreurs.push({
        ligne: numLigne,
        colonne: null,
        valeur: null,
        message: `INSERT BDD échoué : ${insertError.message}`,
      });
      continue;
    }
    nbInserees++;
  }

  let importId: string | null = null;
  try {
    const { data: imp } = await supabase
      .from('imports_excel')
      .insert({
        fichier_nom: input.fichierNom,
        fichier_taille_octets: input.fichierTaille,
        version_template: 'V1',
        nb_lignes_a1: 0,
        nb_lignes_b1: lignes.length,
        nb_lignes_inserees: nbInserees,
        nb_erreurs: erreurs.length,
        rapport_erreurs: erreurs as unknown as never,
        statut: erreurs.length === 0 ? 'reussi' : 'partiel',
        termine_a: new Date().toISOString(),
        created_by: utilisateur.user_id,
      } as never)
      .select('id')
      .single();
    importId = imp?.id ?? null;
  } catch {
    // best-effort
  }

  revalidatePath('/structures');
  revalidatePath('/admin/imports');

  return {
    status: 'succes',
    rapport: {
      fichier_nom: input.fichierNom,
      nb_lignes_total: lignes.length,
      nb_lignes_inserees: nbInserees,
      nb_lignes_ignorees: lignes.length - nbInserees,
      erreurs,
      import_id: importId,
      execute_a: new Date().toISOString(),
    },
  };
}
