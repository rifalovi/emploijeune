'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { revalidatePath } from 'next/cache';
import { structureInsertSchema } from '@/lib/schemas/structure';
import { extraireStructuresAvecIA, type FormatFichier } from './ia-extractor-structures';
import { mapLigneVersStructure } from './mapping-structures';
import type { LigneRapportImport, RapportImportEnrichi, ResultatImportEnrichi } from './types';

/**
 * Orchestrateur IA B1 — miroir de `importerBeneficiairesDepuisIA` pour les
 * structures partenaires.
 *
 * Pipeline :
 *   1. Garde droits + feature flag import_ia
 *   2. extraireStructuresAvecIA() → lignes JSON normalisées + scores confiance
 *   3. Pour chaque ligne : mapLigneVersStructure() + safeParse + INSERT BDD
 *      - Consentement non extractible par IA → défaut `false`, statut `incomplete`
 *      - Champs critiques manquants → statut `rejetee`
 *   4. Audit dans `imports_excel`
 *   5. Retour RapportImportEnrichi standard (5 statuts)
 */

export type ImporterStructuresIAInput = {
  fichierBuffer: ArrayBuffer | Buffer;
  fichierNom: string;
  fichierTaille: number;
  fichierType: FormatFichier;
};

export async function importerStructuresDepuisIA(
  input: ImporterStructuresIAInput,
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

  // 1. Extraction IA — la garde feature flag est intégrée dans extraireStructuresAvecIA
  const extraction = await extraireStructuresAvecIA(
    input.fichierBuffer,
    input.fichierNom,
    input.fichierType,
  );

  if (extraction.status === 'desactive') {
    return { status: 'erreur_droits', message: extraction.message };
  }
  if (extraction.status === 'erreur') {
    return { status: 'erreur_fichier', message: extraction.message };
  }

  if (extraction.lignesExtraites.length === 0) {
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

  // 2. Traiter chaque ligne extraite
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  const lignesRapport: LigneRapportImport[] = [];

  let nbInserees = 0;
  let nbIncompletes = 0;
  let nbRejetees = 0;

  for (let i = 0; i < extraction.lignesExtraites.length; i++) {
    const ligneExtraite = extraction.lignesExtraites[i]!;
    const numLigne = i + 1;
    const donnees = ligneExtraite.donnees;

    // 2a. Mapper les champs via le pipeline B1 classique
    const { donneesParsees, erreursMapping } = mapLigneVersStructure(donnees);

    // Déterminer si le seul problème est le consentement absent (cas IA normal)
    const erreursHorsConsentement = erreursMapping.filter((e) => e.colonne !== 'Consentement *');
    const consentementSeulManquant =
      erreursMapping.length > 0 && erreursHorsConsentement.length === 0;

    if (!donneesParsees && !consentementSeulManquant) {
      // Erreurs bloquantes sur des champs critiques → rejetée
      const ligne: LigneRapportImport = {
        numero_ligne: numLigne,
        statut: 'rejetee',
        mappages_auto: [],
        champs_manquants: erreursMapping.map((e) => e.colonne ?? 'inconnu'),
        champs_mis_a_jour: [],
        alertes: [],
        erreurs: erreursMapping.map((e) => ({
          ligne: numLigne,
          colonne: e.colonne,
          valeur: e.valeur,
          message: e.message,
        })),
        extrait_par_ia: true,
        confiance_ia: ligneExtraite.confiance,
      };
      lignesRapport.push(ligne);
      nbRejetees++;
      continue;
    }

    // 2b. Si seul le consentement manque, on insère avec consentement = false
    //     et on marque comme `incomplete` (à compléter manuellement)
    const donneesAvecConsentement: Record<string, unknown> = {
      ...donnees,
      'Consentement *': false, // défaut IA — ne peut pas extraire le consentement
    };

    const { donneesParsees: donneesFinal } = consentementSeulManquant
      ? mapLigneVersStructure(donneesAvecConsentement)
      : { donneesParsees };

    if (!donneesFinal) {
      // Cas inattendu — rejeter
      const ligne: LigneRapportImport = {
        numero_ligne: numLigne,
        statut: 'rejetee',
        mappages_auto: [],
        champs_manquants: ['Mapping échoué après correction consentement'],
        champs_mis_a_jour: [],
        alertes: [],
        erreurs: [{ ligne: numLigne, colonne: null, valeur: null, message: 'Mapping B1 échoué.' }],
        extrait_par_ia: true,
        confiance_ia: ligneExtraite.confiance,
      };
      lignesRapport.push(ligne);
      nbRejetees++;
      continue;
    }

    // 2c. Validation Zod
    const parse = structureInsertSchema.safeParse(donneesFinal);
    if (!parse.success) {
      const erreurs = parse.error.issues.map((issue) => ({
        ligne: numLigne,
        colonne: issue.path.join('.'),
        valeur: null as string | null,
        message: issue.message,
      }));
      const ligne: LigneRapportImport = {
        numero_ligne: numLigne,
        statut: 'rejetee',
        mappages_auto: [],
        champs_manquants: parse.error.issues.map((i) => i.path.join('.')),
        champs_mis_a_jour: [],
        alertes: [],
        erreurs,
        extrait_par_ia: true,
        confiance_ia: ligneExtraite.confiance,
      };
      lignesRapport.push(ligne);
      nbRejetees++;
      continue;
    }

    // 2d. INSERT BDD
    const { error: insertError } = await adminClient.from('structures').insert({
      ...parse.data,
      source_import: 'ia_v1',
      created_by: utilisateur.user_id,
    } as never);

    if (insertError) {
      const ligne: LigneRapportImport = {
        numero_ligne: numLigne,
        statut: 'rejetee',
        mappages_auto: [],
        champs_manquants: [],
        champs_mis_a_jour: [],
        alertes: [],
        erreurs: [
          {
            ligne: numLigne,
            colonne: null,
            valeur: null,
            message: `INSERT BDD échoué : ${insertError.message}`,
          },
        ],
        extrait_par_ia: true,
        confiance_ia: ligneExtraite.confiance,
      };
      lignesRapport.push(ligne);
      nbRejetees++;
      continue;
    }

    // 2e. Succès
    const statut = consentementSeulManquant ? 'incomplete' : 'inseree';
    const ligne: LigneRapportImport = {
      numero_ligne: numLigne,
      statut,
      mappages_auto: [],
      champs_manquants: consentementSeulManquant ? ['Consentement *'] : [],
      champs_mis_a_jour: [],
      alertes: consentementSeulManquant
        ? [
            "Consentement non extractible depuis un document — valeur par défaut 'Non' enregistrée. À confirmer avec le porteur.",
          ]
        : [],
      erreurs: [],
      donnees_importees: {
        pays: String(donnees['Code pays *'] ?? ''),
        projet: String(donnees['Code projet *'] ?? ''),
      },
      extrait_par_ia: true,
      confiance_ia: ligneExtraite.confiance,
    };
    lignesRapport.push(ligne);
    if (statut === 'inseree') nbInserees++;
    else nbIncompletes++;
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
        nb_lignes_a1: 0,
        nb_lignes_b1: extraction.lignesExtraites.length,
        nb_lignes_inserees: nbInserees + nbIncompletes,
        nb_erreurs: nbRejetees,
        rapport_erreurs: lignesRapport.filter((l) => l.statut === 'rejetee') as unknown as never,
        statut: nbRejetees === 0 ? 'reussi' : nbInserees + nbIncompletes > 0 ? 'partiel' : 'echec',
        termine_a: new Date().toISOString(),
        created_by: utilisateur.user_id,
      } as never)
      .select('id')
      .single();
    importId = imp?.id ?? null;
  } catch {
    /* audit non critique */
  }

  revalidatePath('/structures');
  revalidatePath('/admin/imports');
  revalidatePath('/dashboard');
  revalidatePath('/realisations');

  const rapport: RapportImportEnrichi = {
    fichier_nom: input.fichierNom,
    nb_lignes_total: extraction.lignesExtraites.length,
    nb_inserees: nbInserees,
    nb_enrichies: 0, // pas de détection doublon sur structures pour l'instant
    nb_doublons_identiques: 0,
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
