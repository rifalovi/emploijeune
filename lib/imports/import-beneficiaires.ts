'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { revalidatePath } from 'next/cache';
import { beneficiaireImportSchema } from '@/lib/schemas/beneficiaire';
import { parseExcelFlexible } from './parser-excel-flexible';
import {
  normaliserCodeProjet,
  normaliserCodePays,
  normaliserSexe,
  normaliserTrancheAge,
  normaliserDomaineFormation,
  normaliserModalite,
  normaliserStatut,
  normaliserConsentement,
  fusionnerBeneficiaires,
} from './smart-mapper';
import type {
  LigneRapportImport,
  RapportImportEnrichi,
  ResultatImportEnrichi,
  StatutLigneImport,
} from './types';

/**
 * Import en masse de bénéficiaires depuis un fichier Excel — pipeline tolérant
 * (Phase C du sprint « absorber le maximum, signaler le reste »).
 *
 * Stratégie « absorber le maximum, signaler le reste » :
 *   1. Parsing flexible : la ligne d'en-tête est auto-détectée, les en-têtes
 *      sont mappés sur le template via fuzzy matching (synonymes + mots-clés).
 *   2. Normalisation par ligne : P14→PROJ_A14, "Cameroun"→CMR, "H"→M, etc.
 *   3. Décision par ligne :
 *        - REJETÉE si champs vraiment bloquants impossibles à inférer
 *          (pas de pays reconnu).
 *        - DOUBLON_IDENTIQUE si une fiche existe déjà et que rien à enrichir.
 *        - ENRICHIE si doublon existe et qu'on peut combler ses NULL.
 *        - INCOMPLÈTE si insérée mais avec des champs obligatoires manquants
 *          (domaine de formation, prénom anonyme INCONNU, etc.) → à compléter
 *          via une campagne de collecte.
 *        - INSERÉE si tout est plein et bien normalisé.
 *   4. Doublons détectés par courriel (si présent) puis par clé faible
 *      (projet + pays + sexe + année + tranche d'âge).
 *   5. Rapport enrichi par statut, pour pilotage post-import.
 */

export type ImporterBeneficiairesInput = {
  fichierBuffer: ArrayBuffer | Buffer;
  fichierNom: string;
  fichierTaille: number;
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
  consentement_recueilli: boolean;
};

export async function importerBeneficiairesExcel(
  input: ImporterBeneficiairesInput,
): Promise<ResultatImportEnrichi> {
  // 0. Vérification droits (super_admin élargi à l'admin SCS / coordinateur)
  const utilisateur = await getCurrentUtilisateur();
  if (
    !utilisateur ||
    !['super_admin', 'admin_scs', 'editeur_projet'].includes(utilisateur.role)
  ) {
    return {
      status: 'erreur_droits',
      message: 'Réservé aux administrateurs SCS, super_admin et coordonnateurs de projet.',
    };
  }

  if (input.fichierTaille > 5 * 1024 * 1024) {
    return {
      status: 'erreur_fichier',
      message: 'Fichier trop volumineux (max 5 MB). Scindez le fichier en plusieurs imports.',
    };
  }

  // 1. Parsing flexible : auto-détection de la ligne d'en-tête + mapping flou
  const parse = await parseExcelFlexible(input.fichierBuffer, HEADERS_ATTENDUS);
  if (parse.erreursStructure.length > 0) {
    return {
      status: 'erreur_fichier',
      message: parse.erreursStructure.map((e) => e.message).join(' ; '),
    };
  }

  const lignesRapport: LigneRapportImport[] = [];
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  let nbInserees = 0;
  let nbEnrichies = 0;
  let nbDoublonsIdentiques = 0;
  let nbIncompletes = 0;
  let nbRejetees = 0;

  for (const { numLigne, donnees } of parse.lignes) {
    const ligneInfo = await traiterLigne({
      numLigne,
      donnees,
      adminClient,
      createdBy: utilisateur.user_id,
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

  // 2. Audit dans imports_excel (best-effort, n'interrompt pas le retour)
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
    execute_a: new Date().toISOString(),
  };

  return { status: 'succes', rapport };
}

// =============================================================================
// Traitement d'une ligne (normalisation + détection doublons + insert/update)
// =============================================================================

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function traiterLigne(args: {
  numLigne: number;
  donnees: Record<string, unknown>;
  adminClient: AdminClient;
  createdBy: string;
}): Promise<LigneRapportImport> {
  const { numLigne, donnees, adminClient, createdBy } = args;
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
  const pays = normaliserCodePays(paysBrut);
  if (paysBrut && pays && String(paysBrut).trim().toUpperCase() !== pays) {
    mappagesAuto.push(`${paysBrut} → ${pays} (pays)`);
  }

  const sexeBrut = donnees['Sexe *'];
  const sexe = normaliserSexe(sexeBrut);
  if (sexeBrut && sexe && String(sexeBrut).trim() !== sexe) {
    mappagesAuto.push(`${sexeBrut} → ${sexe} (sexe)`);
  }

  const trancheBrut = donnees["Tranche d'âge déclarée"];
  const tranche = normaliserTrancheAge(trancheBrut);
  if (trancheBrut && tranche && String(trancheBrut).trim() !== tranche) {
    mappagesAuto.push(`${trancheBrut} → ${tranche} (tranche)`);
  }

  const domaineBrut = donnees['Domaine de formation *'];
  const domaine = normaliserDomaineFormation(domaineBrut);
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

  // 2. Rejet bloquant : sans pays, on ne peut rien faire
  if (!pays) {
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
          colonne: 'Code pays bénéficiaire *',
          valeur: paysBrut ? String(paysBrut) : null,
          message: `Pays non reconnu${paysBrut ? ` : « ${String(paysBrut)} »` : ' (vide)'}. La ligne ne peut pas être importée sans un pays valide.`,
        },
      ],
    };
  }

  // Projet : fallback PROJ_A06 si projet inconnu, mais alerte
  let projetFinal = projet;
  if (!projetFinal) {
    if (projetBrut) {
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
            valeur: String(projetBrut),
            message: `Code projet inconnu : « ${String(projetBrut)} ». Vérifiez le code (PROJ_A14, P14…) ou complétez la ligne.`,
          },
        ],
      };
    } else {
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
            valeur: null,
            message: 'Code projet manquant (obligatoire).',
          },
        ],
      };
    }
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
  const record: RecordNormalise = {
    prenom: nettoyerString(donnees['Prénom *']),
    nom: nettoyerString(donnees['Nom *'])?.toLocaleUpperCase('fr-FR') ?? null,
    sexe,
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
    consentement_recueilli: consentementFinal,
  };

  // Tracker les champs manquants pour le futur (sans bloquer)
  if (!record.prenom) champsManquants.push('prenom');
  if (!record.nom) champsManquants.push('nom');
  if (!record.sexe) champsManquants.push('sexe');
  if (!record.domaine_formation_code) champsManquants.push('domaine_formation_code');
  if (!record.tranche_age_declaree && !record.sexe) {
    // tranche_age est optionnelle mais utile pour les stats
  }

  // 4. Détecter un doublon — d'abord par courriel (clé forte), sinon clé faible
  const doublon = await detecterDoublon(adminClient, record);

  if (doublon) {
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
        alertes: ['Doublon détecté, aucune nouvelle donnée à enregistrer.'],
        erreurs: [],
        donnees_importees: extrairePreview(record),
      };
    }

    // UPDATE pour combler les NULL côté existant
    const { error: updateError } = await adminClient
      .from('beneficiaires')
      .update({
        ...fusionne,
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
  } as never);

  if (insertError) {
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
    champsManquants.length > 0 ||
    !record.prenom ||
    !record.nom ||
    !record.domaine_formation_code;

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

/**
 * Cherche un doublon en BDD :
 *   - Priorité 1 : même courriel (clé forte)
 *   - Priorité 2 : même projet + pays + sexe + année + tranche_age (clé faible
 *     utile pour les imports sans contact)
 *
 * Retourne null s'il n'y a pas de doublon (la ligne sera nouvelle).
 */
async function detecterDoublon(
  adminClient: AdminClient,
  record: RecordNormalise,
): Promise<Record<string, unknown> | null> {
  // Clé forte : courriel
  if (record.courriel) {
    const { data } = await adminClient
      .from('beneficiaires')
      .select(
        'id, prenom, nom, sexe, projet_code, pays_code, domaine_formation_code, modalite_formation_code, annee_formation, statut_code, courriel, telephone, partenaire_accompagnement, fonction_actuelle, tranche_age_declaree',
      )
      .eq('courriel', record.courriel)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }

  // Clé faible : combinaison de signaux. On exige au moins projet + pays + sexe + année + tranche.
  if (
    record.projet_code &&
    record.pays_code &&
    record.sexe &&
    record.annee_formation &&
    record.tranche_age_declaree
  ) {
    const { data } = await adminClient
      .from('beneficiaires')
      .select(
        'id, prenom, nom, sexe, projet_code, pays_code, domaine_formation_code, modalite_formation_code, annee_formation, statut_code, courriel, telephone, partenaire_accompagnement, fonction_actuelle, tranche_age_declaree',
      )
      .eq('projet_code', record.projet_code)
      .eq('pays_code', record.pays_code)
      .eq('sexe', record.sexe)
      .eq('annee_formation', record.annee_formation)
      .eq('tranche_age_declaree', record.tranche_age_declaree)
      .eq('prenom', record.prenom ?? 'INCONNU')
      .eq('nom', record.nom ?? 'INCONNU')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }

  return null;
}
