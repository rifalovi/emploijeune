import 'server-only';
import ExcelJS from 'exceljs';
import type { ErreurImport, RapportImport } from './types';

/**
 * Génère un classeur Excel récapitulant un rapport d'import (Étape 7).
 * Utilisé par la route `/api/imports/rapport-erreurs` pour permettre
 * à l'utilisateur de télécharger le détail des erreurs et corriger
 * son fichier source ligne par ligne.
 */
export async function genererRapportExcel(rapport: RapportImport): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Plateforme OIF Emploi Jeunes';
  workbook.created = new Date();

  // Feuille 1 : Récapitulatif
  const wsRecap = workbook.addWorksheet('Récapitulatif');
  wsRecap.columns = [
    { header: '', width: 30 },
    { header: '', width: 60 },
  ];
  wsRecap.addRows([
    ['Fichier importé', rapport.fichier_nom],
    ['Date d’exécution', new Date(rapport.execute_a).toLocaleString('fr-FR')],
    ['Lignes totales', rapport.nb_lignes_total],
    ['Lignes insérées avec succès', rapport.nb_lignes_inserees],
    ['Lignes ignorées (avec erreurs)', rapport.nb_lignes_ignorees],
    ['Nombre total d’erreurs', rapport.erreurs.length],
  ]);
  wsRecap.getColumn(1).font = { bold: true };

  // Feuille 2 : Erreurs détaillées
  const wsErr = workbook.addWorksheet('Erreurs');
  wsErr.columns = [
    { header: 'Ligne', key: 'ligne', width: 10 },
    { header: 'Colonne', key: 'colonne', width: 32 },
    { header: 'Valeur fautive', key: 'valeur', width: 28 },
    { header: 'Message d’erreur', key: 'message', width: 70 },
  ];
  wsErr.getRow(1).font = { bold: true };
  wsErr.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFEFEF' },
  };
  wsErr.views = [{ state: 'frozen', ySplit: 1 }];

  for (const e of rapport.erreurs as ErreurImport[]) {
    wsErr.addRow({
      ligne: e.ligne,
      colonne: e.colonne ?? '—',
      valeur: e.valeur ?? '—',
      message: e.message,
    });
  }

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

export function nomFichierRapport(fichierOriginal: string): string {
  const sansExt = fichierOriginal.replace(/\.xlsx$/i, '');
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `Rapport_${sansExt}_${ts}.xlsx`;
}
