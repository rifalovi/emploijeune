/**
 * Types partagés pour les imports Excel (Étape 7).
 *
 * Convention :
 *   - Une LIGNE EXCEL est numérotée à partir de 2 (ligne 1 = en-têtes).
 *   - Les ERREURS sont accumulées avec ligne + colonne pour aider l'utilisateur
 *     à corriger le fichier source et ré-importer.
 */

export type ErreurImport = {
  /** Numéro de ligne dans le fichier Excel (≥ 2). */
  ligne: number;
  /** Nom de la colonne (en-tête original) ou `null` si erreur globale ligne. */
  colonne: string | null;
  /** Valeur fautive lue dans le fichier (utile pour le rapport). */
  valeur: string | null;
  /** Message d'erreur lisible par un humain (français). */
  message: string;
};

export type RapportImport = {
  /** Nom du fichier importé (pour traçabilité). */
  fichier_nom: string;
  /** Nombre total de lignes de données détectées (hors en-tête). */
  nb_lignes_total: number;
  /** Nombre de lignes effectivement insérées en BDD. */
  nb_lignes_inserees: number;
  /** Nombre de lignes ignorées pour cause d'erreur. */
  nb_lignes_ignorees: number;
  /**
   * Nombre de lignes ignorées car déjà présentes en BDD (doublon sur la clé de
   * dédoublonnage). Comptées séparément des erreurs : ce n'est pas un échec.
   */
  nb_doublons?: number;
  /** Détail des erreurs ligne par ligne. */
  erreurs: ErreurImport[];
  /** ID de la ligne `imports_excel` créée pour audit. */
  import_id: string | null;
  /**
   * ID de la session d'import (pour annulation/rollback). Null si la session
   * n'a pas pu être créée (schéma non migré) ou si rien n'a été inséré.
   */
  import_session_id?: string | null;
  /** Date limite d'annulation de l'import (ISO). Null si annulation indisponible. */
  rollback_expire_at?: string | null;
  /** Date d'exécution de l'import (ISO). */
  execute_a: string;
};

export type ResultatImport =
  | { status: 'succes'; rapport: RapportImport }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_fichier'; message: string }
  | { status: 'erreur_inconnue'; message: string };

// =============================================================================
// Rapport ENRICHI — pipeline import tolérant (Phase A du sprint « absorber max »)
// -----------------------------------------------------------------------------
// Ces types coexistent avec RapportImport ci-dessus le temps de la bascule
// progressive. Une fois le nouveau pipeline en place, on pourra alias
// ResultatImport vers ResultatImportEnrichi.
// =============================================================================

/** Comparaison champ par champ entre la ligne importée et la fiche existante. */
export type ChampComparaison = {
  /** Libellé lisible du champ comparé (« Courriel », « Nom », …). */
  champ: string;
  /** Valeur lue dans le fichier importé (déjà normalisée). */
  valeur_importee: string | null;
  /** Valeur trouvée sur la fiche existante en base. */
  valeur_existante: string | null;
  /** True si les deux valeurs sont considérées identiques. */
  identique: boolean;
};

/**
 * Détail d'un doublon : pourquoi la ligne a été reconnue comme doublon
 * (critère déclencheur) + comparaison champ par champ avec la fiche existante
 * et un pourcentage global de correspondance. Affiché dans le rapport pour
 * permettre à l'utilisateur de juger si c'est un « vrai » doublon.
 */
export type ComparaisonDoublon = {
  /** Critère ayant déclenché la détection (« Courriel identique », …). */
  critere: string;
  /** Identité de la fiche existante correspondante (nom + contact). */
  reference: string;
  /** Pourcentage de correspondance global sur l'ensemble des champs (0..100). */
  pourcentage: number;
  /** Comparaison champ par champ. */
  champs: ChampComparaison[];
};

/** Cas de figure d'une ligne après le pipeline tolérant. */
export type StatutLigneImport =
  | 'inseree' // Nouvelle fiche ajoutée (complète ou partielle)
  | 'enrichie' // Doublon existant en BDD → champs NULL comblés
  | 'doublon_identique' // Doublon, rien à enrichir → ignoré
  | 'incomplete' // Insérée mais champs obligatoires manquants (à collecter plus tard)
  | 'rejetee'; // Erreur bloquante (pays inconnu, etc.) → non importée

export type LigneRapportImport = {
  /** Numéro de ligne dans le fichier Excel. */
  numero_ligne: number;
  statut: StatutLigneImport;
  /** Liste lisible des mappings appliqués (« H → M », « P6 → PROJ_A06 »). */
  mappages_auto: string[];
  /** Champs métier laissés vides faute de donnée (pour future campagne de collecte). */
  champs_manquants: string[];
  /** Champs effectivement mis à jour lors d'un enrichissement de doublon. */
  champs_mis_a_jour: string[];
  /** Avertissements non-bloquants (ex. consentement absent mais courriel présent). */
  alertes: string[];
  /** Erreurs bloquantes (uniquement pour statut 'rejetee'). */
  erreurs: ErreurImport[];
  /** Échantillon des données importées (visible dans le rapport UI). */
  donnees_importees?: {
    courriel?: string | null;
    pays?: string | null;
    projet?: string | null;
    annee?: number | null;
  };
  /** True si la ligne a été extraite par le module IA (Phase 4). */
  extrait_par_ia?: boolean;
  /** Score de confiance IA 0..100 (uniquement si extrait_par_ia). */
  confiance_ia?: number;
  /**
   * Détail du doublon (uniquement pour 'doublon_identique' et 'enrichie') :
   * critère, fiche existante correspondante et comparaison champ par champ.
   */
  comparaison_doublon?: ComparaisonDoublon;
};

export type RapportImportEnrichi = {
  fichier_nom: string;
  nb_lignes_total: number;
  nb_inserees: number;
  nb_enrichies: number;
  nb_doublons_identiques: number;
  nb_incompletes: number;
  nb_rejetees: number;
  /** Mappings d'en-têtes auto-détectés (« Pays de Provenance » → « Code pays bénéficiaire * »). */
  headers_mappes_auto: Record<string, string>;
  /** Colonnes du fichier non reconnues, ignorées du pipeline. */
  headers_non_reconnus: string[];
  /** Détail ligne par ligne. */
  lignes: LigneRapportImport[];
  /** ID de la ligne `imports_excel` créée pour audit (null si pas encore tracé). */
  import_id: string | null;
  /** ID de la session d'import (pour rollback). */
  import_session_id: string | null;
  /** Date limite de rollback (ISO). Null si rollback non disponible. */
  rollback_expire_at: string | null;
  execute_a: string;
};

export type ResultatImportEnrichi =
  | { status: 'succes'; rapport: RapportImportEnrichi }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_fichier'; message: string }
  | { status: 'erreur_inconnue'; message: string };

// =============================================================================
// Rollback d'une session d'import
// =============================================================================

export type ResultatRollbackImport =
  | { status: 'succes'; nb_annules: number; session_id: string }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_session'; message: string }
  | { status: 'rollback_expire'; message: string };
