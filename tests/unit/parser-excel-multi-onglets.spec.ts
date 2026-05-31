/**
 * Tests multi-onglets pour parseExcelFlexible + listerOngletsExcel.
 *
 * Construit des workbooks ExcelJS en mémoire avec plusieurs feuilles
 * pour valider l'auto-détection, le scoring et la sélection manuelle.
 */
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseExcelFlexible, listerOngletsExcel } from '@/lib/imports/parser-excel-flexible';

const HEADERS_A = [
  'Code projet *',
  'Code pays bénéficiaire *',
  'Prénom *',
  'Nom *',
  'Sexe *',
] as const;

/** Crée un buffer xlsx en mémoire à partir de feuilles définies. */
async function creerWorkbook(
  feuilles: Array<{
    nom: string;
    headers: string[];
    lignes: string[][];
  }>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const f of feuilles) {
    const ws = wb.addWorksheet(f.nom);
    ws.addRow(f.headers);
    for (const l of f.lignes) ws.addRow(l);
  }
  const arrayBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuf);
}

describe('parseExcelFlexible — multi-onglets', () => {
  it('utilise directement la seule feuille si workbook mono-onglet', async () => {
    const buf = await creerWorkbook([
      {
        nom: 'Données',
        headers: ['Projet', 'Pays', 'Prénom', 'Nom', 'Sexe'],
        lignes: Array.from({ length: 20 }, (_, i) => [`P${i}`, 'CMR', 'A', 'B', 'F']),
      },
    ]);
    const result = await parseExcelFlexible(buf, HEADERS_A);
    expect(result.erreursStructure).toHaveLength(0);
    expect(result.lignes).toHaveLength(20);
  });

  it('auto-détecte la feuille alignée parmi 3 onglets', async () => {
    const buf = await creerWorkbook([
      {
        nom: 'Feuil1',
        headers: ['Date', 'Montant', 'Devise'],
        lignes: [['2024-01-01', '1000', 'EUR']],
      },
      {
        nom: 'Base bénéficiaires Individuels',
        headers: ['Projet', 'Pays', 'Prénom', 'Nom', 'Sexe'],
        lignes: Array.from({ length: 50 }, (_, i) => [`P${i}`, 'CMR', 'Alice', 'Dupont', 'F']),
      },
      {
        nom: 'Paramètres',
        headers: ['Clé', 'Valeur'],
        lignes: [['version', '2.0']],
      },
    ]);
    const result = await parseExcelFlexible(buf, HEADERS_A);
    expect(result.erreursStructure).toHaveLength(0);
    expect(result.lignes).toHaveLength(50);
    // Vérifie qu'on a bien importé la bonne feuille
    expect(result.lignes[0]!.donnees['Prénom *']).toBe('Alice');
  });

  it('retourne erreur si aucune feuille ne matche >= 3 colonnes', async () => {
    const buf = await creerWorkbook([
      {
        nom: 'Subventions',
        headers: ['Date', 'Montant', 'Devise'],
        lignes: Array.from({ length: 20 }, () => ['2024-01-01', '500', 'EUR']),
      },
      {
        nom: 'Résumé',
        headers: ['Indicateur', 'Valeur'],
        lignes: Array.from({ length: 15 }, () => ['A1', '100']),
      },
    ]);
    const result = await parseExcelFlexible(buf, HEADERS_A);
    expect(result.erreursStructure.length).toBeGreaterThan(0);
    expect(result.erreursStructure[0]!.message).toContain('Aucune feuille reconnue');
    expect(result.erreursStructure[0]!.message).toContain('Subventions');
  });

  it('respecte le choix nomOnglet même si pas le meilleur score', async () => {
    const buf = await creerWorkbook([
      {
        nom: 'Brouillon',
        headers: ['Projet', 'Pays', 'Prénom', 'Nom', 'Sexe'],
        lignes: Array.from({ length: 15 }, () => ['P1', 'TGO', 'X', 'Y', 'M']),
      },
      {
        nom: 'Final',
        headers: ['Projet', 'Pays', 'Prénom', 'Nom', 'Sexe'],
        lignes: Array.from({ length: 100 }, () => ['P2', 'CMR', 'A', 'B', 'F']),
      },
    ]);
    // Forcer l'onglet "Brouillon" même si "Final" a plus de lignes
    const result = await parseExcelFlexible(buf, HEADERS_A, 'Brouillon');
    expect(result.lignes).toHaveLength(15);
    expect(result.lignes[0]!.donnees['Code projet *']).toBe('P1');
  });
});

describe('listerOngletsExcel', () => {
  it('retourne les scores de chaque onglet', async () => {
    const buf = await creerWorkbook([
      {
        nom: 'Feuil1',
        headers: ['Date', 'Montant'],
        lignes: [['2024', '100']],
      },
      {
        nom: 'Bénéficiaires',
        headers: ['Projet', 'Pays', 'Prénom', 'Nom', 'Sexe'],
        lignes: Array.from({ length: 30 }, () => ['P14', 'CMR', 'A', 'B', 'F']),
      },
    ]);
    const { onglets } = await listerOngletsExcel(buf, HEADERS_A);
    expect(onglets).toHaveLength(2);

    const feuil1 = onglets.find((o) => o.nom === 'Feuil1')!;
    const benef = onglets.find((o) => o.nom === 'Bénéficiaires')!;
    expect(benef.score).toBeGreaterThan(feuil1.score);
    expect(benef.nbHeadersReconnus).toBeGreaterThanOrEqual(4);
    // Bonus nom +5 pour "Bénéficiaires"
    expect(benef.score).toBeGreaterThanOrEqual(benef.nbHeadersReconnus > 0 ? 50 : 0);
  });

  it('exclut les feuilles avec < 10 lignes du score dans parseExcelFlexible', async () => {
    const buf = await creerWorkbook([
      {
        nom: 'Petite',
        headers: ['Projet', 'Pays', 'Prénom', 'Nom', 'Sexe'],
        lignes: [['P1', 'CMR', 'A', 'B', 'F']], // 1 seule ligne = exclue
      },
      {
        nom: 'Grande',
        headers: ['Date', 'Montant'],
        lignes: Array.from({ length: 20 }, () => ['2024', '100']),
      },
    ]);
    // "Petite" a le meilleur match headers mais < 10 lignes → exclue
    // "Grande" a 0 match → score < 3 → erreur
    const result = await parseExcelFlexible(buf, HEADERS_A);
    expect(result.erreursStructure.length).toBeGreaterThan(0);
    expect(result.erreursStructure[0]!.message).toContain('Aucune feuille reconnue');
  });
});
