'use client';

/**
 * Export du CMR corrigé en Excel (Livrable 2), AVEC formules de calcul
 * intégrées : les taux d'atteinte sont de vraies formules Excel
 * (`=Réalisé/Cible`), donc recalculés vivants dans le classeur. Un onglet par
 * projet (miroir de l'entrée) + un onglet de synthèse globale.
 *
 * exceljs est chargé dynamiquement (au clic) pour ne pas alourdir le bundle.
 * Posture « proposer puis valider » : les cibles NE sont PAS modifiées ; seuls
 * les taux sont recalculés par formule, et une colonne Statut/Commentaire trace
 * les corrections et les points à vérifier.
 */

/* exceljs n'expose pas de types précis pour Workbook/Worksheet : objets souples. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { CMRAnalyseResponse, IndicateurCMR, ProjetCMR } from './types';

const OIF = {
  bleu: 'FF0E4F88',
  cyan: 'FF0198E9',
  vert: 'FF7EB301',
  jaune: 'FFFDCD00',
  rouge: 'FFE40001',
  gris: 'FF2E292D',
  grisClair: 'FFDFDCD8',
  blanc: 'FFFFFFFF',
};

/** Lettre(s) de colonne Excel à partir d'un index 1-basé (1→A, 27→AA). */
export function colLetter(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/**
 * Formule de taux d'atteinte : vide si cible absente ou nulle, sinon
 * Réalisé / Cible (mise en forme « pourcentage » appliquée à la cellule).
 */
export function formuleTaux(adrCible: string, adrRealise: string): string {
  return `IF(OR(${adrCible}="",${adrCible}=0),"",${adrRealise}/${adrCible})`;
}

/** Commentaire de traçabilité synthétique pour un indicateur. */
export function commentaireIndicateur(ind: IndicateurCMR): string {
  const parts: string[] = [];
  const corrArith = ind.corrections.filter((c) => c.applique).length;
  if (corrArith > 0) parts.push(`${corrArith} taux recalculé(s)`);
  const messages = ind.anomalies.slice(0, 2).map((a) => a.message);
  parts.push(...messages);
  if (ind.anomalies.length > 2) parts.push(`… +${ind.anomalies.length - 2} autre(s)`);
  return parts.join(' · ');
}

function nomOngletSur(sheetNames: Set<string>, brut: string): string {
  // Excel : 31 caractères max, caractères * ? : \ / [ ] interdits, unicité.
  const base =
    brut
      .replace(/[*?:\\/[\]]/g, ' ')
      .trim()
      .slice(0, 31) || 'Projet';
  let nom = base;
  let k = 2;
  while (sheetNames.has(nom)) {
    const suffixe = `_${k}`;
    nom = base.slice(0, 31 - suffixe.length) + suffixe;
    k += 1;
  }
  sheetNames.add(nom);
  return nom;
}

function styleEntete(cell: any, couleur = OIF.bleu): void {
  cell.font = { bold: true, color: { argb: OIF.blanc } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: couleur } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}

const COULEUR_STATUT: Record<string, string> = {
  Conforme: OIF.vert,
  Corrigé: OIF.cyan,
  'À vérifier': OIF.jaune,
  Critique: OIF.rouge,
};

function ajouterFeuilleProjet(wb: any, projet: ProjetCMR, sheetNames: Set<string>): void {
  const ws = wb.addWorksheet(nomOngletSur(sheetNames, `${projet.code}_${projet.nom}`));
  const n = projet.n_annees;

  // En-têtes fixes de gauche.
  const gauche = ['Réf.', 'Résultat (Effet)', 'Produit', 'Indicateur', 'Unité', 'Référence'];
  // Colonnes des blocs annuels : Cible / Réalisé / Taux (formule).
  // Colonnes de droite.
  const droite = ['Cible Total', 'Total réalisé', "Taux d'atteinte", 'Statut', 'Commentaire'];

  const colCibleAnnee: number[] = [];
  const colRealiseAnnee: number[] = [];
  const colTauxAnnee: number[] = [];

  // Ligne 1 : groupes ; Ligne 2 : sous-en-têtes.
  let c = 1;
  for (const titre of gauche) {
    ws.getCell(1, c).value = titre;
    ws.mergeCells(1, c, 2, c);
    styleEntete(ws.getCell(1, c));
    c += 1;
  }
  for (let a = 0; a < n; a += 1) {
    ws.getCell(1, c).value = `Année ${a + 1}`;
    ws.mergeCells(1, c, 1, c + 2);
    styleEntete(ws.getCell(1, c), OIF.gris);
    ws.getCell(2, c).value = 'Cible';
    ws.getCell(2, c + 1).value = 'Réalisé';
    ws.getCell(2, c + 2).value = 'Taux';
    styleEntete(ws.getCell(2, c), OIF.gris);
    styleEntete(ws.getCell(2, c + 1), OIF.gris);
    styleEntete(ws.getCell(2, c + 2), OIF.gris);
    colCibleAnnee.push(c);
    colRealiseAnnee.push(c + 1);
    colTauxAnnee.push(c + 2);
    c += 3;
  }
  const colCibleTotal = c;
  const colTotalRealise = c + 1;
  const colTauxTotal = c + 2;
  const colStatut = c + 3;
  const colCommentaire = c + 4;
  droite.forEach((titre, i) => {
    ws.getCell(1, c + i).value = titre;
    ws.mergeCells(1, c + i, 2, c + i);
    styleEntete(ws.getCell(1, c + i));
  });

  // Lignes de données.
  let r = 3;
  for (const ind of projet.indicateurs) {
    ws.getCell(r, 1).value = ind.ref;
    ws.getCell(r, 2).value = ind.effet;
    ws.getCell(r, 3).value = ind.produit;
    ws.getCell(r, 4).value = ind.libelle;
    ws.getCell(r, 5).value = ind.unite;
    ws.getCell(r, 6).value = ind.reference ?? null;

    ind.annees.forEach((annee, a) => {
      // Blocs annuels contigus après les 6 colonnes de gauche (Cible/Réalisé/Taux).
      const cc = gauche.length + 1 + a * 3;
      const cr = cc + 1;
      const ct = cc + 2;
      ws.getCell(r, cc).value = annee.cible ?? null;
      ws.getCell(r, cr).value = annee.realise ?? null;
      const adrCible = `${colLetter(cc)}${r}`;
      const adrRealise = `${colLetter(cr)}${r}`;
      const tauxCell = ws.getCell(r, ct);
      tauxCell.value = {
        formula: formuleTaux(adrCible, adrRealise),
        result: annee.pct_calc !== null ? annee.pct_calc / 100 : undefined,
      };
      tauxCell.numFmt = '0.0%';
    });

    ws.getCell(r, colCibleTotal).value = ind.cible_total ?? null;
    ws.getCell(r, colTotalRealise).value = ind.total_realise ?? null;
    const adrCibleTot = `${colLetter(colCibleTotal)}${r}`;
    const adrRealiseTot = `${colLetter(colTotalRealise)}${r}`;
    const tauxTot = ws.getCell(r, colTauxTotal);
    tauxTot.value = {
      formula: formuleTaux(adrCibleTot, adrRealiseTot),
      result: ind.pct_total_calc !== null ? ind.pct_total_calc / 100 : undefined,
    };
    tauxTot.numFmt = '0.0%';

    const statutCell = ws.getCell(r, colStatut);
    statutCell.value = ind.statut;
    statutCell.font = { bold: true, color: { argb: OIF.blanc } };
    statutCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COULEUR_STATUT[ind.statut] ?? OIF.gris },
    };
    statutCell.alignment = { horizontal: 'center' };

    ws.getCell(r, colCommentaire).value = commentaireIndicateur(ind);
    r += 1;
  }

  // Largeurs de colonnes.
  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 40;
  ws.getColumn(5).width = 8;
  ws.getColumn(6).width = 10;
  for (let i = 0; i < n; i += 1) {
    ws.getColumn(colCibleAnnee[i]).width = 9;
    ws.getColumn(colRealiseAnnee[i]).width = 9;
    ws.getColumn(colTauxAnnee[i]).width = 9;
  }
  ws.getColumn(colCibleTotal).width = 11;
  ws.getColumn(colTotalRealise).width = 12;
  ws.getColumn(colTauxTotal).width = 11;
  ws.getColumn(colStatut).width = 12;
  ws.getColumn(colCommentaire).width = 50;
  ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 2 }];
}

function ajouterSyntheseGlobale(wb: any, res: CMRAnalyseResponse): void {
  const ws = wb.addWorksheet('Synthèse globale');
  const k = res.global.kpi;
  const kpis: [string, number | string][] = [
    ['Projets', k.n_projets],
    ['Indicateurs', k.n_indicateurs],
    ['Anomalies', k.n_anomalies],
    ['Taux atteinte médian (%)', k.taux_atteinte_global ?? '—'],
    ['Score fiabilité /100', k.score_fiabilite],
    ['Score cohérence /100', k.score_coherence],
    ['Qualité données /100', k.score_qualite],
  ];
  ws.getCell(1, 1).value = 'Tableau de bord global — CMR';
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: OIF.bleu } };
  let r = 3;
  for (const [label, val] of kpis) {
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r, 2).value = val;
    r += 1;
  }

  r += 1;
  const entetes = ['', 'Projet', 'Nom', 'Fiabilité', 'Taux médian (%)', 'Anomalies', 'Critiques'];
  entetes.forEach((t, i) => {
    ws.getCell(r, i + 1).value = t;
    styleEntete(ws.getCell(r, i + 1));
  });
  r += 1;
  for (const row of res.global.classement) {
    ws.getCell(r, 1).value = row.feu;
    ws.getCell(r, 2).value = row.code;
    ws.getCell(r, 3).value = row.nom;
    ws.getCell(r, 4).value = row.fiabilite;
    ws.getCell(r, 5).value = row.taux_atteinte_moyen ?? '—';
    ws.getCell(r, 6).value = row.n_anomalies;
    ws.getCell(r, 7).value = row.n_critiques;
    r += 1;
  }
  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 30;
  [4, 5, 6, 7].forEach((c) => (ws.getColumn(c).width = 15));
}

/** Génère et télécharge le classeur du CMR corrigé (formules intégrées). */
export async function exporterCmrExcel(
  res: CMRAnalyseResponse,
  nomFichier = 'cmr_corrige.xlsx',
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Analyseur de CMR — OIF Emploi Jeunes';
  wb.created = new Date();

  ajouterSyntheseGlobale(wb, res);
  const sheetNames = new Set<string>(['Synthèse globale']);
  for (const projet of res.projets) {
    ajouterFeuilleProjet(wb, projet, sheetNames);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
