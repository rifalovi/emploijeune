'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { revalidatePath } from 'next/cache';
import { beneficiaireInsertSchema } from '@/lib/schemas/beneficiaire';
import { parseExcel } from './parser-excel';
import {
  HEADERS_A1,
  HEADERS_A1_OBLIGATOIRES,
  mapLigneVersBeneficiaire,
} from './mapping-beneficiaires';
import type { ErreurImport, ResultatImport } from './types';

/**
 * Import en masse de bénéficiaires depuis un fichier Excel (Étape 7).
 *
 * Pipeline (par ligne du fichier) :
 *   1. Parsing Excel via `parseExcel` (en-têtes obligatoires vérifiés)
 *   2. Mapping libellé/code → champs métier (`mapLigneVersBeneficiaire`)
 *   3. Validation Zod (`beneficiaireInsertSchema` — règles RGPD comprises)
 *   4. INSERT individuel via service_role (RLS bypass — admin gère)
 *   5. Erreurs accumulées par ligne avec colonne fautive
 *
 * Stratégie « tolérante » V1 : un échec sur une ligne N N'INTERROMPT PAS
 * les autres. Le rapport final liste tout (succès + erreurs) pour
 * permettre à l'admin de retravailler le fichier source.
 *
 * Audit : ligne dans `public.imports_excel` avec compteurs + détail JSONB.
 */

export type ImporterBeneficiairesInput = {
  fichierBuffer: ArrayBuffer | Buffer;
  fichierNom: string;
  fichierTaille: number;
};

export async function importerBeneficiairesExcel(
  input: ImporterBeneficiairesInput,
): Promise<ResultatImport> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['admin_scs', 'editeur_projet'].includes(utilisateur.role)) {
    return {
      status: 'erreur_droits',
      message: 'Réservé aux administrateurs SCS et coordonnateurs de projet.',
    };
  }

  if (input.fichierTaille > 5 * 1024 * 1024) {
    return {
      status: 'erreur_fichier',
      message: 'Fichier trop volumineux (max 5 MB). Scindez le fichier en plusieurs imports.',
    };
  }

  // 1. Parsing Excel
  const { lignes, erreursStructure } = await parseExcel(
    input.fichierBuffer,
    HEADERS_A1,
    HEADERS_A1_OBLIGATOIRES,
  );

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

  // 2-4. Pour chaque ligne : mapping + Zod + INSERT
  for (const { numLigne, donnees } of lignes) {
    const { donneesParsees, erreursMapping } = mapLigneVersBeneficiaire(donnees);
    if (erreursMapping.length > 0) {
      for (const e of erreursMapping) {
        erreurs.push({ ligne: numLigne, colonne: e.colonne, valeur: e.valeur, message: e.message });
      }
      continue;
    }
    if (!donneesParsees) continue;

    const parse = beneficiaireInsertSchema.safeParse(donneesParsees);
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

    // INSERT avec service_role (admin a déjà été vérifié + RLS contournée
    // pour permettre import multi-organisations)
    const { error: insertError } = await adminClient.from('beneficiaires').insert({
      ...parse.data,
      // Defaults manquants pour Insert
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

  // 5. Audit dans imports_excel
  let importId: string | null = null;
  try {
    const { data: imp } = await supabase
      .from('imports_excel')
      .insert({
        fichier_nom: input.fichierNom,
        fichier_taille_octets: input.fichierTaille,
        version_template: 'V1',
        nb_lignes_a1: lignes.length,
        nb_lignes_b1: 0,
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
    // Audit best-effort
  }

  revalidatePath('/beneficiaires');
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
