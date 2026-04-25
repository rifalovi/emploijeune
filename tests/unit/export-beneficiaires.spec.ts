import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  genererClasseurBeneficiaires,
  construireNomFichierExport,
  COLONNES_A1,
  CONSENTEMENT_LIBELLES,
  type ExportContext,
} from '@/lib/beneficiaires/export-helpers';
import type { BeneficiaireListItem } from '@/lib/beneficiaires/queries';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';

/**
 * Test d'acceptance du cycle export → ré-import (décision Q5 Étape 4).
 *
 * On génère un Buffer Excel à partir d'un jeu de données synthétique,
 * puis on l'ouvre avec ExcelJS pour vérifier :
 *   - Présence des 22 colonnes dans le bon ordre avec les bons en-têtes
 *   - Feuille « Metadata » avec le contexte de l'export
 *   - Feuille « Nomenclatures » (cachée) avec les listes de référence
 *   - Data validations posées sur les colonnes enum
 *   - Formats de colonnes (dates, année, téléphone en texte)
 *   - Roundtrip : on retrouve les valeurs saisies dans les cellules attendues
 */

const nomenclaturesStub: Nomenclatures = {
  projets: new Map([
    ['PROJ_A16a', { libelle: 'D-CLIC : Formez-vous au numérique', programme_strategique: 'PS3' }],
  ]),
  pays: new Map([
    ['MLI', 'Mali'],
    ['BFA', 'Burkina Faso'],
  ]),
  domaines: new Map([
    ['NUM_INFO', 'Numérique et informatique'],
    ['ENTREPR_GEST', 'Entrepreneuriat et gestion'],
  ]),
  statuts: new Map([
    ['INSCRIT', 'Inscrit'],
    ['FORMATION_ACHEVEE', 'Formation achevée'],
  ]),
  modalites: new Map([['PRESENTIEL', 'Présentiel']]),
  // B1 (ajoutés en 5b — non utilisés ici mais requis par le type)
  typesStructure: new Map(),
  secteursActivite: new Map(),
  naturesAppui: new Map(),
  devises: new Map(),
};

const fixtureRows: BeneficiaireListItem[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    prenom: 'Awa',
    nom: 'TRAORE',
    sexe: 'F',
    date_naissance: '1998-03-15',
    projet_code: 'PROJ_A16a',
    pays_code: 'MLI',
    domaine_formation_code: 'NUM_INFO',
    annee_formation: 2024,
    statut_code: 'FORMATION_ACHEVEE',
    consentement_recueilli: true,
    created_by: null,
    organisation_id: null,
    updated_at: '2026-04-01T12:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    prenom: 'Koffi',
    nom: 'YAO',
    sexe: 'M',
    date_naissance: null,
    projet_code: 'PROJ_A16a',
    pays_code: 'BFA',
    domaine_formation_code: 'ENTREPR_GEST',
    annee_formation: 2025,
    statut_code: 'INSCRIT',
    consentement_recueilli: false,
    created_by: null,
    organisation_id: null,
    updated_at: '2026-04-01T12:00:00.000Z',
  },
];

const contextStub: ExportContext = {
  utilisateurNomComplet: 'Carlos HOUNSINOU',
  utilisateurEmail: 'carlos.hounsinou@francophonie.org',
  utilisateurRole: 'admin_scs',
  filtresAppliques: { projet_code: 'PROJ_A16a' },
  nombreLignes: 2,
  dateExport: new Date('2026-04-24T13:30:00.000Z'),
  appVersion: '0.4.0',
};

describe('construireNomFichierExport', () => {
  const date = new Date('2026-04-24T15:30:00.000Z');

  it('format par défaut (pas de projet filtré)', () => {
    const nom = construireNomFichierExport({}, date);
    expect(nom).toMatch(/^OIF_Beneficiaires_20260424_\d{4}\.xlsx$/);
  });

  it('inclut le code projet si un seul filtre projet', () => {
    const nom = construireNomFichierExport({ projet_code: 'PROJ_A14' }, date);
    expect(nom).toMatch(/^OIF_Beneficiaires_PROJ_A14_20260424_\d{4}\.xlsx$/);
  });
});

describe('genererClasseurBeneficiaires — structure Excel', () => {
  it('produit un classeur avec 3 feuilles (Bénéficiaires + Metadata + Nomenclatures cachée)', async () => {
    const buffer = await genererClasseurBeneficiaires(fixtureRows, nomenclaturesStub, contextStub);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Nomenclatures',
      'Bénéficiaires',
      'Metadata',
    ]);
    expect(wb.getWorksheet('Nomenclatures')?.state).toBe('hidden');
  });

  it('pose les 22 en-têtes dans le bon ordre', async () => {
    const buffer = await genererClasseurBeneficiaires(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Bénéficiaires');
    expect(ws).toBeDefined();

    const headers = (ws!.getRow(1).values as unknown[]).slice(1);
    const expectedHeaders = COLONNES_A1.map((c) => c.header);
    expect(headers).toEqual(expectedHeaders);
  });

  it('roundtrip : les valeurs saisies sont bien retrouvées dans les cellules attendues', async () => {
    const buffer = await genererClasseurBeneficiaires(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Bénéficiaires');
    expect(ws).toBeDefined();

    // Ligne 2 = premier bénéficiaire (après la ligne d'en-tête)
    const row2 = ws!.getRow(2);
    expect(row2.getCell('A').value).toBe(fixtureRows[0]!.id);
    expect(row2.getCell('B').value).toBe('PROJ_A16a');
    expect(row2.getCell('C').value).toBe('MLI');
    expect(row2.getCell('D').value).toBe('Awa');
    expect(row2.getCell('E').value).toBe('TRAORE');
    expect(row2.getCell('F').value).toBe('F');
    // Date parsée en objet Date
    expect(row2.getCell('G').value).toBeInstanceOf(Date);
    // Domaine → libellé
    expect(row2.getCell('I').value).toBe('Numérique et informatique');
    // Année en number
    expect(row2.getCell('L').value).toBe(2024);
    // Statut → libellé
    expect(row2.getCell('O').value).toBe('Formation achevée');
    // Consentement libellé
    expect(row2.getCell('R').value).toBe(CONSENTEMENT_LIBELLES.true);
  });

  it('second bénéficiaire (consentement=false) → libellé négatif', async () => {
    const buffer = await genererClasseurBeneficiaires(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const row3 = wb.getWorksheet('Bénéficiaires')!.getRow(3);
    expect(row3.getCell('R').value).toBe(CONSENTEMENT_LIBELLES.false);
    expect(row3.getCell('G').value).toBeNull();
  });

  it('data validations posées sur les colonnes enum (B, C, F, I, K, O, R)', async () => {
    const buffer = await genererClasseurBeneficiaires(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Bénéficiaires')!;

    const colonnesAvecValidation = ['B', 'C', 'F', 'I', 'K', 'O', 'R'];
    for (const col of colonnesAvecValidation) {
      const dv = ws.getCell(`${col}2`).dataValidation;
      expect(dv).toBeDefined();
      expect(dv?.type).toBe('list');
      expect(dv?.formulae?.[0]).toMatch(/Nomenclatures!/);
    }
  });

  it('formats de colonnes : dates en dd/mm/yyyy, téléphone en texte, année en entier', async () => {
    const buffer = await genererClasseurBeneficiaires(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Bénéficiaires')!;
    expect(ws.getColumn('G').numFmt).toBe('dd/mm/yyyy');
    expect(ws.getColumn('M').numFmt).toBe('dd/mm/yyyy');
    expect(ws.getColumn('N').numFmt).toBe('dd/mm/yyyy');
    expect(ws.getColumn('L').numFmt).toBe('0');
    expect(ws.getColumn('S').numFmt).toBe('@');
  });

  it('feuille Metadata : contient les 7 clés de contexte + filtres', async () => {
    const buffer = await genererClasseurBeneficiaires(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const meta = wb.getWorksheet('Metadata')!;

    const lignes: string[] = [];
    meta.eachRow((row) => {
      lignes.push(String(row.getCell(1).value ?? ''));
    });

    expect(lignes).toContain('Export généré par');
    expect(lignes).toContain('Date d’export');
    expect(lignes).toContain('Utilisateur');
    expect(lignes).toContain('Rôle');
    expect(lignes).toContain('Nombre de lignes exportées');
    expect(lignes).toContain('Plateforme');
    expect(lignes).toContain('Filtres appliqués');
    // Filtre projet présent dans la liste
    expect(lignes.some((l) => l.includes('Projet'))).toBe(true);
  });

  it('feuille Nomenclatures contient les listes de référence', async () => {
    const buffer = await genererClasseurBeneficiaires(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const nom = wb.getWorksheet('Nomenclatures')!;

    // Colonne A : projets (23 lignes)
    expect(nom.getCell('A1').value).toBe('PROJ_A01a');
    expect(nom.getCell('A23').value).toBe('PROJ_A20');
    // Colonne B : pays (61 lignes)
    expect(nom.getCell('B1').value).toBe('ALB');
    expect(nom.getCell('B61').value).toBe('USA');
    // Colonne C : sexe (3 valeurs)
    expect(nom.getCell('C1').value).toBe('F');
    expect(nom.getCell('C2').value).toBe('M');
    expect(nom.getCell('C3').value).toBe('Autre');
  });

  it('propriétés du classeur : creator = nom complet utilisateur', async () => {
    const buffer = await genererClasseurBeneficiaires(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.creator).toBe('Carlos HOUNSINOU');
    expect(wb.lastModifiedBy).toBe('Carlos HOUNSINOU');
  });

  it('gère un jeu de données vide (export sans lignes)', async () => {
    const buffer = await genererClasseurBeneficiaires([], nomenclaturesStub, {
      ...contextStub,
      nombreLignes: 0,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Bénéficiaires')!;
    expect(ws.actualRowCount).toBe(1); // seule la ligne d'en-tête
  });
});
