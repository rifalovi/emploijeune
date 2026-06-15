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
  /** Hash SHA-256 du fichier (pour la session d'import). */
  fichierHash?: string;
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

  if (input.fichierTaille > 10 * 1024 * 1024) {
    return {
      status: 'erreur_fichier',
      message: 'Fichier trop volumineux (max 10 MB). Scindez le fichier.',
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
  let nbDoublons = 0;

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  // Session d'import (best-effort) : permet l'annulation/rollback ultérieure.
  // Chaque structure insérée est taguée avec import_session_id.
  let importSessionId: string | null = null;
  const rollbackExpireAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data: session } = await adminClient
      .from('import_sessions')
      .insert({
        fichier_nom: input.fichierNom,
        fichier_hash: input.fichierHash ?? null,
        statut: 'en_cours',
        peut_rollback: true,
        rollback_expire_at: rollbackExpireAt,
        created_by: utilisateur.user_id,
      } as never)
      .select('id')
      .single();
    importSessionId = (session as { id: string } | null)?.id ?? null;
  } catch {
    // import_sessions absent du schéma (dev/staging non migré) → sans rollback
  }

  // Traitement CONCURRENT par tranches — évite le timeout Vercel sur les
  // fichiers de plusieurs centaines de lignes (avant : insertions séquentielles
  // ≈ 100 ms/ligne → 582 lignes ≈ 60 s, à la limite du timeout).
  type ResultatLigne =
    | { statut: 'inseree' }
    | { statut: 'doublon' }
    | { statut: 'rejetee'; erreurs: ErreurImport[] };

  const traiterLigneStructure = async (
    numLigne: number,
    donnees: Record<string, unknown>,
  ): Promise<ResultatLigne> => {
    const { donneesParsees, erreursMapping } = mapLigneVersStructure(donnees, {
      tolerant: true,
      codeProjetDefaut: input.codeProjetDefaut,
    });
    if (erreursMapping.length > 0) {
      return {
        statut: 'rejetee',
        erreurs: erreursMapping.map((e) => ({
          ligne: numLigne,
          colonne: e.colonne,
          valeur: e.valeur,
          message: e.message,
        })),
      };
    }
    if (!donneesParsees) return { statut: 'rejetee', erreurs: [] };

    const parse = structureInsertSchema.safeParse(donneesParsees);
    if (!parse.success) {
      return {
        statut: 'rejetee',
        erreurs: parse.error.issues.map((issue) => ({
          ligne: numLigne,
          colonne: issue.path.join('.'),
          valeur: null,
          message: issue.message,
        })),
      };
    }

    const { error: insertError } = await adminClient.from('structures').insert({
      ...parse.data,
      source_import: 'excel_v1',
      created_by: utilisateur.user_id,
      ...(importSessionId ? { import_session_id: importSessionId } : {}),
    } as never);

    if (insertError) {
      // Violation de contrainte unique (23505) = structure déjà présente
      // (même nom + pays + projet). Pas une erreur : doublon ignoré.
      if (
        (insertError as { code?: string }).code === '23505' ||
        /duplicate key|idx_structures_dedoublonnage/i.test(insertError.message)
      ) {
        return { statut: 'doublon' };
      }
      return {
        statut: 'rejetee',
        erreurs: [
          {
            ligne: numLigne,
            colonne: null,
            valeur: null,
            message: `INSERT BDD échoué : ${insertError.message}`,
          },
        ],
      };
    }
    return { statut: 'inseree' };
  };

  const CONCURRENCE = 25;
  for (let i = 0; i < lignes.length; i += CONCURRENCE) {
    const tranche = lignes.slice(i, i + CONCURRENCE);
    const resultats = await Promise.all(
      tranche.map((l) => traiterLigneStructure(l.numLigne, l.donnees)),
    );
    for (const r of resultats) {
      if (r.statut === 'inseree') nbInserees++;
      else if (r.statut === 'doublon') nbDoublons++;
      else erreurs.push(...r.erreurs);
    }
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

  // Finaliser la session d'import (compteurs + statut). Si rien n'a été
  // inséré, la session reste sans lignes liées → annulation sans effet.
  if (importSessionId) {
    try {
      await adminClient
        .from('import_sessions')
        .update({
          statut: 'complete',
          nb_inserees: nbInserees,
          nb_doublons: nbDoublons,
          nb_rejetees: erreurs.length,
          peut_rollback: nbInserees > 0,
        } as never)
        .eq('id', importSessionId);
    } catch {
      // best-effort
    }
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
      nb_doublons: nbDoublons,
      erreurs,
      import_id: importId,
      import_session_id: nbInserees > 0 ? importSessionId : null,
      rollback_expire_at: nbInserees > 0 ? rollbackExpireAt : null,
      execute_a: new Date().toISOString(),
    },
  };
}
