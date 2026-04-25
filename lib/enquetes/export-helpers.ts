/**
 * Helpers de génération Excel pour l'export des enquêtes (Étape 6f).
 *
 * Modèle : 1 ligne par session × indicateur (= 1 ligne par ligne
 * `reponses_enquetes`). Donc une session questionnaire A produit 6 lignes
 * (A2/A3/A4/A5/F1/C5) et une session B produit 4 lignes (B2/B3/B4/C5).
 *
 * Décision : on N'exporte PAS un format pivot (1 ligne par session avec
 * toutes les colonnes étalées) en V1 — la diversité des champs JSONB par
 * indicateur ferait exploser le nombre de colonnes (40+) et serait peu
 * lisible. On reste sur 1 ligne par indicateur avec un payload JSONB
 * sérialisé en colonnes "donnees_*".
 *
 * 4 feuilles :
 *   - Nomenclatures B6 (cachée)
 *   - Réponses (1 ligne par indicateur collecté, ~14 colonnes)
 *   - Sessions (1 ligne par session_enquete_id, agrégat)
 *   - Metadata
 */

import ExcelJS from 'exceljs';
import {
  VAGUE_ENQUETE_LIBELLES,
  CANAL_COLLECTE_LIBELLES,
  VAGUES_ENQUETE_VALUES,
  CANAUX_COLLECTE_VALUES,
  type VagueEnquete,
  type CanalCollecte,
} from '@/lib/schemas/enquetes/nomenclatures';

// =============================================================================
// Constantes : en-têtes des 14 colonnes de la feuille « Réponses »
// =============================================================================

export const COLONNES_REPONSES = [
  { key: 'session_id', header: 'ID session', width: 38 },
  { key: 'reponse_id', header: 'ID réponse', width: 38 },
  { key: 'questionnaire', header: 'Questionnaire', width: 14 },
  { key: 'indicateur_code', header: 'Indicateur', width: 12 },
  { key: 'cible_libelle', header: 'Cible (nom)', width: 28 },
  { key: 'beneficiaire_id', header: 'ID bénéficiaire', width: 38 },
  { key: 'structure_id', header: 'ID structure', width: 38 },
  { key: 'projet_code', header: 'Code projet', width: 14 },
  { key: 'vague_enquete', header: 'Vague', width: 18 },
  { key: 'canal_collecte', header: 'Canal de collecte', width: 22 },
  { key: 'date_collecte', header: 'Date de collecte', width: 16 },
  { key: 'donnees_json', header: 'Réponses (JSON)', width: 60 },
  { key: 'created_at', header: 'Créé le', width: 18 },
  { key: 'updated_at', header: 'Modifié le', width: 18 },
] as const;

export const COLONNES_SESSIONS = [
  { key: 'session_id', header: 'ID session', width: 38 },
  { key: 'questionnaire', header: 'Questionnaire', width: 14 },
  { key: 'cible_libelle', header: 'Cible', width: 28 },
  { key: 'projet_code', header: 'Code projet', width: 14 },
  { key: 'vague_enquete', header: 'Vague', width: 18 },
  { key: 'canal_collecte', header: 'Canal', width: 22 },
  { key: 'date_collecte', header: 'Date collecte', width: 16 },
  { key: 'nb_indicateurs', header: 'Nb indicateurs', width: 12 },
  { key: 'indicateurs', header: 'Indicateurs collectés', width: 28 },
  { key: 'created_at', header: 'Créé le', width: 18 },
] as const;

// =============================================================================
// Types partagés
// =============================================================================

/**
 * Une ligne `reponses_enquetes` enrichie pour l'export (cible_libelle ajouté
 * par le JOIN, mais payload JSONB conservé brut).
 */
export type ReponseEnqueteExportRow = {
  session_id: string;
  reponse_id: string;
  indicateur_code: string;
  beneficiaire_id: string | null;
  structure_id: string | null;
  cible_libelle: string | null;
  projet_code: string | null;
  vague_enquete: string;
  canal_collecte: string;
  date_collecte: string;
  donnees: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ExportEnquetesFiltresAppliques = {
  q?: string;
  questionnaire?: string;
  projet_code?: string;
  vague_enquete?: string;
  canal_collecte?: string;
  cible_id?: string;
  date_debut?: Date;
  date_fin?: Date;
  mien?: boolean;
};

export type ExportEnquetesContext = {
  utilisateurNomComplet: string;
  utilisateurEmail: string;
  utilisateurRole: string;
  filtresAppliques: ExportEnquetesFiltresAppliques;
  nombreReponses: number;
  nombreSessions: number;
  dateExport: Date;
  appVersion: string;
};

// =============================================================================
// Génération du classeur
// =============================================================================

export async function genererClasseurEnquetes(
  reponses: ReponseEnqueteExportRow[],
  context: ExportEnquetesContext,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = context.utilisateurNomComplet;
  workbook.lastModifiedBy = context.utilisateurNomComplet;
  workbook.created = context.dateExport;
  workbook.modified = context.dateExport;
  Object.assign(workbook, {
    title: 'Export enquêtes OIF Emploi Jeunes',
    subject: 'Réponses aux enquêtes A2/A3/A4/A5/B2/B3/B4/F1/C5',
    company: 'Organisation Internationale de la Francophonie',
    keywords: 'OIF, enquêtes, emploi jeunes',
  });

  // Feuille 1 : Nomenclatures (cachée)
  const wsN = workbook.addWorksheet('Nomenclatures Enquetes', { state: 'hidden' });
  ajouterListeReference(wsN, 'A', ['A', 'B']);
  ajouterListeReference(wsN, 'B', [...VAGUES_ENQUETE_VALUES]);
  ajouterListeReference(wsN, 'C', [...CANAUX_COLLECTE_VALUES]);

  // Feuille 2 : Réponses (1 ligne par indicateur collecté)
  const wsR = workbook.addWorksheet('Réponses', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsR.columns = COLONNES_REPONSES.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHeader(wsR);
  for (const r of reponses) {
    wsR.addRow({
      session_id: r.session_id,
      reponse_id: r.reponse_id,
      questionnaire: deduireQuestionnaire(r),
      indicateur_code: r.indicateur_code,
      cible_libelle: r.cible_libelle,
      beneficiaire_id: r.beneficiaire_id,
      structure_id: r.structure_id,
      projet_code: r.projet_code,
      vague_enquete: VAGUE_ENQUETE_LIBELLES[r.vague_enquete as VagueEnquete] ?? r.vague_enquete,
      canal_collecte:
        CANAL_COLLECTE_LIBELLES[r.canal_collecte as CanalCollecte] ?? r.canal_collecte,
      date_collecte: r.date_collecte ? new Date(r.date_collecte) : null,
      donnees_json: JSON.stringify(r.donnees, null, 0),
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    });
  }
  if (reponses.length > 0) {
    wsR.getColumn('K').numFmt = 'dd/mm/yyyy';
    wsR.getColumn('M').numFmt = 'dd/mm/yyyy hh:mm';
    wsR.getColumn('N').numFmt = 'dd/mm/yyyy hh:mm';
  }

  // Feuille 3 : Sessions (agrégation par session_enquete_id)
  const wsS = workbook.addWorksheet('Sessions', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsS.columns = COLONNES_SESSIONS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHeader(wsS);
  const sessions = grouperParSession(reponses);
  for (const s of sessions) {
    wsS.addRow({
      session_id: s.session_id,
      questionnaire: s.questionnaire,
      cible_libelle: s.cible_libelle,
      projet_code: s.projet_code,
      vague_enquete: VAGUE_ENQUETE_LIBELLES[s.vague_enquete as VagueEnquete] ?? s.vague_enquete,
      canal_collecte:
        CANAL_COLLECTE_LIBELLES[s.canal_collecte as CanalCollecte] ?? s.canal_collecte,
      date_collecte: s.date_collecte ? new Date(s.date_collecte) : null,
      nb_indicateurs: s.indicateurs.length,
      indicateurs: s.indicateurs.join(', '),
      created_at: new Date(s.created_at),
    });
  }
  if (sessions.length > 0) {
    wsS.getColumn('G').numFmt = 'dd/mm/yyyy';
    wsS.getColumn('J').numFmt = 'dd/mm/yyyy hh:mm';
  }

  // Feuille 4 : Metadata
  const wsM = workbook.addWorksheet('Metadata');
  remplirMetadata(wsM, context, sessions.length);

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

// =============================================================================
// Helpers internes
// =============================================================================

function deduireQuestionnaire(r: ReponseEnqueteExportRow): string {
  if (r.beneficiaire_id) return 'A';
  if (r.structure_id) return 'B';
  return '—';
}

type SessionAgregee = {
  session_id: string;
  questionnaire: string;
  cible_libelle: string | null;
  projet_code: string | null;
  vague_enquete: string;
  canal_collecte: string;
  date_collecte: string;
  indicateurs: string[];
  created_at: string;
};

function grouperParSession(reponses: ReponseEnqueteExportRow[]): SessionAgregee[] {
  const map = new Map<string, SessionAgregee>();
  for (const r of reponses) {
    const existing = map.get(r.session_id);
    if (existing) {
      existing.indicateurs.push(r.indicateur_code);
    } else {
      map.set(r.session_id, {
        session_id: r.session_id,
        questionnaire: deduireQuestionnaire(r),
        cible_libelle: r.cible_libelle,
        projet_code: r.projet_code,
        vague_enquete: r.vague_enquete,
        canal_collecte: r.canal_collecte,
        date_collecte: r.date_collecte,
        indicateurs: [r.indicateur_code],
        created_at: r.created_at,
      });
    }
  }
  for (const s of map.values()) {
    s.indicateurs.sort();
  }
  return Array.from(map.values()).sort((a, b) => a.session_id.localeCompare(b.session_id));
}

function ajouterListeReference(ws: ExcelJS.Worksheet, col: string, values: string[]): void {
  values.forEach((v, i) => {
    ws.getCell(`${col}${i + 1}`).value = v;
  });
}

function styleHeader(ws: ExcelJS.Worksheet): void {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 35;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBDBDBD' } } };
  });
}

function remplirMetadata(
  ws: ExcelJS.Worksheet,
  ctx: ExportEnquetesContext,
  nbSessions: number,
): void {
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
    ['Indicateurs', 'Enquêtes A2/A3/A4/A5/B2/B3/B4/F1/C5'],
    ['Date d’export', dateLocale],
    [
      'Utilisateur',
      ctx.utilisateurEmail
        ? `${ctx.utilisateurNomComplet} (${ctx.utilisateurEmail})`
        : ctx.utilisateurNomComplet,
    ],
    ['Rôle', ctx.utilisateurRole],
    ['Nombre de réponses exportées', ctx.nombreReponses.toLocaleString('fr-FR')],
    ['Nombre de sessions exportées', nbSessions.toLocaleString('fr-FR')],
    ['Plateforme', `v${ctx.appVersion}`],
    ['', ''],
    ['Filtres appliqués', ''],
  ];
  for (const [k, v] of lignes) ws.addRow([k, v]);

  const f = ctx.filtresAppliques;
  const filtres: Array<[string, string]> = [];
  if (f.q) filtres.push(['  • Recherche', `"${f.q}"`]);
  if (f.questionnaire) filtres.push(['  • Questionnaire', f.questionnaire]);
  if (f.projet_code) filtres.push(['  • Projet', f.projet_code]);
  if (f.vague_enquete) filtres.push(['  • Vague', f.vague_enquete]);
  if (f.canal_collecte) filtres.push(['  • Canal', f.canal_collecte]);
  if (f.cible_id) filtres.push(['  • Cible spécifique', f.cible_id]);
  if (f.date_debut) filtres.push(['  • Date début', f.date_debut.toISOString().slice(0, 10)]);
  if (f.date_fin) filtres.push(['  • Date fin', f.date_fin.toISOString().slice(0, 10)]);
  if (f.mien) filtres.push(['  • Mode', 'Mes saisies uniquement']);
  if (filtres.length === 0) filtres.push(['  (aucun filtre)', '']);
  for (const [k, v] of filtres) ws.addRow([k, v]);

  ws.getColumn(1).font = { bold: true };
  ws.getRow(1).font = { bold: true, size: 14 };
}

// =============================================================================
// Nom de fichier
// =============================================================================

export function construireNomFichierExportEnquetes(
  filtres: ExportEnquetesFiltresAppliques,
  date: Date = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  const projet = filtres.projet_code;
  const q = filtres.questionnaire;
  if (q && projet) return `OIF_Enquetes_${q}_${projet}_${dateStr}.xlsx`;
  if (q) return `OIF_Enquetes_${q}_${dateStr}.xlsx`;
  if (projet) return `OIF_Enquetes_${projet}_${dateStr}.xlsx`;
  return `OIF_Enquetes_${dateStr}.xlsx`;
}
