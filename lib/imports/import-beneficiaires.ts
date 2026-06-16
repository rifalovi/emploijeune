'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { revalidatePath } from 'next/cache';
import { beneficiaireImportSchema } from '@/lib/schemas/beneficiaire';
import { parseExcelFlexible } from './parser-excel-flexible';
import { parseCsv } from './parser-csv';
import {
  normaliserCodeProjet,
  normaliserCodePays,
  normaliserSexe,
  normaliserDomaineFormation,
  normaliserModalite,
  normaliserStatut,
  normaliserConsentement,
  fusionnerBeneficiaires,
} from './smart-mapper';
import { resoudreTrancheAge } from './tranche-age-resolver';
import { PROJETS_CODES } from '@/lib/schemas/nomenclatures';
import type {
  ChampComparaison,
  ComparaisonDoublon,
  LigneRapportImport,
  RapportImportEnrichi,
  ResultatImportEnrichi,
  ResultatRollbackImport,
} from './types';

/**
 * PHILOSOPHIE DE L'IMPORT — TOLÉRER + ALERTER
 *
 * Le pipeline d'import est délibérément TOLÉRANT plutôt que STRICT :
 * - Pays non reconnu → ZZZ + alerte qualité (pas de rejet)
 * - Domaine non reconnu → AUTRE (pas de rejet)
 * - Tranche d'âge absente → NULL + alerte qualité
 *
 * Les anomalies remontent ensuite via les UI :
 *   - /admin/qualite-donnees (dashboard global)
 *   - /super-admin/nettoyage-donnees/pays-inconnus (résolution ZZZ)
 *   - /admin/alertes-qualite (workflow par anomalie)
 *
 * REJETER une ligne est réservé aux cas vraiment irrécupérables :
 * - Prénom + Nom tous deux vides (pas de personne identifiable)
 * - Année d'appui aberrante (avant 2000 ou après 2100)
 * - Doublons stricts non résolvables
 *
 * Tout le reste passe en base avec marquage d'anomalie.
 *
 * Pipeline :
 *   1. Parsing flexible (auto-détection en-tête + mapping flou)
 *   2. Normalisation par ligne (codes projets, pays, sexe, etc.)
 *   3. Décision : INSERÉE / ENRICHIE / INCOMPLÈTE / DOUBLON / REJETÉE
 *   4. Doublons par courriel (clé forte) puis par clé faible
 *   5. Rapport enrichi par statut pour pilotage post-import
 */

export type ImporterBeneficiairesInput = {
  fichierBuffer: ArrayBuffer | Buffer;
  fichierNom: string;
  fichierTaille: number;
  /** SHA-256 hex du fichier (optionnel, pour détecter les re-imports). */
  fichierHash?: string;
  /** Nom de l'onglet à importer (multi-onglets). Si absent, auto-détection. */
  nomOnglet?: string;
  /** Code projet à appliquer par défaut si absent des cellules. */
  codeProjetDefaut?: string;
  /**
   * Forcer l'insertion sans dédoublonnage (insère les « doublons » identifiés,
   * pour traitement manuel ultérieur — ex. contacts partagés à tort). Défaut false.
   */
  forcerDoublons?: boolean;
};

/** Headers attendus (alignés sur Template OIF, étendus avec tranche_age_declaree). */
const HEADERS_ATTENDUS = [
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

const anneeCourante = new Date().getFullYear();

/** Type interne du record normalisé prêt à insérer / fusionner. */
type RecordNormalise = {
  prenom: string | null;
  nom: string | null;
  sexe: 'F' | 'M' | 'Autre' | null;
  projet_code: string | null;
  pays_code: string | null;
  domaine_formation_code: string | null;
  modalite_formation_code: string | null;
  annee_formation: number | null;
  statut_code: string | null;
  courriel: string | null;
  telephone: string | null;
  partenaire_accompagnement: string | null;
  fonction_actuelle: string | null;
  tranche_age_declaree: 'Jeune' | 'Adulte' | null;
  tranche_age_precise_id: string | null;
  consentement_recueilli: boolean;
};

export async function importerBeneficiairesExcel(
  input: ImporterBeneficiairesInput,
): Promise<ResultatImportEnrichi> {
  // 0. Vérification droits (super_admin élargi à l'admin SCS / coordinateur)
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs', 'editeur_projet'].includes(utilisateur.role)) {
    return {
      status: 'erreur_droits',
      message: 'Réservé aux administrateurs SCS, super_admin et coordonnateurs de projet.',
    };
  }

  if (input.fichierTaille > 10 * 1024 * 1024) {
    return {
      status: 'erreur_fichier',
      message: 'Fichier trop volumineux (max 10 MB). Scindez le fichier en plusieurs imports.',
    };
  }

  // 1. Parsing flexible : CSV ou Excel selon l'extension, avec sélection d'onglet
  const estCsv = input.fichierNom.toLowerCase().endsWith('.csv');
  const parse = estCsv
    ? await parseCsv(input.fichierBuffer, HEADERS_ATTENDUS)
    : await parseExcelFlexible(
        input.fichierBuffer,
        HEADERS_ATTENDUS,
        input.nomOnglet,
        'beneficiaires',
      );
  if (parse.erreursStructure.length > 0) {
    return {
      status: 'erreur_fichier',
      message: parse.erreursStructure.map((e) => e.message).join(' ; '),
    };
  }

  const lignesRapport: LigneRapportImport[] = [];
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  // 1b. Pré-chargement cache doublons (batch) — évite N requêtes séquentielles
  // pour les imports > 200 lignes. On charge en une seule requête tous les
  // bénéficiaires existants pour les projets présents dans le fichier.
  const cacheBatch = await precalculerCacheDoublons(adminClient, parse.lignes);

  // 1c. Créer la session d'import (best-effort).
  // La migration 20260512100001 a été appliquée — types Supabase à jour,
  // plus besoin de cast `as any`.
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
      })
      .select('id')
      .single();
    importSessionId = session?.id ?? null;
  } catch {
    // import_sessions absent du schéma (cas dev/staging non migré)
    // → fonctionnement dégradé sans rollback
  }

  // Traitement concurrent par tranches de 50 — évite le timeout Vercel 60s
  // sur les gros fichiers (10 000 lignes séquentielles ≈ 500s, en batches ≈ 10s).
  const CONCURRENCE = 50;
  for (let i = 0; i < parse.lignes.length; i += CONCURRENCE) {
    const tranche = parse.lignes.slice(i, i + CONCURRENCE);
    const resultats = await Promise.all(
      tranche.map(({ numLigne, donnees }) =>
        traiterLigne({
          numLigne,
          donnees,
          adminClient,
          createdBy: utilisateur.user_id,
          importSessionId,
          nomFichier: input.fichierNom,
          codeProjetDefaut: input.codeProjetDefaut,
          forcerDoublons: input.forcerDoublons,
          cacheBatch,
        }),
      ),
    );
    lignesRapport.push(...resultats);
  }

  let nbInserees = 0;
  let nbEnrichies = 0;
  let nbDoublonsIdentiques = 0;
  let nbIncompletes = 0;
  let nbRejetees = 0;
  for (const l of lignesRapport) {
    switch (l.statut) {
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

  // 2. Mettre à jour la session (statut + compteurs)
  if (importSessionId) {
    try {
      await adminClient
        .from('import_sessions')
        .update({
          statut: 'complete',
          nb_inserees: nbInserees,
          nb_enrichies: nbEnrichies,
          nb_incompletes: nbIncompletes,
          nb_doublons: nbDoublonsIdentiques,
          nb_rejetees: nbRejetees,
        })
        .eq('id', importSessionId);
    } catch {
      // best-effort
    }
  }

  // 3. Audit dans imports_excel (best-effort, n'interrompt pas le retour)
  let importId: string | null = null;
  try {
    const { data: imp } = await supabase
      .from('imports_excel')
      .insert({
        fichier_nom: input.fichierNom,
        fichier_taille_octets: input.fichierTaille,
        version_template: 'V1',
        nb_lignes_a1: parse.lignes.length,
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
    // Audit non critique
  }

  revalidatePath('/beneficiaires');
  revalidatePath('/admin/imports');
  revalidatePath('/dashboard');
  revalidatePath('/realisations');

  const rapport: RapportImportEnrichi = {
    fichier_nom: input.fichierNom,
    nb_lignes_total: parse.lignes.length,
    nb_inserees: nbInserees,
    nb_enrichies: nbEnrichies,
    nb_doublons_identiques: nbDoublonsIdentiques,
    nb_incompletes: nbIncompletes,
    nb_rejetees: nbRejetees,
    headers_mappes_auto: parse.headersMappesAuto,
    headers_non_reconnus: parse.headersNonReconnus,
    lignes: lignesRapport,
    import_id: importId,
    import_session_id: importSessionId,
    rollback_expire_at: importSessionId ? rollbackExpireAt : null,
    execute_a: new Date().toISOString(),
  };

  return { status: 'succes', rapport };
}

// =============================================================================
// Traitement d'une ligne (normalisation + détection doublons + insert/update)
// =============================================================================

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Wrapper public pour traiterLigne — réutilisé par
 * importerBeneficiairesDepuisIA (Phase 4). Permet de marquer une ligne
 * comme `extrait_par_ia` sans dupliquer la logique de normalisation
 * + détection doublons + insertion.
 */
export async function traiterLigneImport(args: {
  numLigne: number;
  donnees: Record<string, unknown>;
  adminClient: AdminClient;
  createdBy: string;
  /** Si true, marque la ligne comme `extrait_par_ia` dans le rapport. */
  extraitParIA?: boolean;
  /** Score 0..100 de confiance d'extraction IA (utilisé si extraitParIA). */
  confianceIA?: number;
  /** ID de la session d'import pour rollback. */
  importSessionId?: string | null;
  cacheBatch?: CacheDoublons;
}): Promise<LigneRapportImport> {
  const result = await traiterLigne(args);
  if (args.extraitParIA) {
    return {
      ...result,
      extrait_par_ia: true,
      confiance_ia: args.confianceIA,
    };
  }
  return result;
}

async function traiterLigne(args: {
  numLigne: number;
  donnees: Record<string, unknown>;
  adminClient: AdminClient;
  createdBy: string;
  importSessionId?: string | null;
  nomFichier?: string;
  codeProjetDefaut?: string;
  forcerDoublons?: boolean;
  cacheBatch?: CacheDoublons;
}): Promise<LigneRapportImport> {
  const {
    numLigne,
    donnees,
    adminClient,
    createdBy,
    importSessionId,
    nomFichier,
    codeProjetDefaut,
    forcerDoublons,
    cacheBatch,
  } = args;
  const mappagesAuto: string[] = [];
  const champsManquants: string[] = [];
  const champsMisAJour: string[] = [];
  const alertes: string[] = [];

  // 1. Normalisation par champ — chaque transformation est tracée pour le rapport
  const projetBrut = donnees['Code projet *'];
  const projet = normaliserCodeProjet(projetBrut);
  if (projetBrut && projet && String(projetBrut).trim() !== projet) {
    mappagesAuto.push(`${projetBrut} → ${projet} (projet)`);
  }

  const paysBrut = donnees['Code pays bénéficiaire *'];
  let pays = normaliserCodePays(paysBrut);
  if (paysBrut && pays && String(paysBrut).trim().toUpperCase() !== pays) {
    mappagesAuto.push(`${paysBrut} → ${pays} (pays)`);
  }

  const sexeBrut = donnees['Sexe *'];
  const sexe = normaliserSexe(sexeBrut);
  if (sexeBrut && sexe && String(sexeBrut).trim() !== sexe) {
    mappagesAuto.push(`${sexeBrut} → ${sexe} (sexe)`);
  }

  const trancheBrut = donnees["Tranche d'âge déclarée"];
  const trancheResult = await resoudreTrancheAge(trancheBrut);
  const tranche = trancheResult?.categorie ?? null;
  const tranchePreciseId = trancheResult?.tranche_precise_id ?? null;
  if (trancheBrut && tranche && String(trancheBrut).trim() !== tranche) {
    mappagesAuto.push(`${trancheBrut} → ${tranche} (tranche)`);
  }

  const domaineBrut = donnees['Domaine de formation *'];
  let domaine = normaliserDomaineFormation(domaineBrut);
  if (!domaine) {
    domaine = 'AUTRE';
    if (domaineBrut) {
      alertes.push(`Domaine de formation « ${String(domaineBrut)} » non reconnu → AUTRE.`);
    }
  }
  if (domaineBrut && domaine && String(domaineBrut).trim() !== domaine) {
    mappagesAuto.push(`${domaineBrut} → ${domaine} (domaine)`);
  }

  const modaliteBrut = donnees['Modalité *'];
  const modalite = normaliserModalite(modaliteBrut);

  const statutBrut = donnees['Statut *'];
  const statut = normaliserStatut(statutBrut) ?? 'INSCRIT';

  const consentementBrut = donnees['Consentement *'];
  const consentement = normaliserConsentement(consentementBrut) ?? false;

  const anneeBrut = donnees['Année de la formation *'];
  const annee = parserAnnee(anneeBrut) ?? anneeCourante;
  if (anneeBrut === null || anneeBrut === undefined || anneeBrut === '') {
    alertes.push(`Année de formation manquante : ${anneeCourante} utilisée par défaut`);
  }

  const courriel = nettoyerCourriel(donnees['Courriel']);
  const telephone = nettoyerString(donnees['Téléphone (avec indicatif)']);
  const partenaire = nettoyerString(donnees["Partenaire d'accompagnement"]);
  const fonction = nettoyerString(donnees['Fonction / Statut actuel']);

  // 2. Pays non reconnu → fallback ZZZ (tolérer + alerter)
  if (!pays) {
    pays = 'ZZZ';
    alertes.push(
      `Pays non reconnu${paysBrut ? ` : « ${String(paysBrut)} »` : ' (vide)'} → marqué ZZZ. À corriger via /super-admin/nettoyage-donnees/pays-inconnus.`,
    );
    champsManquants.push('pays_code');
  }

  // Projet : si absent, tenter l'inférence depuis le nom du fichier puis le défaut.
  let projetFinal = projet;
  if (!projetFinal && nomFichier) {
    const match = nomFichier.match(/\b[Pp](\d{1,2}[a-zA-Z]?)\b/);
    if (match) {
      const candidat = `PROJ_A${match[1]}`;
      if ((PROJETS_CODES as readonly string[]).includes(candidat)) {
        projetFinal = candidat as typeof projet;
        alertes.push(`Code projet absent → inféré du nom de fichier : ${candidat}`);
      }
    }
  }
  if (!projetFinal && codeProjetDefaut) {
    projetFinal = codeProjetDefaut as typeof projet;
    alertes.push(`Code projet absent → défaut appliqué : ${codeProjetDefaut}`);
  }
  if (!projetFinal) {
    return {
      numero_ligne: numLigne,
      statut: 'rejetee',
      mappages_auto: mappagesAuto,
      champs_manquants: champsManquants,
      champs_mis_a_jour: champsMisAJour,
      alertes,
      erreurs: [
        {
          ligne: numLigne,
          colonne: 'Code projet *',
          valeur: projetBrut ? String(projetBrut) : null,
          message: projetBrut
            ? `Code projet inconnu : « ${String(projetBrut)} ». Vérifiez le code ou sélectionnez un projet par défaut.`
            : "Code projet manquant. Sélectionnez un projet par défaut dans le formulaire d'import.",
        },
      ],
    };
  }

  // Si consentement absent mais courriel/téléphone présents : alerte (pas d'erreur)
  let consentementFinal = consentement;
  let courrielFinal = courriel;
  let telephoneFinal = telephone;
  if ((courriel || telephone) && !consentement) {
    alertes.push(
      'Contact(s) présent(s) sans consentement explicite — stocker uniquement après validation manuelle (RGPD).',
    );
    // On NE stocke PAS les contacts sans consentement pour respecter le RGPD
    courrielFinal = null;
    telephoneFinal = null;
    if (courriel) champsManquants.push('courriel (en attente de consentement)');
    if (telephone) champsManquants.push('telephone (en attente de consentement)');
  } else if (consentement && (courriel || telephone)) {
    consentementFinal = true;
  }

  // 3. Construire le payload normalisé
  // Le sexe est NOT NULL en base : une valeur absente bloquerait toute la ligne
  // (rejet). Or les autres champs (nom, pays, domaine, courriel…) restent utiles.
  // → on insère avec 'Autre' par défaut (ligne marquée « incomplète », corrigeable),
  //   plutôt que de rejeter.
  const record: RecordNormalise = {
    prenom: nettoyerString(donnees['Prénom *']),
    nom: nettoyerString(donnees['Nom *'])?.toLocaleUpperCase('fr-FR') ?? null,
    sexe: sexe ?? 'Autre',
    projet_code: projetFinal,
    pays_code: pays,
    domaine_formation_code: domaine,
    modalite_formation_code: modalite,
    annee_formation: annee,
    statut_code: statut,
    courriel: courrielFinal,
    telephone: telephoneFinal,
    partenaire_accompagnement: partenaire,
    fonction_actuelle: fonction,
    tranche_age_declaree: tranche,
    tranche_age_precise_id: tranchePreciseId,
    consentement_recueilli: consentementFinal,
  };

  // Tracker les champs manquants pour le futur (sans bloquer)
  if (!record.prenom) champsManquants.push('prenom');
  if (!record.nom) champsManquants.push('nom');
  if (!sexe) champsManquants.push('sexe');
  if (!record.domaine_formation_code) champsManquants.push('domaine_formation_code');
  if (!record.tranche_age_declaree && !record.sexe) {
    // tranche_age est optionnelle mais utile pour les stats
  }

  // 4. Détecter un doublon (courriel ou téléphone identique). Si forçage demandé,
  //    on n'en cherche pas → insertion directe (cas des contacts partagés à tort).
  const doublonMatch = forcerDoublons
    ? null
    : await detecterDoublon(adminClient, record, cacheBatch);

  if (doublonMatch) {
    const doublon = doublonMatch.record;
    const comparaison = construireComparaisonDoublon(record, doublon, doublonMatch.critere);
    const { fusionne, champsMisAJour: champsMaj } = fusionnerBeneficiaires(doublon, {
      prenom: record.prenom,
      nom: record.nom,
      sexe: record.sexe,
      tranche_age_declaree: record.tranche_age_declaree,
      domaine_formation_code: record.domaine_formation_code,
      modalite_formation_code: record.modalite_formation_code,
      partenaire_accompagnement: record.partenaire_accompagnement,
      fonction_actuelle: record.fonction_actuelle,
      telephone: record.telephone,
      courriel: record.courriel,
    });

    if (champsMaj.length === 0) {
      return {
        numero_ligne: numLigne,
        statut: 'doublon_identique',
        mappages_auto: mappagesAuto,
        champs_manquants: champsManquants,
        champs_mis_a_jour: [],
        alertes: [
          `Doublon détecté (${comparaison.critere}, ${comparaison.pourcentage}% de correspondance), aucune nouvelle donnée à enregistrer.`,
        ],
        erreurs: [],
        donnees_importees: extrairePreview(record),
        comparaison_doublon: comparaison,
      };
    }

    // UPDATE pour combler les NULL côté existant
    const { error: updateError } = await adminClient
      .from('beneficiaires')
      .update({
        ...fusionne,
        ...(record.tranche_age_precise_id
          ? { tranche_age_precise_id: record.tranche_age_precise_id }
          : {}),
      } as never)
      .eq('id', (doublon as { id: string }).id);

    if (updateError) {
      return {
        numero_ligne: numLigne,
        statut: 'rejetee',
        mappages_auto: mappagesAuto,
        champs_manquants: champsManquants,
        champs_mis_a_jour: [],
        alertes,
        erreurs: [
          {
            ligne: numLigne,
            colonne: null,
            valeur: null,
            message: `UPDATE BDD échoué : ${updateError.message}`,
          },
        ],
      };
    }

    return {
      numero_ligne: numLigne,
      statut: 'enrichie',
      mappages_auto: mappagesAuto,
      champs_manquants: champsManquants,
      champs_mis_a_jour: champsMaj,
      alertes,
      erreurs: [],
      donnees_importees: extrairePreview(record),
      comparaison_doublon: comparaison,
    };
  }

  // 5. INSERT — validation Zod souple
  const parseRes = beneficiaireImportSchema.safeParse({
    prenom: record.prenom,
    nom: record.nom,
    sexe: record.sexe ?? undefined,
    projet_code: record.projet_code,
    pays_code: record.pays_code,
    domaine_formation_code: record.domaine_formation_code ?? undefined,
    modalite_formation_code: record.modalite_formation_code ?? undefined,
    annee_formation: record.annee_formation,
    statut_code: record.statut_code,
    consentement_recueilli: record.consentement_recueilli,
    telephone: record.telephone ?? undefined,
    courriel: record.courriel ?? undefined,
    partenaire_accompagnement: record.partenaire_accompagnement ?? undefined,
    fonction_actuelle: record.fonction_actuelle ?? undefined,
    tranche_age_declaree: record.tranche_age_declaree ?? undefined,
  });

  if (!parseRes.success) {
    return {
      numero_ligne: numLigne,
      statut: 'rejetee',
      mappages_auto: mappagesAuto,
      champs_manquants: champsManquants,
      champs_mis_a_jour: [],
      alertes,
      erreurs: parseRes.error.issues.map((issue) => ({
        ligne: numLigne,
        colonne: issue.path.join('.'),
        valeur: null,
        message: issue.message,
      })),
    };
  }

  const { error: insertError } = await adminClient.from('beneficiaires').insert({
    ...parseRes.data,
    source_import: 'excel_v1',
    created_by: createdBy,
    ...(importSessionId ? { import_session_id: importSessionId } : {}),
    ...(record.tranche_age_precise_id
      ? { tranche_age_precise_id: record.tranche_age_precise_id }
      : {}),
  } as never);

  if (insertError) {
    // Violation de contrainte unique = doublon intra-fichier (deux lignes identiques
    // traitées en parallèle — l'une a gagné la course). Traiter comme doublon, pas erreur.
    if ((insertError as { code?: string }).code === '23505') {
      return {
        numero_ligne: numLigne,
        statut: 'doublon_identique',
        mappages_auto: mappagesAuto,
        champs_manquants: champsManquants,
        champs_mis_a_jour: [],
        alertes: [...alertes, "Doublon intra-fichier détecté lors de l'import concurrent."],
        erreurs: [],
      };
    }
    return {
      numero_ligne: numLigne,
      statut: 'rejetee',
      mappages_auto: mappagesAuto,
      champs_manquants: champsManquants,
      champs_mis_a_jour: [],
      alertes,
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

  // INSERT OK : décider entre 'inseree' (complète) et 'incomplete' (manque qqch d'important)
  const estIncomplete =
    champsManquants.length > 0 || !record.prenom || !record.nom || !record.domaine_formation_code;

  return {
    numero_ligne: numLigne,
    statut: estIncomplete ? 'incomplete' : 'inseree',
    mappages_auto: mappagesAuto,
    champs_manquants: champsManquants,
    champs_mis_a_jour: [],
    alertes,
    erreurs: [],
    donnees_importees: extrairePreview(record),
  };
}

// =============================================================================
// Helpers
// =============================================================================

function nettoyerString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function nettoyerCourriel(v: unknown): string | null {
  const s = nettoyerString(v);
  if (!s) return null;
  // Validation simple — Zod fera la validation stricte
  if (!s.includes('@')) return null;
  return s.toLowerCase();
}

function parserAnnee(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d]/g, ''));
  if (!Number.isInteger(n) || n < 2000 || n > anneeCourante + 5) return null;
  return n;
}

function extrairePreview(record: RecordNormalise): LigneRapportImport['donnees_importees'] {
  return {
    courriel: record.courriel,
    pays: record.pays_code,
    projet: record.projet_code,
    annee: record.annee_formation,
  };
}

// =============================================================================
// Cache de doublons (pré-chargement batch)
// =============================================================================

/** Colonnes nécessaires pour la détection de doublons + fusion. */
const SELECT_DOUBLON =
  'id, prenom, nom, sexe, projet_code, pays_code, domaine_formation_code, modalite_formation_code, annee_formation, statut_code, courriel, telephone, partenaire_accompagnement, fonction_actuelle, tranche_age_declaree';

type BeneficiaireRecord = Record<string, unknown>;

export type CacheDoublons = {
  parCourriel: Map<string, BeneficiaireRecord>;
  parTelephone: Map<string, BeneficiaireRecord>;
};

/** Normalise un téléphone pour comparaison (chiffres + éventuel +). */
function cleTelephone(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[^\d+]/g, '');
  return s.length >= 6 ? s : null;
}

/**
 * Pré-charge les bénéficiaires existants pour les projets présents dans le
 * fichier → évite N requêtes séquentielles (1 requête batch à la place).
 * Activé uniquement pour les imports > 200 lignes.
 */
async function precalculerCacheDoublons(
  adminClient: AdminClient,
  lignes: { donnees: Record<string, unknown> }[],
): Promise<CacheDoublons> {
  const cache: CacheDoublons = { parCourriel: new Map(), parTelephone: new Map() };

  if (lignes.length < 200) return cache; // import petit — pas besoin du cache

  // Collecter les contacts distincts présents dans le fichier (courriel/tél).
  const courriels = new Set<string>();
  const telephones = new Set<string>();
  for (const { donnees } of lignes) {
    const c = nettoyerCourriel(donnees['Courriel']);
    if (c) courriels.add(c.toLowerCase());
    const t = cleTelephone(donnees['Téléphone (avec indicatif)']);
    if (t) telephones.add(t);
  }

  const indexer = (rows: BeneficiaireRecord[]) => {
    for (const b of rows) {
      if (b.courriel) cache.parCourriel.set(String(b.courriel).toLowerCase(), b);
      const t = cleTelephone(b.telephone);
      if (t) cache.parTelephone.set(t, b);
    }
  };

  try {
    // Charger les bénéficiaires existants partageant un contact du fichier.
    if (courriels.size > 0) {
      const { data } = await adminClient
        .from('beneficiaires')
        .select(SELECT_DOUBLON)
        .in('courriel', [...courriels])
        .is('deleted_at', null);
      indexer((data ?? []) as BeneficiaireRecord[]);
    }
    if (telephones.size > 0) {
      const { data } = await adminClient
        .from('beneficiaires')
        .select(SELECT_DOUBLON)
        .in('telephone', [...telephones])
        .is('deleted_at', null);
      indexer((data ?? []) as BeneficiaireRecord[]);
    }
  } catch {
    // Erreur réseau ou table absente → cache vide, fallback DB par ligne
  }

  return cache;
}

/**
 * Cherche un doublon — utilise le cache batch si disponible, sinon requêtes
 * BDD par ligne (comportement original pour les petits imports).
 */
async function detecterDoublon(
  adminClient: AdminClient,
  record: RecordNormalise,
  cache?: CacheDoublons,
): Promise<{ record: Record<string, unknown>; critere: string } | null> {
  // ── Règle métier : doublon si même COURRIEL ou même TÉLÉPHONE ─────────────
  // La similarité de nom (sans contact) ne suffit plus : sans contact commun,
  // on insère (deux personnes peuvent partager nom/sexe/pays/année).
  if (record.courriel) {
    const cle = record.courriel.toLowerCase();
    if (cache) {
      const hit = cache.parCourriel.get(cle);
      if (hit) return { record: hit, critere: 'Courriel identique' };
    } else {
      const { data } = await adminClient
        .from('beneficiaires')
        .select(SELECT_DOUBLON)
        .eq('courriel', record.courriel)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (data) return { record: data as Record<string, unknown>, critere: 'Courriel identique' };
    }
  }

  const tel = cleTelephone(record.telephone);
  if (tel) {
    if (cache) {
      const hit = cache.parTelephone.get(tel);
      if (hit) return { record: hit, critere: 'Téléphone identique' };
    } else {
      const { data } = await adminClient
        .from('beneficiaires')
        .select(SELECT_DOUBLON)
        .eq('telephone', record.telephone ?? '')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (data) return { record: data as Record<string, unknown>, critere: 'Téléphone identique' };
    }
  }

  return null;
}

// =============================================================================
// Comparaison champ par champ d'un doublon (pour le rapport)
// =============================================================================

/** Normalise une valeur pour la comparaison d'égalité (string trim/lower). */
function normPourComparaison(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/** Affichage lisible d'une valeur (— pour vide). */
function afficherValeur(v: unknown): string | null {
  const s = normPourComparaison(v);
  return s;
}

/**
 * Construit la comparaison champ par champ entre la ligne importée (record)
 * et la fiche existante (doublon), avec un pourcentage global de correspondance.
 */
function construireComparaisonDoublon(
  record: RecordNormalise,
  existant: Record<string, unknown>,
  critere: string,
): ComparaisonDoublon {
  const defs: { champ: string; importee: unknown; existante: unknown; tel?: boolean }[] = [
    { champ: 'Prénom', importee: record.prenom, existante: existant.prenom },
    { champ: 'Nom', importee: record.nom, existante: existant.nom },
    { champ: 'Sexe', importee: record.sexe, existante: existant.sexe },
    { champ: 'Projet', importee: record.projet_code, existante: existant.projet_code },
    { champ: 'Pays', importee: record.pays_code, existante: existant.pays_code },
    {
      champ: 'Domaine',
      importee: record.domaine_formation_code,
      existante: existant.domaine_formation_code,
    },
    { champ: 'Année', importee: record.annee_formation, existante: existant.annee_formation },
    { champ: 'Courriel', importee: record.courriel, existante: existant.courriel },
    {
      champ: 'Téléphone',
      importee: record.telephone,
      existante: existant.telephone,
      tel: true,
    },
  ];

  const champs: ChampComparaison[] = defs.map((d) => {
    const impAff = afficherValeur(d.importee);
    const exAff = afficherValeur(d.existante);
    // Égalité : insensible à la casse ; pour le téléphone on compare les chiffres.
    let identique: boolean;
    if (d.tel) {
      identique = cleTelephone(d.importee) === cleTelephone(d.existante);
    } else {
      identique = (impAff?.toLowerCase() ?? null) === (exAff?.toLowerCase() ?? null);
    }
    return {
      champ: d.champ,
      valeur_importee: impAff,
      valeur_existante: exAff,
      identique,
    };
  });

  const nbIdentiques = champs.filter((c) => c.identique).length;
  const pourcentage = champs.length > 0 ? Math.round((nbIdentiques / champs.length) * 100) : 0;

  const refNom = [normPourComparaison(existant.prenom), normPourComparaison(existant.nom)]
    .filter(Boolean)
    .join(' ');
  const refContact =
    normPourComparaison(existant.courriel) ?? normPourComparaison(existant.telephone) ?? '';
  const reference = [refNom, refContact].filter(Boolean).join(' · ') || 'Fiche existante';

  return { critere, reference, pourcentage, champs };
}

// =============================================================================
// Server Action : annuler (rollback) une session d'import
// =============================================================================

/**
 * Annule un import en masse via son `import_session_id`.
 *
 * Conditions :
 *   - L'utilisateur doit être le créateur OU admin_scs/super_admin
 *   - `peut_rollback = true` sur la session
 *   - `rollback_expire_at > now()` (fenêtre de 30 jours)
 *
 * Effet : soft-delete de tous les bénéficiaires liés (`deleted_at = now()`)
 *         + statut session → 'annule'.
 *
 * Les bénéficiaires "enrichis" (doublon existant mis à jour) ne sont PAS
 * revertés automatiquement pour éviter la perte de données antérieures —
 * ils sont uniquement marqués supprimés si leur created_at correspond à
 * cette session (i.e. ils ont été créés par cet import).
 */
export async function annulerImportSession(sessionId: string): Promise<ResultatRollbackImport> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs', 'editeur_projet'].includes(utilisateur.role)) {
    return {
      status: 'erreur_droits',
      message: 'Réservé aux administrateurs SCS, super_admin et coordonnateurs de projet.',
    };
  }

  const adminClient = createSupabaseAdminClient();

  // Vérifier que la session existe et est éligible au rollback
  const { data: session, error: sessionError } = await adminClient
    .from('import_sessions')
    .select('id, statut, peut_rollback, rollback_expire_at, created_by')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { status: 'erreur_session', message: 'Session introuvable.' };
  }

  // Vérification des droits : créateur ou admin
  const isAdmin = ['super_admin', 'admin_scs'].includes(utilisateur.role);
  if (!isAdmin && session.created_by !== utilisateur.user_id) {
    return {
      status: 'erreur_droits',
      message: 'Vous ne pouvez annuler que vos propres imports.',
    };
  }

  if (!session.peut_rollback) {
    return {
      status: 'erreur_session',
      message: 'Le rollback a été désactivé pour cette session.',
    };
  }

  const expireAt = session.rollback_expire_at;
  if (!expireAt || new Date(expireAt) <= new Date()) {
    return {
      status: 'rollback_expire',
      message: `La fenêtre de rollback a expiré${expireAt ? ` (était valide jusqu'au ${new Date(expireAt).toLocaleDateString('fr-FR')})` : ''}.`,
    };
  }

  if (session.statut === 'annule') {
    return {
      status: 'erreur_session',
      message: 'Cette session a déjà été annulée.',
    };
  }

  // Soft-delete des bénéficiaires de cette session
  const { data: updated, error: deleteError } = await adminClient
    .from('beneficiaires')
    .update({ deleted_at: new Date().toISOString() })
    .eq('import_session_id', sessionId)
    .is('deleted_at', null)
    .select('id');

  if (deleteError) {
    return {
      status: 'erreur_session',
      message: `Erreur lors du rollback : ${deleteError.message}`,
    };
  }

  const nbAnnules = Array.isArray(updated) ? updated.length : 0;

  // Mettre à jour le statut de la session
  await adminClient
    .from('import_sessions')
    .update({
      statut: 'annule',
      peut_rollback: false,
    })
    .eq('id', sessionId);

  revalidatePath('/beneficiaires');
  revalidatePath('/imports');

  return { status: 'succes', nb_annules: nbAnnules, session_id: sessionId };
}
