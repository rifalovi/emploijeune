import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  genererClasseurEnquetes,
  construireNomFichierExportEnquetes,
  COLONNES_REPONSES,
  COLONNES_SESSIONS,
  type ExportEnquetesContext,
  type ReponseEnqueteExportRow,
} from '@/lib/enquetes/export-helpers';

const baseContext: ExportEnquetesContext = {
  utilisateurNomComplet: 'Carlos HOUNSINOU',
  utilisateurEmail: 'carlos.hounsinou@francophonie.org',
  utilisateurRole: 'admin_scs',
  filtresAppliques: { questionnaire: 'A', projet_code: 'PROJ_A14' },
  nombreReponses: 0,
  nombreSessions: 0,
  dateExport: new Date('2026-04-26T10:00:00.000Z'),
  appVersion: '0.6.0',
};

const sessionA = '11111111-1111-4111-8111-111111111111';
const sessionB = '22222222-2222-4222-8222-222222222222';

const fixtureReponses: ReponseEnqueteExportRow[] = [
  // Session A questionnaire A : 6 indicateurs
  ...['A2', 'A3', 'A4', 'A5', 'F1', 'C5'].map((code, i) => ({
    session_id: sessionA,
    reponse_id: `aaaa${i}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
    indicateur_code: code,
    beneficiaire_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    structure_id: null,
    cible_libelle: 'Awa TRAORE',
    projet_code: 'PROJ_A14',
    vague_enquete: '12_mois',
    canal_collecte: 'formulaire_web',
    date_collecte: '2026-04-15',
    donnees: { foo: code },
    created_at: '2026-04-15T10:00:00.000Z',
    updated_at: '2026-04-15T10:00:00.000Z',
  })),
  // Session B questionnaire B : 4 indicateurs
  ...['B2', 'B3', 'B4', 'C5'].map((code, i) => ({
    session_id: sessionB,
    reponse_id: `bbbb${i}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
    indicateur_code: code,
    beneficiaire_id: null,
    structure_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    cible_libelle: 'COOP AGRI SAHEL',
    projet_code: 'PROJ_A16a',
    vague_enquete: 'ponctuelle',
    canal_collecte: 'entretien',
    date_collecte: '2026-04-20',
    donnees: { bar: code },
    created_at: '2026-04-20T11:00:00.000Z',
    updated_at: '2026-04-20T11:00:00.000Z',
  })),
];

describe('construireNomFichierExportEnquetes', () => {
  const date = new Date('2026-04-26T15:30:00.000Z');

  it('format par défaut (sans filtres)', () => {
    expect(construireNomFichierExportEnquetes({}, date)).toMatch(
      /^OIF_Enquetes_20260426_\d{4}\.xlsx$/,
    );
  });

  it('inclut le questionnaire si filtré', () => {
    expect(construireNomFichierExportEnquetes({ questionnaire: 'A' }, date)).toMatch(
      /^OIF_Enquetes_A_20260426_\d{4}\.xlsx$/,
    );
  });

  it('inclut le projet si filtré', () => {
    expect(construireNomFichierExportEnquetes({ projet_code: 'PROJ_A14' }, date)).toMatch(
      /^OIF_Enquetes_PROJ_A14_20260426_\d{4}\.xlsx$/,
    );
  });

  it('inclut questionnaire ET projet si les deux filtrés', () => {
    expect(
      construireNomFichierExportEnquetes({ questionnaire: 'A', projet_code: 'PROJ_A14' }, date),
    ).toMatch(/^OIF_Enquetes_A_PROJ_A14_20260426_\d{4}\.xlsx$/);
  });
});

describe('genererClasseurEnquetes — structure Excel', () => {
  it('produit un classeur avec 4 feuilles (Nomenclatures cachée + Réponses + Sessions + Metadata)', async () => {
    const buffer = await genererClasseurEnquetes(fixtureReponses, baseContext);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Nomenclatures Enquetes',
      'Réponses',
      'Sessions',
      'Metadata',
    ]);
    expect(wb.getWorksheet('Nomenclatures Enquetes')?.state).toBe('hidden');
  });

  it('feuille Réponses : 14 colonnes dans l’ordre attendu', async () => {
    const buffer = await genererClasseurEnquetes(fixtureReponses, baseContext);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Réponses');
    expect(ws).toBeDefined();
    const headers = (ws!.getRow(1).values as unknown[]).slice(1);
    expect(headers).toEqual(COLONNES_REPONSES.map((c) => c.header));
    expect(COLONNES_REPONSES.length).toBe(14);
  });

  it('feuille Réponses : 10 lignes (6 A + 4 B) avec libellés vague/canal traduits', async () => {
    const buffer = await genererClasseurEnquetes(fixtureReponses, baseContext);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Réponses')!;
    expect(ws.actualRowCount).toBe(11); // 1 en-tête + 10 réponses

    const row2 = ws.getRow(2);
    expect(row2.getCell('A').value).toBe(sessionA);
    expect(row2.getCell('C').value).toBe('A'); // questionnaire
    expect(row2.getCell('D').value).toBe('A2');
    expect(row2.getCell('E').value).toBe('Awa TRAORE');
    expect(row2.getCell('I').value).toBe('Suivi à 12 mois');
    expect(row2.getCell('J').value).toBe('Formulaire web (saisie en ligne)');
  });

  it('feuille Sessions : 1 ligne par session_enquete_id avec liste indicateurs agrégée', async () => {
    const buffer = await genererClasseurEnquetes(fixtureReponses, baseContext);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Sessions')!;
    expect(ws.actualRowCount).toBe(3); // 1 en-tête + 2 sessions
    expect(COLONNES_SESSIONS.length).toBe(10);

    // L'ordre est par session_id alphabétique → 11111... avant 22222...
    const row2 = ws.getRow(2);
    expect(row2.getCell('A').value).toBe(sessionA);
    expect(row2.getCell('B').value).toBe('A');
    expect(row2.getCell('H').value).toBe(6); // nb_indicateurs
    expect(row2.getCell('I').value).toBe('A2, A3, A4, A5, C5, F1');

    const row3 = ws.getRow(3);
    expect(row3.getCell('A').value).toBe(sessionB);
    expect(row3.getCell('B').value).toBe('B');
    expect(row3.getCell('H').value).toBe(4);
    expect(row3.getCell('I').value).toBe('B2, B3, B4, C5');
  });

  it('payload donnees est sérialisé en JSON dans la colonne L de la feuille Réponses', async () => {
    const buffer = await genererClasseurEnquetes(fixtureReponses, baseContext);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Réponses')!;
    const row2 = ws.getRow(2);
    expect(row2.getCell('L').value).toBe(JSON.stringify({ foo: 'A2' }));
  });

  it('feuille Metadata : contient les clés contexte + filtres + nombre sessions', async () => {
    const buffer = await genererClasseurEnquetes(fixtureReponses, baseContext);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const meta = wb.getWorksheet('Metadata')!;
    const lignes: string[] = [];
    meta.eachRow((r) => lignes.push(String(r.getCell(1).value ?? '')));
    expect(lignes).toContain('Export généré par');
    expect(lignes).toContain('Indicateurs');
    expect(lignes).toContain('Date d’export');
    expect(lignes).toContain('Nombre de réponses exportées');
    expect(lignes).toContain('Nombre de sessions exportées');
    expect(lignes).toContain('Filtres appliqués');
    expect(lignes.some((l) => l.includes('Questionnaire'))).toBe(true);
    expect(lignes.some((l) => l.includes('Projet'))).toBe(true);
  });

  it('gère un jeu de données vide (1 ligne d’en-tête sur Réponses et Sessions)', async () => {
    const buffer = await genererClasseurEnquetes([], { ...baseContext, nombreReponses: 0 });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.getWorksheet('Réponses')!.actualRowCount).toBe(1);
    expect(wb.getWorksheet('Sessions')!.actualRowCount).toBe(1);
  });

  it('feuille Nomenclatures Enquetes contient les listes de référence', async () => {
    const buffer = await genererClasseurEnquetes(fixtureReponses, baseContext);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Nomenclatures Enquetes')!;
    expect(ws.getCell('A1').value).toBe('A');
    expect(ws.getCell('A2').value).toBe('B');
    expect(ws.getCell('B1').value).toBe('6_mois');
    expect(ws.getCell('C1').value).toBe('formulaire_web');
  });

  it('propriétés du classeur : creator = nom complet utilisateur', async () => {
    const buffer = await genererClasseurEnquetes(fixtureReponses, baseContext);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.creator).toBe('Carlos HOUNSINOU');
    expect(wb.lastModifiedBy).toBe('Carlos HOUNSINOU');
  });
});
