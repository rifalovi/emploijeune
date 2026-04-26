import { COLONNES_B1 } from '@/lib/structures/export-helpers';
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
  'Porteur — nom *',
  'Porteur — sexe *',
] as const;

export function mapLigneVersStructure(donnees: Record<string, unknown>): {
  donneesParsees: StructureInsertInput | null;
  erreursMapping: Array<{ colonne: string; valeur: string | null; message: string }>;
} {
  const erreurs: Array<{ colonne: string; valeur: string | null; message: string }> = [];

  const projet = lireCodeOuLibelle(donnees['Code projet *'], PROJETS_CODES, {});
  const pays = lireCodeOuLibelle(donnees['Code pays *'], PAYS_CODES, {});
  const typeStructure = lireCodeOuLibelle(
    donnees['Type structure *'],
    TYPES_STRUCTURE_CODES,
    inverser(TYPE_STRUCTURE_LIBELLES),
  );
  const secteur = lireCodeOuLibelle(
    donnees['Secteur activité *'],
    SECTEURS_ACTIVITE_CODES,
    inverser(SECTEUR_ACTIVITE_LIBELLES),
  );
  const statutCreation = lireCodeOuLibelle(
    donnees['Statut création *'],
    STATUTS_STRUCTURE_VALUES,
    inverser(STATUT_STRUCTURE_LIBELLES),
  );
  const natureAppui = lireCodeOuLibelle(
    donnees['Nature appui *'],
    NATURES_APPUI_CODES,
    inverser(NATURE_APPUI_LIBELLES),
  );
  const devise = lireCodeOuLibelleOpt(donnees['Devise'], DEVISES_CODES, inverser(DEVISE_LIBELLES));
  const sexePorteur = lireCodeOuLibelle(donnees['Porteur — sexe *'], SEXE_VALUES, {
    Femme: 'F',
    Homme: 'M',
    F: 'F',
    M: 'M',
    Autre: 'Autre',
  });
  const consentement = lireConsentement(donnees['Consentement *']);

  if (!projet)
    erreurs.push({
      colonne: 'Code projet *',
      valeur: stringify(donnees['Code projet *']),
      message: 'Code projet non reconnu.',
    });
  if (!pays)
    erreurs.push({
      colonne: 'Code pays *',
      valeur: stringify(donnees['Code pays *']),
      message: 'Code pays non reconnu.',
    });
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
      colonne: 'Porteur — sexe *',
      valeur: stringify(donnees['Porteur — sexe *']),
      message: 'Sexe attendu : F, M ou Autre.',
    });
  if (consentement === null)
    erreurs.push({
      colonne: 'Consentement *',
      valeur: stringify(donnees['Consentement *']),
      message: 'Consentement attendu : Oui ou Non.',
    });

  if (
    erreurs.length > 0 ||
    !projet ||
    !pays ||
    !typeStructure ||
    !secteur ||
    !statutCreation ||
    !natureAppui ||
    !sexePorteur ||
    consentement === null
  ) {
    return { donneesParsees: null, erreursMapping: erreurs };
  }

  const annee = lireNombre(donnees['Année appui *']);
  if (annee === null) {
    erreurs.push({
      colonne: 'Année appui *',
      valeur: stringify(donnees['Année appui *']),
      message: 'Année invalide.',
    });
    return { donneesParsees: null, erreursMapping: erreurs };
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

  const porteurNom = lireTexte(donnees['Porteur — nom *']);
  if (!porteurNom) {
    erreurs.push({
      colonne: 'Porteur — nom *',
      valeur: null,
      message: 'Nom du porteur obligatoire.',
    });
    return { donneesParsees: null, erreursMapping: erreurs };
  }

  const payload: StructureInsertInput = {
    nom_structure: nomStructure,
    type_structure_code: typeStructure,
    secteur_activite_code: secteur,
    secteur_precis: lireTexte(donnees['Secteur précis']),
    intitule_initiative: lireTexte(donnees['Intitulé initiative']),
    date_creation: lireDateOpt(donnees['Date création structure']) as unknown as undefined,
    statut_creation: statutCreation as 'creation' | 'renforcement' | 'relance',
    projet_code: projet,
    pays_code: pays,
    porteur_prenom: lireTexte(donnees['Porteur — prénom']),
    porteur_nom: porteurNom,
    porteur_sexe: sexePorteur,
    porteur_date_naissance: lireDateOpt(
      donnees['Porteur — date naissance'],
    ) as unknown as undefined,
    fonction_porteur: lireTexte(donnees['Fonction porteur']),
    annee_appui: annee,
    nature_appui_code: natureAppui,
    montant_appui: lireNombreFloat(donnees['Montant appui']) ?? undefined,
    devise_code: devise,
    consentement_recueilli: consentement,
    consentement_date: lireDateOpt(donnees['Date consentement']) as unknown as undefined,
    telephone_porteur: lireTexte(donnees['Téléphone (avec indicatif)']),
    courriel_porteur: lireTexte(donnees['Courriel porteur']),
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
