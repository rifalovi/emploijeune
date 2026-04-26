import { COLONNES_A1, CONSENTEMENT_LIBELLES } from '@/lib/beneficiaires/export-helpers';
import {
  DOMAINES_FORMATION_CODES,
  MODALITES_FORMATION_CODES,
  MODALITE_FORMATION_LIBELLES,
  STATUTS_BENEFICIAIRE_CODES,
  STATUT_BENEFICIAIRE_LIBELLES,
  SEXE_VALUES,
  PROJETS_CODES,
  PAYS_CODES,
} from '@/lib/schemas/nomenclatures';
import type { BeneficiaireInsertInput } from '@/lib/schemas/beneficiaire';

/**
 * Mapping Excel → champs métier bénéficiaires (Étape 7).
 *
 * Convention V1 : on accepte AU CHOIX le code (PROJ_A14, NUM_INFO,
 * FORMATION_ACHEVEE) OU le libellé (« Numérique et informatique »,
 * « Formation achevée ») — l'import est tolérant pour faciliter
 * l'usage par des utilisateurs non techniques.
 *
 * Les en-têtes Excel attendus correspondent à `COLONNES_A1` (cycle
 * export-import garanti par le test d'acceptance Étape 4e).
 */

export const HEADERS_A1 = COLONNES_A1.map((c) => c.header);

/**
 * Sous-ensemble obligatoire (en-tête doit exister dans le fichier).
 * Aligné sur les `*` du Template V1 — sans ces colonnes, l'import est
 * impossible. Les autres colonnes optionnelles peuvent être absentes.
 */
export const HEADERS_A1_OBLIGATOIRES = [
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
] as const;

/**
 * Convertit une ligne Excel parsée en payload Zod-prêt.
 * Retourne `donneesParsees` ou la liste d'erreurs de mapping.
 */
export function mapLigneVersBeneficiaire(donnees: Record<string, unknown>): {
  donneesParsees: BeneficiaireInsertInput | null;
  erreursMapping: Array<{ colonne: string; valeur: string | null; message: string }>;
} {
  const erreurs: Array<{ colonne: string; valeur: string | null; message: string }> = [];

  const projet = lireCodeOuLibelle(donnees['Code projet *'], PROJETS_CODES, {});
  const pays = lireCodeOuLibelle(donnees['Code pays bénéficiaire *'], PAYS_CODES, {});
  const sexe = lireCodeOuLibelle(donnees['Sexe *'], SEXE_VALUES, {
    Femme: 'F',
    Homme: 'M',
    F: 'F',
    M: 'M',
    Autre: 'Autre',
  });
  const domaine = lireCodeOuLibelle(
    donnees['Domaine de formation *'],
    DOMAINES_FORMATION_CODES,
    {},
  );
  const modalite = lireCodeOuLibelle(donnees['Modalité *'], MODALITES_FORMATION_CODES, {
    [MODALITE_FORMATION_LIBELLES.PRESENTIEL]: 'PRESENTIEL',
    [MODALITE_FORMATION_LIBELLES.EN_LIGNE]: 'EN_LIGNE',
    [MODALITE_FORMATION_LIBELLES.HYBRIDE]: 'HYBRIDE',
  });
  const statut = lireCodeOuLibelle(donnees['Statut *'], STATUTS_BENEFICIAIRE_CODES, {
    [STATUT_BENEFICIAIRE_LIBELLES.INSCRIT]: 'INSCRIT',
    [STATUT_BENEFICIAIRE_LIBELLES.PRESENT_EFFECTIF]: 'PRESENT_EFFECTIF',
    [STATUT_BENEFICIAIRE_LIBELLES.FORMATION_ACHEVEE]: 'FORMATION_ACHEVEE',
    [STATUT_BENEFICIAIRE_LIBELLES.ABANDON]: 'ABANDON',
    [STATUT_BENEFICIAIRE_LIBELLES.NON_PRECISE]: 'NON_PRECISE',
  });
  const consentement = lireConsentement(donnees['Consentement *']);

  // Erreurs accumulées
  if (!projet)
    erreurs.push({
      colonne: 'Code projet *',
      valeur: stringify(donnees['Code projet *']),
      message: 'Code projet non reconnu (attendu : PROJ_A01a..PROJ_A20).',
    });
  if (!pays)
    erreurs.push({
      colonne: 'Code pays bénéficiaire *',
      valeur: stringify(donnees['Code pays bénéficiaire *']),
      message: 'Code pays non reconnu (ex. MLI, BFA, FRA).',
    });
  if (!sexe)
    erreurs.push({
      colonne: 'Sexe *',
      valeur: stringify(donnees['Sexe *']),
      message: 'Sexe attendu : F, M ou Autre (ou libellé Femme/Homme).',
    });
  if (!domaine)
    erreurs.push({
      colonne: 'Domaine de formation *',
      valeur: stringify(donnees['Domaine de formation *']),
      message: 'Domaine non reconnu (utilisez un code ou libellé exact du template).',
    });
  if (!modalite)
    erreurs.push({
      colonne: 'Modalité *',
      valeur: stringify(donnees['Modalité *']),
      message: 'Modalité attendue : Présentiel, En ligne ou Hybride.',
    });
  if (!statut)
    erreurs.push({
      colonne: 'Statut *',
      valeur: stringify(donnees['Statut *']),
      message: 'Statut non reconnu.',
    });
  if (consentement === null)
    erreurs.push({
      colonne: 'Consentement *',
      valeur: stringify(donnees['Consentement *']),
      message: 'Consentement attendu : Oui ou Non (ou libellé complet du template).',
    });

  if (
    erreurs.length > 0 ||
    !projet ||
    !pays ||
    !sexe ||
    !domaine ||
    !modalite ||
    !statut ||
    consentement === null
  ) {
    return { donneesParsees: null, erreursMapping: erreurs };
  }

  const annee = lireNombre(donnees['Année de la formation *']);
  if (annee === null) {
    erreurs.push({
      colonne: 'Année de la formation *',
      valeur: stringify(donnees['Année de la formation *']),
      message: 'Année invalide (attendu : entier 2020-2030).',
    });
    return { donneesParsees: null, erreursMapping: erreurs };
  }

  const payload: BeneficiaireInsertInput = {
    prenom: lireTexte(donnees['Prénom *']) ?? '',
    nom: lireTexte(donnees['Nom *']) ?? '',
    sexe,
    date_naissance: lireDateOpt(donnees['Date de naissance (jj/mm/aaaa)']) as unknown as undefined,
    projet_code: projet,
    pays_code: pays,
    partenaire_accompagnement: lireTexte(donnees["Partenaire d'accompagnement"]),
    domaine_formation_code: domaine,
    intitule_formation: lireTexte(donnees['Intitulé précis formation']),
    modalite_formation_code: modalite,
    annee_formation: annee,
    date_debut_formation: lireDateOpt(donnees['Date début formation']) as unknown as undefined,
    date_fin_formation: lireDateOpt(donnees['Date fin formation']) as unknown as undefined,
    statut_code: statut,
    fonction_actuelle: lireTexte(donnees['Fonction / Statut actuel']),
    consentement_recueilli: consentement,
    telephone: lireTexte(donnees['Téléphone (avec indicatif)']),
    courriel: lireTexte(donnees['Courriel']),
    localite_residence: lireTexte(donnees['Localité de résidence']),
    commentaire: lireTexte(donnees['Commentaire']),
  };

  return { donneesParsees: payload, erreursMapping: [] };
}

// =============================================================================
// Helpers de lecture
// =============================================================================

function stringify(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function lireTexte(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

function lireNombre(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Lit une date au format ISO (YYYY-MM-DD), DD/MM/YYYY ou DD-MM-YYYY.
 * Retourne une string ISO ou undefined.
 */
function lireDateOpt(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const matchFR = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/.exec(v);
    if (matchFR) return `${matchFR[3]}-${matchFR[2]}-${matchFR[1]}`;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return undefined;
}

/**
 * Accepte un code direct (ex. PROJ_A14) OU un libellé (via map).
 * Retourne le code ou undefined si non reconnu.
 */
function lireCodeOuLibelle<T extends string>(
  v: unknown,
  codesValides: ReadonlyArray<T>,
  mapLibelles: Record<string, T>,
): T | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const s = String(v).trim();
  // Match code direct
  if ((codesValides as readonly string[]).includes(s)) return s as T;
  // Match libellé
  if (s in mapLibelles) return mapLibelles[s];
  // Match libellé case-insensitive
  for (const [libelle, code] of Object.entries(mapLibelles)) {
    if (libelle.toLowerCase() === s.toLowerCase()) return code;
  }
  return undefined;
}

function lireConsentement(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'oui' || s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'non' || s === 'false' || s === '0' || s === 'no') return false;
  if (s === CONSENTEMENT_LIBELLES.true.toLowerCase()) return true;
  if (s === CONSENTEMENT_LIBELLES.false.toLowerCase()) return false;
  return null;
}
