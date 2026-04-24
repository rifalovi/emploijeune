/**
 * Helpers de génération Excel pour l'export bénéficiaires (indicateur A1).
 *
 * Règle Q5 Étape 4e : format strictement aligné sur
 * `docs/references/Template_OIF_Emploi_Jeunes_V1 (1).xlsx` — 22 colonnes,
 * même ordre, mêmes en-têtes exactes, listes déroulantes data validation.
 *
 * L'objectif est que le fichier exporté puisse être re-déposé dans l'outil
 * d'import Étape 7 sans modification. Test d'acceptance dans
 * tests/unit/export-beneficiaires.spec.ts.
 */

import ExcelJS from 'exceljs';
import type { BeneficiaireListItem } from './queries';
import type { Nomenclatures } from './nomenclatures-cache';
import {
  SEXE_LIBELLES,
  MODALITE_FORMATION_LIBELLES,
  STATUT_BENEFICIAIRE_LIBELLES,
  PROJETS_CODES,
  PAYS_CODES,
  SEXE_VALUES,
  DOMAINES_FORMATION_CODES,
  MODALITES_FORMATION_CODES,
  STATUTS_BENEFICIAIRE_CODES,
  type Sexe,
  type StatutBeneficiaireCode,
} from '@/lib/schemas/nomenclatures';

// =============================================================================
// Constantes : en-têtes et métadonnées alignées sur le Template V1
// =============================================================================

/**
 * Les 22 colonnes A1 dans l'ordre EXACT du Template V1. Ne pas modifier
 * sans validation du SCS (briser le cycle export-import).
 */
export const COLONNES_A1 = [
  { key: 'id', header: 'ID_unique', width: 38 },
  { key: 'projet_code', header: 'Code projet *', width: 14 },
  { key: 'pays_code', header: 'Code pays bénéficiaire *', width: 14 },
  { key: 'prenom', header: 'Prénom *', width: 18 },
  { key: 'nom', header: 'Nom *', width: 18 },
  { key: 'sexe', header: 'Sexe *', width: 8 },
  { key: 'date_naissance', header: 'Date de naissance (jj/mm/aaaa)', width: 18 },
  { key: 'tranche_age', header: "Tranche d'âge (auto)", width: 26 },
  { key: 'domaine_formation', header: 'Domaine de formation *', width: 28 },
  { key: 'intitule_formation', header: 'Intitulé précis formation', width: 32 },
  { key: 'modalite', header: 'Modalité *', width: 14 },
  { key: 'annee_formation', header: 'Année de la formation *', width: 12 },
  { key: 'date_debut_formation', header: 'Date début formation', width: 16 },
  { key: 'date_fin_formation', header: 'Date fin formation', width: 16 },
  { key: 'statut', header: 'Statut *', width: 18 },
  { key: 'partenaire', header: "Partenaire d'accompagnement", width: 28 },
  { key: 'fonction', header: 'Fonction / Statut actuel', width: 24 },
  { key: 'consentement', header: 'Consentement *', width: 26 },
  { key: 'telephone', header: 'Téléphone (avec indicatif)', width: 20 },
  { key: 'courriel', header: 'Courriel', width: 28 },
  { key: 'localite', header: 'Localité de résidence', width: 22 },
  { key: 'commentaire', header: 'Commentaire', width: 30 },
] as const;

/** Libellés des 3 valeurs de consentement dans le Template V1. */
export const CONSENTEMENT_LIBELLES: Record<'true' | 'false', string> = {
  true: 'Oui — consentement recueilli',
  false: 'Non — pas de consentement',
};

/** Libellés des tranches d'âge OIF (Questionnaire A Q105). */
import { calculerTrancheAge } from '@/components/beneficiaires/tranche-age';

// =============================================================================
// Types partagés
// =============================================================================

export type ExportFiltresAppliques = {
  q?: string;
  projet_code?: string;
  ps?: string;
  pays_code?: string;
  domaine_formation_code?: string;
  annee_formation?: number;
  statut_code?: string;
  sexe?: string;
  mien?: boolean;
};

export type ExportContext = {
  utilisateurNomComplet: string;
  utilisateurEmail: string;
  utilisateurRole: string;
  filtresAppliques: ExportFiltresAppliques;
  nombreLignes: number;
  dateExport: Date;
  appVersion: string;
};

// =============================================================================
// Fonction principale : génération du Buffer Excel
// =============================================================================

/**
 * Produit un classeur Excel avec 2 feuilles :
 *   1. « Bénéficiaires » — 22 colonnes conformes Template V1 + data validations
 *   2. « Metadata » — contexte de l'export (date, filtres, utilisateur, etc.)
 *
 * + une feuille cachée « Nomenclatures » qui stocke les listes de référence
 * pour les data validations des colonnes enum.
 */
export async function genererClasseurBeneficiaires(
  rows: BeneficiaireListItem[],
  nomenclatures: Nomenclatures,
  context: ExportContext,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();

  // Métadonnées du classeur (propriétés Excel standard)
  workbook.creator = context.utilisateurNomComplet;
  workbook.lastModifiedBy = context.utilisateurNomComplet;
  workbook.created = context.dateExport;
  workbook.modified = context.dateExport;
  workbook.properties = {
    ...workbook.properties,
    date1904: false,
  };
  // Propriétés étendues (Core Properties OOXML)
  Object.assign(workbook, {
    title: 'Export bénéficiaires OIF Emploi Jeunes',
    subject: 'Données bénéficiaires indicateur A1',
    company: 'Organisation Internationale de la Francophonie',
    keywords: 'OIF, bénéficiaires, emploi jeunes, indicateur A1',
    description: `Export généré le ${context.dateExport.toISOString()} par ${context.utilisateurNomComplet} (rôle ${context.utilisateurRole}).`,
  });

  // Feuille 1 : Nomenclatures (cachée, référentiel pour data validations)
  const wsNomenclatures = workbook.addWorksheet('Nomenclatures', {
    state: 'hidden',
  });
  ajouterListeReference(wsNomenclatures, 'A', [...PROJETS_CODES]);
  ajouterListeReference(wsNomenclatures, 'B', [...PAYS_CODES]);
  ajouterListeReference(wsNomenclatures, 'C', [...SEXE_VALUES]);
  ajouterListeReference(
    wsNomenclatures,
    'D',
    [...DOMAINES_FORMATION_CODES].map((code) => nomenclatures.domaines.get(code) ?? code),
  );
  ajouterListeReference(
    wsNomenclatures,
    'E',
    [...MODALITES_FORMATION_CODES].map((code) => MODALITE_FORMATION_LIBELLES[code]),
  );
  ajouterListeReference(
    wsNomenclatures,
    'F',
    [...STATUTS_BENEFICIAIRE_CODES].map((code) => STATUT_BENEFICIAIRE_LIBELLES[code]),
  );
  ajouterListeReference(wsNomenclatures, 'G', [
    CONSENTEMENT_LIBELLES.true,
    CONSENTEMENT_LIBELLES.false,
  ]);

  // Feuille 2 : Bénéficiaires
  const ws = workbook.addWorksheet('Bénéficiaires', {
    views: [{ state: 'frozen', ySplit: 1 }], // Fige la ligne d'en-tête
  });
  ws.columns = COLONNES_A1.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Style de la ligne d'en-tête
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

  // Lignes de données
  rows.forEach((row) => {
    ws.addRow(mapperLigneExport(row, nomenclatures));
  });

  // Formats de colonne (dates, entiers, téléphone en texte)
  formaterColonnes(ws, rows.length);

  // Data validations (listes déroulantes) — tirées de la feuille Nomenclatures
  if (rows.length > 0) appliquerDataValidations(ws, rows.length);

  // Feuille 3 : Metadata
  const wsMeta = workbook.addWorksheet('Metadata');
  remplirFeuilleMetadata(wsMeta, context);

  // ExcelJS renvoie un `Buffer` (typage interne) qui implémente ArrayBuffer
  // côté Node ; on retype volontairement pour rester portable côté client.
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

// =============================================================================
// Helpers internes
// =============================================================================

function ajouterListeReference(
  ws: ExcelJS.Worksheet,
  column: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
  values: string[],
): void {
  values.forEach((v, i) => {
    ws.getCell(`${column}${i + 1}`).value = v;
  });
}

function mapperLigneExport(
  r: BeneficiaireListItem,
  nomenclatures: Nomenclatures,
): Record<string, unknown> {
  const tranche = calculerTrancheAge(r.date_naissance);
  const domaineLibelle =
    nomenclatures.domaines.get(r.domaine_formation_code) ?? r.domaine_formation_code;
  const statutLibelle =
    STATUT_BENEFICIAIRE_LIBELLES[r.statut_code as StatutBeneficiaireCode] ?? r.statut_code;

  return {
    id: r.id,
    projet_code: r.projet_code,
    pays_code: r.pays_code,
    prenom: r.prenom,
    nom: r.nom,
    sexe: SEXE_LIBELLES[r.sexe as Sexe] ? r.sexe : r.sexe, // On garde le code F/M/Autre
    date_naissance: r.date_naissance ? new Date(r.date_naissance) : null,
    tranche_age: tranche,
    domaine_formation: domaineLibelle,
    intitule_formation: null, // Non chargé dans BeneficiaireListItem (serait dans detail)
    modalite: null, // Idem
    annee_formation: r.annee_formation,
    date_debut_formation: null,
    date_fin_formation: null,
    statut: statutLibelle,
    partenaire: null,
    fonction: null,
    consentement:
      r.consentement_recueilli === true ? CONSENTEMENT_LIBELLES.true : CONSENTEMENT_LIBELLES.false,
    telephone: null, // Volontairement non exporté depuis la liste (privacy — exigerait un fetch détail par ligne)
    courriel: null,
    localite: null,
    commentaire: null,
  };
}

function formaterColonnes(ws: ExcelJS.Worksheet, nbLignes: number): void {
  if (nbLignes === 0) return;
  const dernierRow = nbLignes + 1; // +1 pour la ligne d'en-tête

  // Dates : jj/mm/aaaa
  ws.getColumn('G').numFmt = 'dd/mm/yyyy';
  ws.getColumn('M').numFmt = 'dd/mm/yyyy';
  ws.getColumn('N').numFmt = 'dd/mm/yyyy';

  // Année : entier sans décimales ni espaces de milliers
  ws.getColumn('L').numFmt = '0';

  // Téléphone : texte pour préserver le +
  ws.getColumn('S').numFmt = '@';

  // Bordures légères sur toute la zone de données
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
  const dvByColumn: Array<{
    col: string;
    listeCol: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
    nbValeurs: number;
  }> = [
    { col: 'B', listeCol: 'A', nbValeurs: PROJETS_CODES.length },
    { col: 'C', listeCol: 'B', nbValeurs: PAYS_CODES.length },
    { col: 'F', listeCol: 'C', nbValeurs: SEXE_VALUES.length },
    { col: 'I', listeCol: 'D', nbValeurs: DOMAINES_FORMATION_CODES.length },
    { col: 'K', listeCol: 'E', nbValeurs: MODALITES_FORMATION_CODES.length },
    { col: 'O', listeCol: 'F', nbValeurs: STATUTS_BENEFICIAIRE_CODES.length },
    { col: 'R', listeCol: 'G', nbValeurs: 2 },
  ];

  for (const { col, listeCol, nbValeurs } of dvByColumn) {
    const formula = `=Nomenclatures!$${listeCol}$1:$${listeCol}$${nbValeurs}`;
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

function remplirFeuilleMetadata(ws: ExcelJS.Worksheet, ctx: ExportContext): void {
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
  if (f.domaine_formation_code) filtresLignes.push(['  • Domaine', f.domaine_formation_code]);
  if (f.annee_formation) filtresLignes.push(['  • Année', String(f.annee_formation)]);
  if (f.statut_code) filtresLignes.push(['  • Statut', f.statut_code]);
  if (f.sexe) filtresLignes.push(['  • Sexe', f.sexe]);
  if (f.mien) filtresLignes.push(['  • Mode', 'Mes saisies uniquement']);
  if (filtresLignes.length === 0) filtresLignes.push(['  (aucun filtre)', '']);
  for (const [k, v] of filtresLignes) ws.addRow([k, v]);

  // Style première colonne en gras
  ws.getColumn(1).font = { bold: true };
  ws.getRow(1).font = { bold: true, size: 14 };
}

// =============================================================================
// Nom de fichier (décision Q1 Étape 4e)
// =============================================================================

/**
 * Format :
 *   - OIF_Beneficiaires_AAAAMMJJ_HHmm.xlsx (cas général)
 *   - OIF_Beneficiaires_PROJ_A14_AAAAMMJJ_HHmm.xlsx (si un seul projet filtré)
 *
 * Timestamp en heure locale serveur (France en prod).
 */
export function construireNomFichierExport(
  filtres: ExportFiltresAppliques,
  date: Date = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;

  const projet = filtres.projet_code;
  if (projet) {
    return `OIF_Beneficiaires_${projet}_${dateStr}.xlsx`;
  }
  return `OIF_Beneficiaires_${dateStr}.xlsx`;
}
