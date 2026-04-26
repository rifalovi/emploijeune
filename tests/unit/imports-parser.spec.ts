import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseExcel } from '@/lib/imports/parser-excel';

/** Helper : construit un buffer Excel à la volée pour tester le parser. */
async function construireExcel(
  headers: string[],
  rows: Array<Array<string | number | null>>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Test');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

const HEADERS_SIMPLES = ['Code projet *', 'Prénom *', 'Nom *'] as const;
const OBLIGATOIRES = ['Code projet *', 'Prénom *'] as const;

describe('parseExcel', () => {
  it('lit un fichier valide avec en-têtes attendus', async () => {
    const buf = await construireExcel(
      [...HEADERS_SIMPLES],
      [
        ['PROJ_A14', 'Awa', 'TRAORE'],
        ['PROJ_A15', 'Koffi', 'YAO'],
      ],
    );
    const r = await parseExcel(buf, HEADERS_SIMPLES, OBLIGATOIRES);
    expect(r.erreursStructure).toHaveLength(0);
    expect(r.lignes).toHaveLength(2);
    expect(r.lignes[0]?.donnees['Code projet *']).toBe('PROJ_A14');
    expect(r.lignes[0]?.numLigne).toBe(2);
  });

  it('rejette si en-tête obligatoire manquant', async () => {
    const buf = await construireExcel(['Nom *'], [['TRAORE']]);
    const r = await parseExcel(buf, HEADERS_SIMPLES, OBLIGATOIRES);
    expect(r.lignes).toHaveLength(0);
    expect(r.erreursStructure.length).toBeGreaterThanOrEqual(2);
    expect(r.erreursStructure[0]?.colonne).toMatch(/Code projet|Prénom/);
  });

  it('ignore les lignes 100% vides', async () => {
    const buf = await construireExcel(
      [...HEADERS_SIMPLES],
      [
        ['PROJ_A14', 'Awa', 'TRAORE'],
        [null, null, null],
        ['PROJ_A15', 'Koffi', 'YAO'],
      ],
    );
    const r = await parseExcel(buf, HEADERS_SIMPLES, OBLIGATOIRES);
    expect(r.lignes).toHaveLength(2);
  });

  it('retourne erreur si fichier corrompu', async () => {
    const r = await parseExcel(Buffer.from('pas un xlsx'), HEADERS_SIMPLES, OBLIGATOIRES);
    expect(r.lignes).toHaveLength(0);
    expect(r.erreursStructure[0]?.message).toMatch(/illisible/i);
  });

  it('accepte un fichier vide (0 ligne de données)', async () => {
    const buf = await construireExcel([...HEADERS_SIMPLES], []);
    const r = await parseExcel(buf, HEADERS_SIMPLES, OBLIGATOIRES);
    expect(r.erreursStructure).toHaveLength(0);
    expect(r.lignes).toHaveLength(0);
  });

  it('numérote les lignes à partir de 2 (ligne 1 = en-têtes)', async () => {
    const buf = await construireExcel(
      [...HEADERS_SIMPLES],
      [
        ['PROJ_A14', 'Awa', 'TRAORE'],
        ['PROJ_A15', 'Koffi', 'YAO'],
        ['PROJ_A16a', 'Mariam', 'DIA'],
      ],
    );
    const r = await parseExcel(buf, HEADERS_SIMPLES, OBLIGATOIRES);
    expect(r.lignes.map((l) => l.numLigne)).toEqual([2, 3, 4]);
  });
});
