import { COLONNES_B1 } from '@/lib/structures/export-helpers';
import { nettoyerTexte } from '@/lib/imports/normalizer-garbage';
import {
  normaliserCodeProjet,
  normaliserCodePays,
  normaliserTypeStructure,
  normaliserSecteurActivite,
  normaliserStatutCreation,
  normaliserNatureAppui,
  normaliserSexe,
  normaliserConsentement,
} from '@/lib/imports/smart-mapper';
import {
  TYPES_STRUCTURE_CODES,
  SECTEURS_ACTIVITE_CODES,
  NATURES_APPUI_CODES,
  STATUTS_STRUCTURE_VALUES,
  DEVISES_CODES,
  TYPE_STRUCTURE_LIBELLES,
  SECTEUR_ACTIVITE_LIBELLES,
  NATURE_APPUI_LIBELLES,
  STATUT_STRUCTURE_LIBELLES,
  DEVISE_LIBELLES,
  SEXE_VALUES,
  PROJETS_CODES,
  PAYS_CODES,
} from '@/lib/schemas/nomenclatures';
import type { StructureInsertInput } from '@/lib/schemas/structure';

/**
 * Mapping Excel → champs métier structures (Étape 7).
 * Mêmes principes que mapping-beneficiaires : code OU libellé acceptés.
 */

export const HEADERS_B1 = COLONNES_B1.map((c) => c.header);

export const HEADERS_B1_OBLIGATOIRES = [
  'Code projet *',
  'Code pays *',
  'Nom structure *',
  'Type structure *',
  'Secteur activité *',
  'Statut création *',
  'Année appui *',
  'Nature appui *',
  'Consentement *',
  'Porteur – nom *',
  'Porteur – sexe *',
] as const;

export type MapStructureOptions = {
  /**
   * Mode « absorber le maximum » : les champs obligatoires absents ou non
   * reconnus reçoivent une valeur par défaut sûre au lieu de rejeter la ligne.
   * Utilisé par l'import Excel/CSV classique (fichiers terrain hétérogènes,
   * ex. « Base des micro-entreprises » sans colonnes statut/consentement/sexe).
   */
  tolerant?: boolean;
  /** Code projet appliqué si absent des cellules (mode tolérant). */
  codeProjetDefaut?: string;
};

export function mapLigneVersStructure(
  donneesBrut: Record<string, unknown>,
  options: MapStructureOptions = {},
): {
  donneesParsees: StructureInsertInput | null;
  erreursMapping: Array<{ colonne: string; valeur: string | null; message: string }>;
} {
  const tolerant = options.tolerant === true;
  // Normalisation des tirets em-dash (—) ↔ en-dash (–) dans les CLÉS ET
  // les valeurs string. Évite que `donnees['Porteur – nom *']` retourne
  // undefined quand le fichier a "Porteur — nom *" (ou inversement).
  // Cohérent avec la philosophie "absorber le maximum" du sprint import.
  const donnees = normaliserDashes(donneesBrut);
  const erreurs: Array<{ colonne: string; valeur: string | null; message: string }> = [];

  // ── Champs codifiés ───────────────────────────────────────────────────────
  // Strict : lecture code/libellé exact (rejet si non reconnu).
  // Tolérant : normaliseurs du smart-mapper (alias P14→PROJ_A14, libellés pays
  //   français, défauts 'AUTRE') + valeurs par défaut pour les champs absents.
  let projet = tolerant
    ? (normaliserCodeProjet(donnees['Code projet *']) ?? undefined)
    : lireCodeOuLibelle(donnees['Code projet *'], PROJETS_CODES, {});
  if (!projet && tolerant && options.codeProjetDefaut) {
    projet = normaliserCodeProjet(options.codeProjetDefaut) ?? undefined;
  }

  let pays = tolerant
    ? (normaliserCodePays(donnees['Code pays *']) ?? undefined)
    : lireCodeOuLibelle(donnees['Code pays *'], PAYS_CODES, {});

  const rawType = donnees['Type structure *'];
  const typeStructure = tolerant
    ? (normaliserTypeStructure(rawType) ?? 'AUTRE')
    : lireCodeOuLibelle(rawType, TYPES_STRUCTURE_CODES, inverser(TYPE_STRUCTURE_LIBELLES));

  const rawSecteur = donnees['Secteur activité *'];
  const secteur = tolerant
    ? (normaliserSecteurActivite(rawSecteur) ?? 'AUTRE')
    : lireCodeOuLibelle(rawSecteur, SECTEURS_ACTIVITE_CODES, inverser(SECTEUR_ACTIVITE_LIBELLES));

  const statutCreation = tolerant
    ? (normaliserStatutCreation(donnees['Statut création *']) ?? 'creation')
    : lireCodeOuLibelle(
        donnees['Statut création *'],
        STATUTS_STRUCTURE_VALUES,
        inverser(STATUT_STRUCTURE_LIBELLES),
      );

  const rawNature = donnees['Nature appui *'];
  const natureAppui = tolerant
    ? (normaliserNatureAppui(rawNature) ?? 'AUTRE')
    : lireCodeOuLibelle(rawNature, NATURES_APPUI_CODES, inverser(NATURE_APPUI_LIBELLES));

  let devise = lireCodeOuLibelleOpt(donnees['Devise'], DEVISES_CODES, inverser(DEVISE_LIBELLES));

  const sexePorteur = tolerant
    ? (normaliserSexe(donnees['Porteur – sexe *']) ?? 'Autre')
    : lireCodeOuLibelle(donnees['Porteur – sexe *'], SEXE_VALUES, {
        Femme: 'F',
        Homme: 'M',
        F: 'F',
        M: 'M',
        Autre: 'Autre',
      });

  const consentementBrut = tolerant
    ? normaliserConsentement(donnees['Consentement *'])
    : lireConsentement(donnees['Consentement *']);
  // En mode tolérant, l'absence de consentement vaut « non recueilli » (false) :
  // on importe la fiche mais on ne conservera AUCUN contact (cf. RGPD ci-dessous).
  const consentement = tolerant ? (consentementBrut ?? false) : consentementBrut;

  // Le code projet reste obligatoire dans les deux modes (impossible à inventer).
  if (!projet)
    erreurs.push({
      colonne: 'Code projet *',
      valeur: stringify(donnees['Code projet *']),
      message: 'Code projet non reconnu.',
    });
  if (!pays) {
    // Fallback ZZZ : tolérer + alerter (cf. Phase 2.4 résolution ZZZ)
    pays = 'ZZZ';
  }

  // Les champs ci-dessous ne sont rejetés QU'EN MODE STRICT. En mode tolérant
  // ils ont reçu une valeur par défaut sûre.
  if (!tolerant) {
    if (!typeStructure)
      erreurs.push({
        colonne: 'Type structure *',
        valeur: stringify(donnees['Type structure *']),
        message: 'Type non reconnu.',
      });
    if (!secteur)
      erreurs.push({
        colonne: 'Secteur activité *',
        valeur: stringify(donnees['Secteur activité *']),
        message: 'Secteur non reconnu.',
      });
    if (!statutCreation)
      erreurs.push({
        colonne: 'Statut création *',
        valeur: stringify(donnees['Statut création *']),
        message: 'Statut attendu : Création, Renforcement ou Relance.',
      });
    if (!natureAppui)
      erreurs.push({
        colonne: 'Nature appui *',
        valeur: stringify(donnees['Nature appui *']),
        message: 'Nature d’appui non reconnue.',
      });
    if (!sexePorteur)
      erreurs.push({
        colonne: 'Porteur – sexe *',
        valeur: stringify(donnees['Porteur – sexe *']),
        message: 'Sexe attendu : F, M ou Autre.',
      });
    if (consentement === null)
      erreurs.push({
        colonne: 'Consentement *',
        valeur: stringify(donnees['Consentement *']),
        message: 'Consentement attendu : Oui ou Non.',
      });
  }

  if (
    erreurs.length > 0 ||
    !projet ||
    !typeStructure ||
    !secteur ||
    !statutCreation ||
    !natureAppui ||
    !sexePorteur ||
    consentement === null
  ) {
    return { donneesParsees: null, erreursMapping: erreurs };
  }

  let annee = lireNombre(donnees['Année appui *']);
  if (annee === null) {
    if (tolerant) {
      // Année d'appui absente → année courante par défaut (donnée collectée
      // jugée utile : on conserve la fiche, l'année reste corrigeable).
      annee = new Date().getFullYear();
    } else {
      erreurs.push({
        colonne: 'Année appui *',
        valeur: stringify(donnees['Année appui *']),
        message: 'Année invalide.',
      });
      return { donneesParsees: null, erreursMapping: erreurs };
    }
  }

  const nomStructure = lireTexte(donnees['Nom structure *']);
  if (!nomStructure) {
    erreurs.push({
      colonne: 'Nom structure *',
      valeur: null,
      message: 'Nom de structure obligatoire.',
    });
    return { donneesParsees: null, erreursMapping: erreurs };
  }

  let porteurNom = lireTexte(donnees['Porteur – nom *']);
  if (!porteurNom) {
    if (tolerant) {
      // Porteur non renseigné → repli sur le nom de la structure, afin que la
      // fiche reste identifiable.
      porteurNom = nettoyerNomPorteur(nomStructure);
    } else {
      erreurs.push({
        colonne: 'Porteur – nom *',
        valeur: null,
        message: 'Nom du porteur obligatoire.',
      });
      return { donneesParsees: null, erreursMapping: erreurs };
    }
  } else if (tolerant) {
    // Nom de responsable issu du terrain : peut contenir chiffres / parenthèses.
    // On le nettoie pour respecter le format nom (lettres/espaces/tirets).
    porteurNom = nettoyerNomPorteur(porteurNom);
  }

  // Montant sans devise (mode tolérant) → devise « Autre » (montant utile mais
  // monnaie non précisée dans le fichier). Évite le rejet montant↔devise.
  const montantAppui = lireNombreFloat(donnees['Montant appui']) ?? undefined;
  if (tolerant && montantAppui !== undefined && !devise) {
    devise = 'Autre';
  }

  // Précisions libres : si le code a été ramené à 'AUTRE' faute de correspondance
  // mais qu'une valeur brute existe, on la conserve dans le champ « précision »
  // (donnée collectée = donnée utile). Ne s'applique qu'en mode tolérant.
  const typeAutre =
    lireTexte(donnees['Type structure – précision']) ??
    (tolerant && typeStructure === 'AUTRE' ? troncature(lireTexte(rawType), 200) : undefined);
  const secteurPrecis =
    lireTexte(donnees['Secteur précis']) ??
    (tolerant && secteur === 'AUTRE' ? troncature(lireTexte(rawSecteur), 200) : undefined);
  const natureAutre =
    lireTexte(donnees['Nature appui – précision']) ??
    (tolerant && natureAppui === 'AUTRE' ? troncature(lireTexte(rawNature), 200) : undefined);

  // RGPD : aucun contact conservé sans consentement explicitement recueilli.
  const contactsAutorises = consentement === true;
  const telephone = contactsAutorises
    ? lireTexte(donnees['Téléphone (avec indicatif)'])
    : undefined;
  const courriel = contactsAutorises ? lireTexte(donnees['Courriel porteur']) : undefined;

  const intituleInitiative = tolerant
    ? troncature(lireTexte(donnees['Intitulé initiative']), 300)
    : lireTexte(donnees['Intitulé initiative']);

  const payload: StructureInsertInput = {
    nom_structure: tolerant ? troncature(nomStructure, 200)! : nomStructure,
    type_structure_code: typeStructure,
    type_structure_autre: typeAutre,
    secteur_activite_code: secteur,
    secteur_precis: secteurPrecis,
    intitule_initiative: intituleInitiative,
    date_creation: lireDateOpt(donnees['Date création structure']) as unknown as undefined,
    statut_creation: statutCreation as 'creation' | 'renforcement' | 'relance',
    projet_code: projet,
    pays_code: pays,
    porteur_prenom: lireTexte(donnees['Porteur – prénom']),
    porteur_nom: porteurNom,
    porteur_sexe: sexePorteur,
    porteur_date_naissance: lireDateOpt(
      donnees['Porteur – date naissance'],
    ) as unknown as undefined,
    fonction_porteur: lireTexte(donnees['Fonction porteur']),
    annee_appui: annee,
    nature_appui_code: natureAppui,
    nature_appui_autre: natureAutre,
    montant_appui: montantAppui,
    devise_code: devise,
    consentement_recueilli: consentement,
    consentement_date: lireDateOpt(donnees['Date consentement']) as unknown as undefined,
    telephone_porteur: telephone,
    courriel_porteur: courriel,
    adresse: lireTexte(donnees['Adresse']),
    ville: lireTexte(donnees['Ville']),
    localite: lireTexte(donnees['Localité']),
    latitude: lireNombreFloat(donnees['Latitude']) ?? undefined,
    longitude: lireNombreFloat(donnees['Longitude']) ?? undefined,
    chiffre_affaires: lireNombreFloat(donnees['Chiffre d’affaires']) ?? undefined,
    employes_permanents: lireNombre(donnees['Employés permanents']) ?? undefined,
    employes_temporaires: lireNombre(donnees['Employés temporaires']) ?? undefined,
    emplois_crees: lireNombre(donnees['Emplois créés']) ?? undefined,
    commentaire: lireTexte(donnees['Commentaire']),
  };

  return { donneesParsees: payload, erreursMapping: [] };
}

// =============================================================================
// Helpers (dupliqués depuis mapping-beneficiaires pour découplage)
// =============================================================================

function inverser<K extends string, V extends string>(map: Record<K, V>): Record<V, K> {
  const result = {} as Record<V, K>;
  for (const [k, v] of Object.entries(map) as Array<[K, V]>) {
    result[v] = k;
  }
  return result;
}

function stringify(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function troncature(v: string | undefined, max: number): string | undefined {
  if (!v) return undefined;
  return v.length > max ? v.slice(0, max) : v;
}

/**
 * Nettoie un nom pour le format porteur (lettres, marques, espaces, apostrophes
 * et tirets uniquement — cf. `nomPrenomRegex` de structure.ts). Utilisé comme
 * repli quand le nom du porteur est absent (mode tolérant) : on dérive un nom
 * exploitable depuis le nom de la structure. Retourne 'NON RENSEIGNE' si rien
 * d'exploitable ne subsiste.
 */
function nettoyerNomPorteur(nom: string): string {
  const net = nom
    .normalize('NFC')
    // Apostrophes typographiques (’ ‘ ` ´) → apostrophe droite (seule autorisée)
    .replace(/[’‘`´]/g, "'")
    // Tout caractère hors lettres / marques / espaces / apostrophe / tiret → espace
    .replace(/[^\p{L}\p{M}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return net.length > 0 ? net : 'NON RENSEIGNE';
}

function lireTexte(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const s = String(v).trim();
  if (s === '') return undefined;
  // Filtre les valeurs parasites (ZZZ, N/A, ---, etc.) → champ vide
  const net = nettoyerTexte(s);
  return net ?? undefined;
}

function lireNombre(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function lireNombreFloat(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

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

function lireCodeOuLibelle<T extends string>(
  v: unknown,
  codesValides: ReadonlyArray<T>,
  mapLibelles: Record<string, T>,
): T | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const s = String(v).trim();
  if ((codesValides as readonly string[]).includes(s)) return s as T;
  if (s in mapLibelles) return mapLibelles[s];
  for (const [libelle, code] of Object.entries(mapLibelles)) {
    if (libelle.toLowerCase() === s.toLowerCase()) return code;
  }
  return undefined;
}

function lireCodeOuLibelleOpt<T extends string>(
  v: unknown,
  codesValides: ReadonlyArray<T>,
  mapLibelles: Record<string, T>,
): T | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  return lireCodeOuLibelle(v, codesValides, mapLibelles);
}

function lireConsentement(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'oui' || s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'non' || s === 'false' || s === '0' || s === 'no') return false;
  if (s.startsWith('oui')) return true;
  if (s.startsWith('non')) return false;
  return null;
}

/**
 * Normalise les tirets em-dash (U+2014) en en-dash (U+2013) dans les clés et
 * les valeurs string d'un Record. Utile pour absorber les fichiers Excel
 * produits avant le sprint typo (em-dash → en-dash, commit bdb6891) qui
 * contiennent encore l'ancienne forme.
 */
function normaliserDashes(donnees: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(donnees)) {
    const cleNormalisee = k.replace(/—/g, '–');
    const valeurNormalisee = typeof v === 'string' ? v.replace(/—/g, '–') : v;
    out[cleNormalisee] = valeurNormalisee;
  }
  return out;
}
