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
  /** Détail des erreurs ligne par ligne. */
  erreurs: ErreurImport[];
  /** ID de la ligne `imports_excel` créée pour audit. */
  import_id: string | null;
  /** Date d'exécution de l'import (ISO). */
  execute_a: string;
};

export type ResultatImport =
  | { status: 'succes'; rapport: RapportImport }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_fichier'; message: string }
  | { status: 'erreur_inconnue'; message: string };
