/**
 * Helpers de génération Excel pour l'export structures (indicateur B1).
 *
 * Pattern miroir de `lib/beneficiaires/export-helpers.ts` (Étape 4e) adapté
 * aux 33+4 colonnes structures + nomenclatures B1.
 *
 * Décision Étape 5e : on exporte 37 colonnes au total — 13 essentielles
 * (alignées sur le formulaire 5c sections 1-4 + RGPD), 20 détails optionnels
 * (porteur étendu, géolocalisation, indicateurs B), 4 métadonnées techniques.
 *
 * Tri serveur : `projet_code` puis `nom_structure` (ordre alphabétique
 * stable, indépendant de la date de saisie). Tests d'acceptance dans
 * `tests/unit/export-structures.spec.ts`.
 */

import ExcelJS from 'exceljs';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import {
  SEXE_LIBELLES,
  PROJETS_CODES,
  PAYS_CODES,
  SEXE_VALUES,
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
  type Sexe,
  type TypeStructureCode,
  type SecteurActiviteCode,
  type NatureAppuiCode,
  type StatutStructure,
  type DeviseCode,
} from '@/lib/schemas/nomenclatures';

// =============================================================================
// Constantes : en-têtes B1 alignés sur les sections du formulaire (Étape 5c)
// =============================================================================

/**
 * 37 colonnes B1 dans l'ordre de l'export. Ne pas modifier sans validation
 * du SCS (briser la stabilité du fichier de référence).
 *
 *   Cols 1-13  : section essentielle (toujours remplies)
 *   Cols 14-33 : détails optionnels (porteur étendu, géoloc, indicateurs B)
 *   Cols 34-37 : métadonnées techniques
 */
export const COLONNES_B1 = [
  // --- Section essentielle (1-13) ---
  { key: 'id', header: 'ID_unique', width: 38 },
  { key: 'projet_code', header: 'Code projet *', width: 14 },
  { key: 'pays_code', header: 'Code pays *', width: 12 },
  { key: 'nom_structure', header: 'Nom structure *', width: 30 },
  { key: 'type_structure', header: 'Type structure *', width: 22 },
  { key: 'secteur_activite', header: 'Secteur activité *', width: 26 },
  { key: 'statut_creation', header: 'Statut création *', width: 16 },
  { key: 'intitule_initiative', header: 'Intitulé initiative', width: 32 },
  { key: 'annee_appui', header: 'Année appui *', width: 12 },
  { key: 'nature_appui', header: 'Nature appui *', width: 22 },
  { key: 'montant_appui', header: 'Montant appui', width: 16 },
  { key: 'devise', header: 'Devise', width: 12 },
  { key: 'consentement', header: 'Consentement *', width: 26 },
  // --- Détails optionnels (14-33) ---
  { key: 'porteur_prenom', header: 'Porteur — prénom', width: 18 },
  { key: 'porteur_nom', header: 'Porteur — nom *', width: 20 },
  { key: 'porteur_sexe', header: 'Porteur — sexe *', width: 8 },
  { key: 'porteur_date_naissance', header: 'Porteur — date naissance', width: 18 },
  { key: 'fonction_porteur', header: 'Fonction porteur', width: 22 },
  { key: 'telephone_porteur', header: 'Téléphone (avec indicatif)', width: 20 },
  { key: 'courriel_porteur', header: 'Courriel porteur', width: 28 },
  { key: 'consentement_date', header: 'Date consentement', width: 18 },
  { key: 'adresse', header: 'Adresse', width: 28 },
  { key: 'ville', header: 'Ville', width: 18 },
  { key: 'localite', header: 'Localité', width: 18 },
  { key: 'latitude', header: 'Latitude', width: 12 },
  { key: 'longitude', header: 'Longitude', width: 12 },
  { key: 'date_creation', header: 'Date création structure', width: 18 },
  { key: 'secteur_precis', header: 'Secteur précis', width: 24 },
  { key: 'chiffre_affaires', header: 'Chiffre d’affaires', width: 16 },
  { key: 'employes_permanents', header: 'Employés permanents', width: 14 },
  { key: 'employes_temporaires', header: 'Employés temporaires', width: 14 },
  { key: 'emplois_crees', header: 'Emplois créés', width: 12 },
  { key: 'commentaire', header: 'Commentaire', width: 30 },
  // --- Métadonnées techniques (34-37) ---
  { key: 'organisation', header: 'Organisation appui', width: 28 },
  { key: 'source_import', header: 'Source', width: 14 },
  { key: 'created_at', header: 'Créé le', width: 18 },
  { key: 'updated_at', header: 'Modifié le', width: 18 },
] as const;

/** Libellés des 2 valeurs de consentement (alignés sur l'export A1). */
export const CONSENTEMENT_LIBELLES: Record<'true' | 'false', string> = {
  true: 'Oui — consentement recueilli',
  false: 'Non — pas de consentement',
};

// =============================================================================
// Types partagés
// =============================================================================

export type StructureExportRow = {
  id: string;
  nom_structure: string;
  type_structure_code: string;
  secteur_activite_code: string;
  secteur_precis: string | null;
  intitule_initiative: string | null;
  date_creation: string | null;
  statut_creation: 'creation' | 'renforcement' | 'relance';

  projet_code: string;
  pays_code: string;
  organisation_id: string | null;
  organisation_nom: string | null;

  porteur_prenom: string | null;
  porteur_nom: string;
  porteur_sexe: 'F' | 'M' | 'Autre';
  porteur_date_naissance: string | null;
  fonction_porteur: string | null;

  annee_appui: number;
  nature_appui_code: string;
  montant_appui: number | null;
  devise_code: string | null;

  consentement_recueilli: boolean;
  consentement_date: string | null;
  telephone_porteur: string | null;
  courriel_porteur: string | null;

  adresse: string | null;
  ville: string | null;
  localite: string | null;
  latitude: number | null;
  longitude: number | null;

  chiffre_affaires: number | null;
  employes_permanents: number | null;
  employes_temporaires: number | null;
  emplois_crees: number | null;

  commentaire: string | null;

  source_import: string;
  created_at: string;
  updated_at: string;
};

export type ExportStructuresFiltresAppliques = {
  q?: string;
  projet_code?: string;
  ps?: string;
  pays_code?: string;
  type_structure_code?: string;
  secteur_activite_code?: string;
  nature_appui_code?: string;
  statut_creation?: string;
  annee_appui?: number;
  mien?: boolean;
};

export type ExportStructuresContext = {
  utilisateurNomComplet: string;
  utilisateurEmail: string;
  utilisateurRole: string;
  filtresAppliques: ExportStructuresFiltresAppliques;
  nombreLignes: number;
  dateExport: Date;
  appVersion: string;
};

// =============================================================================
// Fonction principale : génération du Buffer Excel
// =============================================================================

/**
 * Produit un classeur Excel B1 avec 3 feuilles :
 *   1. « Nomenclatures B1 » (cachée) — listes de référence pour validations
 *   2. « Structures B1 » — 37 colonnes triées projet+nom + data validations
 *   3. « Metadata » — contexte de l'export (date, filtres, utilisateur)
 */
export async function genererClasseurStructures(
  rows: StructureExportRow[],
  nomenclatures: Nomenclatures,
  context: ExportStructuresContext,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = context.utilisateurNomComplet;
  workbook.lastModifiedBy = context.utilisateurNomComplet;
  workbook.created = context.dateExport;
  workbook.modified = context.dateExport;
  workbook.properties = {
    ...workbook.properties,
    date1904: false,
  };
  Object.assign(workbook, {
    title: 'Export structures OIF Emploi Jeunes',
    subject: 'Données structures indicateur B1',
    company: 'Organisation Internationale de la Francophonie',
    keywords: 'OIF, structures, emploi jeunes, indicateur B1',
    description: `Export généré le ${context.dateExport.toISOString()} par ${context.utilisateurNomComplet} (rôle ${context.utilisateurRole}).`,
  });

  // Feuille 1 : Nomenclatures B1 (cachée)
  const wsNomenclatures = workbook.addWorksheet('Nomenclatures B1', { state: 'hidden' });
  ajouterListeReference(wsNomenclatures, 'A', [...PROJETS_CODES]);
  ajouterListeReference(wsNomenclatures, 'B', [...PAYS_CODES]);
  ajouterListeReference(
    wsNomenclatures,
    'C',
    [...TYPES_STRUCTURE_CODES].map(
      (code) => nomenclatures.typesStructure.get(code) ?? TYPE_STRUCTURE_LIBELLES[code] ?? code,
    ),
  );
  ajouterListeReference(
    wsNomenclatures,
    'D',
    [...SECTEURS_ACTIVITE_CODES].map(
      (code) => nomenclatures.secteursActivite.get(code) ?? SECTEUR_ACTIVITE_LIBELLES[code] ?? code,
    ),
  );
  ajouterListeReference(
    wsNomenclatures,
    'E',
    [...STATUTS_STRUCTURE_VALUES].map((code) => STATUT_STRUCTURE_LIBELLES[code]),
  );
  ajouterListeReference(
    wsNomenclatures,
    'F',
    [...NATURES_APPUI_CODES].map(
      (code) => nomenclatures.naturesAppui.get(code) ?? NATURE_APPUI_LIBELLES[code] ?? code,
    ),
  );
  ajouterListeReference(
    wsNomenclatures,
    'G',
    [...DEVISES_CODES].map(
      (code) => nomenclatures.devises.get(code) ?? DEVISE_LIBELLES[code] ?? code,
    ),
  );
  ajouterListeReference(wsNomenclatures, 'H', [
    CONSENTEMENT_LIBELLES.true,
    CONSENTEMENT_LIBELLES.false,
  ]);
  ajouterListeReference(wsNomenclatures, 'I', [...SEXE_VALUES]);

  // Feuille 2 : Structures B1
  const ws = workbook.addWorksheet('Structures B1', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = COLONNES_B1.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  headerRow.height = 40;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFEFEF' },
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFBDBDBD' } },
    };
  });

  rows.forEach((row) => {
    ws.addRow(mapperLigneExport(row, nomenclatures));
  });

  formaterColonnes(ws, rows.length);
  if (rows.length > 0) appliquerDataValidations(ws, rows.length);

  // Feuille 3 : Metadata
  const wsMeta = workbook.addWorksheet('Metadata');
  remplirFeuilleMetadata(wsMeta, context);

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

// =============================================================================
// Helpers internes
// =============================================================================

function ajouterListeReference(ws: ExcelJS.Worksheet, column: string, values: string[]): void {
  values.forEach((v, i) => {
    ws.getCell(`${column}${i + 1}`).value = v;
  });
}

function mapperLigneExport(
  r: StructureExportRow,
  nomenclatures: Nomenclatures,
): Record<string, unknown> {
  const typeLibelle =
    nomenclatures.typesStructure.get(r.type_structure_code) ??
    TYPE_STRUCTURE_LIBELLES[r.type_structure_code as TypeStructureCode] ??
    r.type_structure_code;
  const secteurLibelle =
    nomenclatures.secteursActivite.get(r.secteur_activite_code) ??
    SECTEUR_ACTIVITE_LIBELLES[r.secteur_activite_code as SecteurActiviteCode] ??
    r.secteur_activite_code;
  const natureLibelle =
    nomenclatures.naturesAppui.get(r.nature_appui_code) ??
    NATURE_APPUI_LIBELLES[r.nature_appui_code as NatureAppuiCode] ??
    r.nature_appui_code;
  const statutLibelle = STATUT_STRUCTURE_LIBELLES[r.statut_creation as StatutStructure];
  const deviseLibelle = r.devise_code
    ? (nomenclatures.devises.get(r.devise_code) ??
      DEVISE_LIBELLES[r.devise_code as DeviseCode] ??
      r.devise_code)
    : null;
  const sexeCode = SEXE_LIBELLES[r.porteur_sexe as Sexe] ? r.porteur_sexe : r.porteur_sexe;

  return {
    id: r.id,
    projet_code: r.projet_code,
    pays_code: r.pays_code,
    nom_structure: r.nom_structure,
    type_structure: typeLibelle,
    secteur_activite: secteurLibelle,
    statut_creation: statutLibelle,
    intitule_initiative: r.intitule_initiative,
    annee_appui: r.annee_appui,
    nature_appui: natureLibelle,
    montant_appui: r.montant_appui,
    devise: deviseLibelle,
    consentement: r.consentement_recueilli
      ? CONSENTEMENT_LIBELLES.true
      : CONSENTEMENT_LIBELLES.false,

    porteur_prenom: r.porteur_prenom,
    porteur_nom: r.porteur_nom,
    porteur_sexe: sexeCode,
    porteur_date_naissance: r.porteur_date_naissance ? new Date(r.porteur_date_naissance) : null,
    fonction_porteur: r.fonction_porteur,
    telephone_porteur: r.telephone_porteur,
    courriel_porteur: r.courriel_porteur,
    consentement_date: r.consentement_date ? new Date(r.consentement_date) : null,
    adresse: r.adresse,
    ville: r.ville,
    localite: r.localite,
    latitude: r.latitude,
    longitude: r.longitude,
    date_creation: r.date_creation ? new Date(r.date_creation) : null,
    secteur_precis: r.secteur_precis,
    chiffre_affaires: r.chiffre_affaires,
    employes_permanents: r.employes_permanents,
    employes_temporaires: r.employes_temporaires,
    emplois_crees: r.emplois_crees,
    commentaire: r.commentaire,

    organisation: r.organisation_nom,
    source_import: r.source_import,
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
  };
}

function formaterColonnes(ws: ExcelJS.Worksheet, nbLignes: number): void {
  if (nbLignes === 0) return;
  const dernierRow = nbLignes + 1;

  // Année appui : entier (col I = 9)
  ws.getColumn('I').numFmt = '0';
  // Montant appui : 2 décimales avec séparateur milliers (col K = 11)
  ws.getColumn('K').numFmt = '#,##0.00';
  // Téléphone : texte pour préserver le + (col S = 19)
  ws.getColumn('S').numFmt = '@';
  // Dates
  ws.getColumn('Q').numFmt = 'dd/mm/yyyy'; // porteur_date_naissance (17)
  ws.getColumn('U').numFmt = 'dd/mm/yyyy'; // consentement_date (21)
  ws.getColumn('AA').numFmt = 'dd/mm/yyyy'; // date_creation structure (27)
  ws.getColumn('AJ').numFmt = 'dd/mm/yyyy hh:mm'; // created_at (36)
  ws.getColumn('AK').numFmt = 'dd/mm/yyyy hh:mm'; // updated_at (37)
  // Coordonnées GPS : 6 décimales
  ws.getColumn('Y').numFmt = '0.000000'; // latitude (25)
  ws.getColumn('Z').numFmt = '0.000000'; // longitude (26)
  // Indicateurs B
  ws.getColumn('AC').numFmt = '#,##0.00'; // chiffre_affaires (29)
  ws.getColumn('AD').numFmt = '0'; // employes_permanents (30)
  ws.getColumn('AE').numFmt = '0'; // employes_temporaires (31)
  ws.getColumn('AF').numFmt = '0'; // emplois_crees (32)

  for (let r = 2; r <= dernierRow; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFEEEEEE' } },
      };
    });
  }
}

function appliquerDataValidations(ws: ExcelJS.Worksheet, nbLignes: number): void {
  const dernierRow = nbLignes + 1;
  const dvByColumn: Array<{ col: string; listeCol: string; nbValeurs: number }> = [
    { col: 'B', listeCol: 'A', nbValeurs: PROJETS_CODES.length }, // projet_code
    { col: 'C', listeCol: 'B', nbValeurs: PAYS_CODES.length }, // pays_code
    { col: 'E', listeCol: 'C', nbValeurs: TYPES_STRUCTURE_CODES.length }, // type_structure
    { col: 'F', listeCol: 'D', nbValeurs: SECTEURS_ACTIVITE_CODES.length }, // secteur_activite
    { col: 'G', listeCol: 'E', nbValeurs: STATUTS_STRUCTURE_VALUES.length }, // statut_creation
    { col: 'J', listeCol: 'F', nbValeurs: NATURES_APPUI_CODES.length }, // nature_appui
    { col: 'L', listeCol: 'G', nbValeurs: DEVISES_CODES.length }, // devise
    { col: 'M', listeCol: 'H', nbValeurs: 2 }, // consentement
    { col: 'P', listeCol: 'I', nbValeurs: SEXE_VALUES.length }, // porteur_sexe
  ];

  for (const { col, listeCol, nbValeurs } of dvByColumn) {
    const formula = `='Nomenclatures B1'!$${listeCol}$1:$${listeCol}$${nbValeurs}`;
    for (let r = 2; r <= dernierRow; r++) {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Valeur non reconnue',
        error: 'Cette valeur ne fait pas partie de la nomenclature officielle OIF.',
      };
    }
  }
}

function remplirFeuilleMetadata(ws: ExcelJS.Worksheet, ctx: ExportStructuresContext): void {
  ws.columns = [
    { header: '', width: 28 },
    { header: '', width: 60 },
  ];

  const dateLocale = ctx.dateExport.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const lignes: Array<[string, string]> = [
    ['Export généré par', 'Plateforme OIF Emploi Jeunes'],
    ['Indicateur', 'B1 — structures appuyées'],
    ['Date d’export', dateLocale],
    [
      'Utilisateur',
      ctx.utilisateurEmail
        ? `${ctx.utilisateurNomComplet} (${ctx.utilisateurEmail})`
        : ctx.utilisateurNomComplet,
    ],
    ['Rôle', ctx.utilisateurRole],
    ['Nombre de lignes exportées', ctx.nombreLignes.toLocaleString('fr-FR')],
    ['Plateforme', `v${ctx.appVersion}`],
    ['', ''],
    ['Filtres appliqués', ''],
  ];

  for (const [k, v] of lignes) {
    ws.addRow([k, v]);
  }

  const filtresLignes: Array<[string, string]> = [];
  const f = ctx.filtresAppliques;
  if (f.q) filtresLignes.push(['  • Recherche textuelle', `"${f.q}"`]);
  if (f.projet_code) filtresLignes.push(['  • Projet', f.projet_code]);
  if (f.ps) filtresLignes.push(['  • Programme Stratégique', f.ps]);
  if (f.pays_code) filtresLignes.push(['  • Pays', f.pays_code]);
  if (f.type_structure_code) filtresLignes.push(['  • Type structure', f.type_structure_code]);
  if (f.secteur_activite_code)
    filtresLignes.push(['  • Secteur activité', f.secteur_activite_code]);
  if (f.nature_appui_code) filtresLignes.push(['  • Nature appui', f.nature_appui_code]);
  if (f.statut_creation) filtresLignes.push(['  • Statut création', f.statut_creation]);
  if (f.annee_appui) filtresLignes.push(['  • Année appui', String(f.annee_appui)]);
  if (f.mien) filtresLignes.push(['  • Mode', 'Mes saisies uniquement']);
  if (filtresLignes.length === 0) filtresLignes.push(['  (aucun filtre)', '']);
  for (const [k, v] of filtresLignes) ws.addRow([k, v]);

  ws.getColumn(1).font = { bold: true };
  ws.getRow(1).font = { bold: true, size: 14 };
}

// =============================================================================
// Nom de fichier
// =============================================================================

/**
 * Format :
 *   - OIF_Structures_AAAAMMJJ_HHmm.xlsx (cas général)
 *   - OIF_Structures_PROJ_A14_AAAAMMJJ_HHmm.xlsx (si un seul projet filtré)
 */
export function construireNomFichierExportStructures(
  filtres: ExportStructuresFiltresAppliques,
  date: Date = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;

  const projet = filtres.projet_code;
  if (projet) {
    return `OIF_Structures_${projet}_${dateStr}.xlsx`;
  }
  return `OIF_Structures_${dateStr}.xlsx`;
}
