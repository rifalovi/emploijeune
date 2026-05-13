'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { revalidatePath } from 'next/cache';
import { extraireAvecIA, type FormatFichier } from './ia-extractor';
import { traiterLigneImport } from './import-beneficiaires';
import type { LigneRapportImport, RapportImportEnrichi, ResultatImportEnrichi } from './types';

/**
 * Phase 4 du sprint Import IA — orchestration extraction PDF/DOCX/TXT
 * puis injection dans le pipeline d'import classique.
 *
 * Pipeline :
 *   1. Garde droits + feature flag import_ia
 *   2. extraireAvecIA() → JSON structuré + score de confiance par ligne
 *   3. Pour chaque ligne extraite : traiterLigneImport() avec marquage
 *      `extrait_par_ia = true` + report de la confiance IA
 *   4. Audit dans imports_excel comme l'import classique
 *   5. Retour RapportImportEnrichi standard avec les badges IA
 *
 * Les lignes extraites sont passées dans le MÊME pipeline tolérant que
 * l'import Excel — détection de doublons, fusion, normalisation, etc.
 * Le module IA n'est qu'une **source alternative** de lignes.
 */

export type ImporterBeneficiairesIAInput = {
  fichierBuffer: ArrayBuffer | Buffer;
  fichierNom: string;
  fichierTaille: number;
  fichierType: FormatFichier;
};

export async function importerBeneficiairesDepuisIA(
  input: ImporterBeneficiairesIAInput,
): Promise<ResultatImportEnrichi> {
  // 0. Droits + flag
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs', 'editeur_projet'].includes(utilisateur.role)) {
    return {
      status: 'erreur_droits',
      message: 'Réservé aux administrateurs SCS, super_admin et coordonnateurs de projet.',
    };
  }

  if (input.fichierTaille > 5 * 1024 * 1024) {
    return {
      status: 'erreur_fichier',
      message: 'Fichier trop volumineux (max 5 MB).',
    };
  }

  // 1. Extraction IA — la garde feature flag est intégrée dans extraireAvecIA
  const extraction = await extraireAvecIA(input.fichierBuffer, input.fichierNom, input.fichierType);

  if (extraction.status === 'desactive') {
    return { status: 'erreur_droits', message: extraction.message };
  }
  if (extraction.status === 'erreur') {
    return { status: 'erreur_fichier', message: extraction.message };
  }

  if (extraction.lignesExtraites.length === 0) {
    // Pas un échec, juste un fichier vide d'un point de vue IA
    return {
      status: 'succes',
      rapport: {
        fichier_nom: input.fichierNom,
        nb_lignes_total: 0,
        nb_inserees: 0,
        nb_enrichies: 0,
        nb_doublons_identiques: 0,
        nb_incompletes: 0,
        nb_rejetees: 0,
        headers_mappes_auto: {},
        headers_non_reconnus: [],
        lignes: [],
        import_id: null,
        import_session_id: null,
        rollback_expire_at: null,
        execute_a: new Date().toISOString(),
      },
    };
  }

  // 2. Traiter chaque ligne extraite via le pipeline classique
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  const lignesRapport: LigneRapportImport[] = [];

  let nbInserees = 0;
  let nbEnrichies = 0;
  let nbDoublonsIdentiques = 0;
  let nbIncompletes = 0;
  let nbRejetees = 0;

  for (let i = 0; i < extraction.lignesExtraites.length; i++) {
    const ligneExtraite = extraction.lignesExtraites[i]!;
    const ligneInfo = await traiterLigneImport({
      numLigne: i + 1, // numérotation séquentielle (pas de ligne Excel)
      donnees: ligneExtraite.donnees,
      adminClient,
      createdBy: utilisateur.user_id,
      extraitParIA: true,
      confianceIA: ligneExtraite.confiance,
    });
    lignesRapport.push(ligneInfo);

    switch (ligneInfo.statut) {
      case 'inseree':
        nbInserees++;
        break;
      case 'enrichie':
        nbEnrichies++;
        break;
      case 'doublon_identique':
        nbDoublonsIdentiques++;
        break;
      case 'incomplete':
        nbIncompletes++;
        break;
      case 'rejetee':
        nbRejetees++;
        break;
    }
  }

  // 3. Audit (best-effort)
  let importId: string | null = null;
  try {
    const { data: imp } = await supabase
      .from('imports_excel')
      .insert({
        fichier_nom: input.fichierNom,
        fichier_taille_octets: input.fichierTaille,
        version_template: `IA_${input.fichierType.toUpperCase()}`,
        nb_lignes_a1: extraction.lignesExtraites.length,
        nb_lignes_b1: 0,
        nb_lignes_inserees: nbInserees + nbEnrichies + nbIncompletes,
        nb_erreurs: nbRejetees,
        rapport_erreurs: lignesRapport.filter((l) => l.statut === 'rejetee') as unknown as never,
        statut: nbRejetees === 0 ? 'reussi' : nbInserees + nbEnrichies > 0 ? 'partiel' : 'echec',
        termine_a: new Date().toISOString(),
        created_by: utilisateur.user_id,
      } as never)
      .select('id')
      .single();
    importId = imp?.id ?? null;
  } catch {
    /* audit non critique */
  }

  revalidatePath('/beneficiaires');
  revalidatePath('/admin/imports');

  const rapport: RapportImportEnrichi = {
    fichier_nom: input.fichierNom,
    nb_lignes_total: extraction.lignesExtraites.length,
    nb_inserees: nbInserees,
    nb_enrichies: nbEnrichies,
    nb_doublons_identiques: nbDoublonsIdentiques,
    nb_incompletes: nbIncompletes,
    nb_rejetees: nbRejetees,
    headers_mappes_auto: {},
    headers_non_reconnus: [],
    lignes: lignesRapport,
    import_id: importId,
    import_session_id: null,
    rollback_expire_at: null,
    execute_a: new Date().toISOString(),
  };

  return { status: 'succes', rapport };
}
