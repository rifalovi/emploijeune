import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  genererClasseurStructures,
  construireNomFichierExportStructures,
  COLONNES_B1,
  CONSENTEMENT_LIBELLES,
  type ExportStructuresContext,
  type StructureExportRow,
} from '@/lib/structures/export-helpers';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';

/**
 * Test d'acceptance du cycle export Excel B1 (Étape 5e).
 *
 * Pattern miroir de `export-beneficiaires.spec.ts` (Étape 4e). On vérifie :
 *   - Présence des 37 colonnes dans le bon ordre avec les bons en-têtes
 *   - Feuille « Metadata » avec contexte d'export
 *   - Feuille « Nomenclatures B1 » (cachée) avec listes de référence
 *   - Data validations posées sur les 9 colonnes enum
 *   - Formats de colonnes (dates, nombres, téléphone en texte)
 *   - Roundtrip : valeurs saisies retrouvées dans les cellules attendues
 *   - Cas vide : 1 seule ligne d'en-tête
 */

const nomenclaturesStub: Nomenclatures = {
  // A1 (vides — non utilisés par l'export B1)
  projets: new Map([
    ['PROJ_A14', { libelle: 'PROFEFA', programme_strategique: 'PS3' }],
    ['PROJ_A16a', { libelle: 'D-CLIC', programme_strategique: 'PS3' }],
  ]),
  pays: new Map([
    ['MLI', 'Mali'],
    ['BFA', 'Burkina Faso'],
  ]),
  domaines: new Map(),
  statuts: new Map(),
  modalites: new Map(),
  // B1
  typesStructure: new Map([
    ['MICRO_ENTR', 'Micro-entreprise'],
    ['COOP', 'Coopérative'],
  ]),
  secteursActivite: new Map([
    ['AGR_SYL_PCH', 'Agriculture, sylviculture, pêche'],
    ['ARTISANAT', 'Artisanat'],
  ]),
  naturesAppui: new Map([
    ['SUBVENTION', 'Subvention'],
    ['MATERIEL', 'Appui matériel / équipement'],
  ]),
  devises: new Map([
    ['EUR', 'Euro (€)'],
    ['XOF', 'Franc CFA BCEAO (FCFA)'],
  ]),
};

const fixtureRows: StructureExportRow[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    nom_structure: 'COOP AGRI SAHEL',
    type_structure_code: 'COOP',
    secteur_activite_code: 'AGR_SYL_PCH',
    secteur_precis: 'Maraîchage',
    intitule_initiative: 'Renforcement filière maraîchère',
    date_creation: '2018-06-15',
    statut_creation: 'renforcement',
    projet_code: 'PROJ_A14',
    pays_code: 'MLI',
    organisation_id: null,
    organisation_nom: 'ONG SahelDev',
    porteur_prenom: 'Awa',
    porteur_nom: 'TRAORE',
    porteur_sexe: 'F',
    porteur_date_naissance: '1990-03-15',
    fonction_porteur: 'Présidente',
    annee_appui: 2024,
    nature_appui_code: 'SUBVENTION',
    montant_appui: 1500,
    devise_code: 'EUR',
    consentement_recueilli: true,
    consentement_date: '2024-02-01',
    telephone_porteur: '+22376123456',
    courriel_porteur: 'awa.traore@example.org',
    adresse: 'Quartier Lafiabougou',
    ville: 'Bamako',
    localite: 'Bamako Coura',
    latitude: 12.6392,
    longitude: -8.0029,
    chiffre_affaires: 25000,
    employes_permanents: 4,
    employes_temporaires: 8,
    emplois_crees: 6,
    commentaire: 'Cohorte 2024 — projet pilote',
    source_import: 'manual',
    created_at: '2026-04-01T10:00:00.000Z',
    updated_at: '2026-04-15T14:30:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    nom_structure: 'ATELIER YAO',
    type_structure_code: 'MICRO_ENTR',
    secteur_activite_code: 'ARTISANAT',
    secteur_precis: null,
    intitule_initiative: null,
    date_creation: null,
    statut_creation: 'creation',
    projet_code: 'PROJ_A16a',
    pays_code: 'BFA',
    organisation_id: null,
    organisation_nom: null,
    porteur_prenom: null,
    porteur_nom: 'YAO',
    porteur_sexe: 'M',
    porteur_date_naissance: null,
    fonction_porteur: null,
    annee_appui: 2025,
    nature_appui_code: 'MATERIEL',
    montant_appui: null,
    devise_code: null,
    consentement_recueilli: false,
    consentement_date: null,
    telephone_porteur: null,
    courriel_porteur: null,
    adresse: null,
    ville: null,
    localite: null,
    latitude: null,
    longitude: null,
    chiffre_affaires: null,
    employes_permanents: null,
    employes_temporaires: null,
    emplois_crees: null,
    commentaire: null,
    source_import: 'manual',
    created_at: '2026-04-10T09:00:00.000Z',
    updated_at: '2026-04-10T09:00:00.000Z',
  },
];

const contextStub: ExportStructuresContext = {
  utilisateurNomComplet: 'Carlos HOUNSINOU',
  utilisateurEmail: 'carlos.hounsinou@francophonie.org',
  utilisateurRole: 'admin_scs',
  filtresAppliques: { projet_code: 'PROJ_A14' },
  nombreLignes: 2,
  dateExport: new Date('2026-04-25T13:30:00.000Z'),
  appVersion: '0.5.0',
};

describe('construireNomFichierExportStructures', () => {
  const date = new Date('2026-04-25T15:30:00.000Z');

  it('format par défaut (pas de projet filtré)', () => {
    const nom = construireNomFichierExportStructures({}, date);
    expect(nom).toMatch(/^OIF_Structures_20260425_\d{4}\.xlsx$/);
  });

  it('inclut le code projet si un seul filtre projet', () => {
    const nom = construireNomFichierExportStructures({ projet_code: 'PROJ_A14' }, date);
    expect(nom).toMatch(/^OIF_Structures_PROJ_A14_20260425_\d{4}\.xlsx$/);
  });
});

describe('genererClasseurStructures — structure Excel B1', () => {
  it('produit un classeur avec 3 feuilles (Nomenclatures cachée + Structures B1 + Metadata)', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, contextStub);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Nomenclatures B1',
      'Structures B1',
      'Metadata',
    ]);
    expect(wb.getWorksheet('Nomenclatures B1')?.state).toBe('hidden');
  });

  it('pose les 37 en-têtes dans le bon ordre', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Structures B1');
    expect(ws).toBeDefined();

    const headers = (ws!.getRow(1).values as unknown[]).slice(1);
    const expectedHeaders = COLONNES_B1.map((c) => c.header);
    expect(headers).toEqual(expectedHeaders);
    expect(COLONNES_B1.length).toBe(37);
  });

  it('roundtrip : la première ligne (essentielles + détails) est correctement sérialisée', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Structures B1')!;
    const row2 = ws.getRow(2);

    // Section essentielle (cols A-M)
    expect(row2.getCell('A').value).toBe(fixtureRows[0]!.id);
    expect(row2.getCell('B').value).toBe('PROJ_A14');
    expect(row2.getCell('C').value).toBe('MLI');
    expect(row2.getCell('D').value).toBe('COOP AGRI SAHEL');
    expect(row2.getCell('E').value).toBe('Coopérative');
    expect(row2.getCell('F').value).toBe('Agriculture, sylviculture, pêche');
    expect(row2.getCell('G').value).toBe('Renforcement');
    expect(row2.getCell('H').value).toBe('Renforcement filière maraîchère');
    expect(row2.getCell('I').value).toBe(2024);
    expect(row2.getCell('J').value).toBe('Subvention');
    expect(row2.getCell('K').value).toBe(1500);
    expect(row2.getCell('L').value).toBe('Euro (€)');
    expect(row2.getCell('M').value).toBe(CONSENTEMENT_LIBELLES.true);

    // Détails optionnels (porteur + géoloc + indicateurs B)
    expect(row2.getCell('N').value).toBe('Awa');
    expect(row2.getCell('O').value).toBe('TRAORE');
    expect(row2.getCell('P').value).toBe('F');
    expect(row2.getCell('Q').value).toBeInstanceOf(Date);
    expect(row2.getCell('R').value).toBe('Présidente');
    expect(row2.getCell('S').value).toBe('+22376123456');
    expect(row2.getCell('T').value).toBe('awa.traore@example.org');
    expect(row2.getCell('U').value).toBeInstanceOf(Date);
    expect(row2.getCell('Y').value).toBeCloseTo(12.6392, 4); // latitude
    expect(row2.getCell('Z').value).toBeCloseTo(-8.0029, 4); // longitude
    expect(row2.getCell('AC').value).toBe(25000); // chiffre_affaires
    expect(row2.getCell('AD').value).toBe(4); // employes_permanents
    expect(row2.getCell('AF').value).toBe(6); // emplois_crees

    // Métadonnées (organisation, source, dates techniques)
    expect(row2.getCell('AH').value).toBe('ONG SahelDev'); // organisation (34)
    expect(row2.getCell('AI').value).toBe('manual'); // source_import (35)
    expect(row2.getCell('AJ').value).toBeInstanceOf(Date); // created_at (36)
  });

  it('seconde ligne (consentement=false, optionnels nuls) → libellé négatif et cellules vides', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const row3 = wb.getWorksheet('Structures B1')!.getRow(3);
    expect(row3.getCell('M').value).toBe(CONSENTEMENT_LIBELLES.false);
    expect(row3.getCell('K').value).toBeNull(); // montant vide
    expect(row3.getCell('L').value).toBeNull(); // devise vide
    expect(row3.getCell('Q').value).toBeNull(); // date naissance vide
    expect(row3.getCell('U').value).toBeNull(); // date consentement vide
    expect(row3.getCell('AH').value).toBeNull(); // organisation vide
  });

  it('data validations posées sur les 9 colonnes enum (B, C, E, F, G, J, L, M, P)', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Structures B1')!;

    const colonnesAvecValidation = ['B', 'C', 'E', 'F', 'G', 'J', 'L', 'M', 'P'];
    for (const col of colonnesAvecValidation) {
      const dv = ws.getCell(`${col}2`).dataValidation;
      expect(dv, `Validation manquante sur colonne ${col}`).toBeDefined();
      expect(dv?.type).toBe('list');
      expect(dv?.formulae?.[0]).toMatch(/Nomenclatures B1/);
    }
  });

  it('formats : année entier, dates dd/mm/yyyy, téléphone texte, GPS 6 décimales', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Structures B1')!;

    expect(ws.getColumn('I').numFmt).toBe('0'); // annee_appui
    expect(ws.getColumn('K').numFmt).toBe('#,##0.00'); // montant_appui
    expect(ws.getColumn('Q').numFmt).toBe('dd/mm/yyyy'); // porteur_date_naissance
    expect(ws.getColumn('U').numFmt).toBe('dd/mm/yyyy'); // consentement_date
    expect(ws.getColumn('AA').numFmt).toBe('dd/mm/yyyy'); // date_creation structure
    expect(ws.getColumn('S').numFmt).toBe('@'); // téléphone
    expect(ws.getColumn('Y').numFmt).toBe('0.000000'); // latitude
    expect(ws.getColumn('Z').numFmt).toBe('0.000000'); // longitude
    expect(ws.getColumn('AJ').numFmt).toBe('dd/mm/yyyy hh:mm'); // created_at
  });

  it('feuille Metadata : contient les 8 clés de contexte + filtres appliqués', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const meta = wb.getWorksheet('Metadata')!;

    const lignes: string[] = [];
    meta.eachRow((row) => {
      lignes.push(String(row.getCell(1).value ?? ''));
    });

    expect(lignes).toContain('Export généré par');
    expect(lignes).toContain('Indicateur');
    expect(lignes).toContain('Date d’export');
    expect(lignes).toContain('Utilisateur');
    expect(lignes).toContain('Rôle');
    expect(lignes).toContain('Nombre de lignes exportées');
    expect(lignes).toContain('Plateforme');
    expect(lignes).toContain('Filtres appliqués');
    expect(lignes.some((l) => l.includes('Projet'))).toBe(true);
  });

  it('feuille Nomenclatures B1 contient les 9 listes de référence', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const nom = wb.getWorksheet('Nomenclatures B1')!;

    // A : projets
    expect(nom.getCell('A1').value).toBe('PROJ_A01a');
    expect(nom.getCell('A23').value).toBe('PROJ_A20');
    // B : pays
    expect(nom.getCell('B1').value).toBe('ALB');
    // C : types structure (libellés)
    expect(nom.getCell('C1').value).toBe('Agriculture / Élevage / Pêche');
    // D : secteurs activité (libellés)
    expect(nom.getCell('D1').value).toBe('Agriculture, sylviculture, pêche');
    // E : statuts création (libellés)
    expect(nom.getCell('E1').value).toBe('Création');
    expect(nom.getCell('E2').value).toBe('Renforcement');
    expect(nom.getCell('E3').value).toBe('Relance');
    // F : natures appui (libellés)
    expect(nom.getCell('F1').value).toBe('Subvention');
    // G : devises (libellés)
    expect(nom.getCell('G1').value).toBe('Euro (€)');
    // H : consentement (2 valeurs)
    expect(nom.getCell('H1').value).toBe(CONSENTEMENT_LIBELLES.true);
    expect(nom.getCell('H2').value).toBe(CONSENTEMENT_LIBELLES.false);
    // I : sexe (3 valeurs)
    expect(nom.getCell('I1').value).toBe('F');
    expect(nom.getCell('I2').value).toBe('M');
    expect(nom.getCell('I3').value).toBe('Autre');
  });

  it('propriétés du classeur : creator = nom complet utilisateur', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, contextStub);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.creator).toBe('Carlos HOUNSINOU');
    expect(wb.lastModifiedBy).toBe('Carlos HOUNSINOU');
  });

  it('gère un jeu de données vide (export sans lignes)', async () => {
    const buffer = await genererClasseurStructures([], nomenclaturesStub, {
      ...contextStub,
      nombreLignes: 0,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet('Structures B1')!;
    expect(ws.actualRowCount).toBe(1); // seule la ligne d'en-tête
  });

  it('feuille Metadata : libellé « (aucun filtre) » si aucun filtre appliqué', async () => {
    const buffer = await genererClasseurStructures(fixtureRows, nomenclaturesStub, {
      ...contextStub,
      filtresAppliques: {},
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const meta = wb.getWorksheet('Metadata')!;

    const lignes: string[] = [];
    meta.eachRow((row) => {
      lignes.push(String(row.getCell(1).value ?? ''));
    });
    expect(lignes.some((l) => l.includes('aucun filtre'))).toBe(true);
  });
});
