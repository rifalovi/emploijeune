import { describe, it, expect } from 'vitest';
import { parseCsv } from '@/lib/imports/parser-csv';

const HEADERS_TEST = [
  'Code projet *',
  'Code pays bénéficiaire *',
  'Prénom *',
  'Nom *',
  'Sexe *',
] as const;

function toBuffer(csv: string): Buffer {
  return Buffer.from(csv, 'utf-8');
}

describe('parseCsv', () => {
  it('parse un CSV simple avec virgule', async () => {
    const csv = `Projet,Pays,Prénom,Nom,Sexe
P14,CMR,Alice,Dupont,F
P16a,TGO,Bob,Martin,M`;
    const result = await parseCsv(toBuffer(csv), HEADERS_TEST);
    expect(result.erreursStructure).toHaveLength(0);
    expect(result.lignes).toHaveLength(2);
    expect(result.ligneEnTeteDetectee).toBe(1);
    // Les headers sont mappés via smart-mapper (Projet → Code projet *)
    expect(result.lignes[0]!.donnees['Code projet *']).toBe('P14');
    expect(result.lignes[1]!.donnees['Code projet *']).toBe('P16a');
  });

  it('parse un CSV avec point-virgule (format fr)', async () => {
    const csv = `Projet;Pays;Prénom;Nom;Sexe
P14;CMR;Alice;Dupont;F`;
    const result = await parseCsv(toBuffer(csv), HEADERS_TEST);
    expect(result.erreursStructure).toHaveLength(0);
    expect(result.lignes).toHaveLength(1);
    expect(result.lignes[0]!.donnees['Code projet *']).toBe('P14');
  });

  it('gère les guillemets et valeurs avec séparateur', async () => {
    const csv = `Projet;Pays;Prénom;Nom;Sexe
P14;CMR;"Alice, Marie";Dupont;F`;
    const result = await parseCsv(toBuffer(csv), HEADERS_TEST);
    expect(result.lignes).toHaveLength(1);
    expect(result.lignes[0]!.donneesBrutes['Prénom']).toBe('Alice, Marie');
  });

  it('ignore les lignes vides', async () => {
    const csv = `Projet,Pays,Prénom,Nom,Sexe
P14,CMR,Alice,Dupont,F

P16a,TGO,Bob,Martin,M
`;
    const result = await parseCsv(toBuffer(csv), HEADERS_TEST);
    expect(result.lignes).toHaveLength(2);
  });

  it('retourne une erreur sur fichier vide', async () => {
    const result = await parseCsv(toBuffer(''), HEADERS_TEST);
    expect(result.erreursStructure.length).toBeGreaterThan(0);
    expect(result.lignes).toHaveLength(0);
  });

  it('retourne une erreur si une seule ligne (header sans données)', async () => {
    const csv = `Projet,Pays,Prénom,Nom,Sexe`;
    const result = await parseCsv(toBuffer(csv), HEADERS_TEST);
    expect(result.erreursStructure.length).toBeGreaterThan(0);
  });

  it('gère le BOM UTF-8', async () => {
    const bom = '\uFEFF';
    const csv = `${bom}Projet,Pays,Prénom,Nom,Sexe
P14,CMR,Alice,Dupont,F`;
    const result = await parseCsv(toBuffer(csv), HEADERS_TEST);
    expect(result.erreursStructure).toHaveLength(0);
    expect(result.lignes).toHaveLength(1);
  });

  it('reporte les headers non reconnus', async () => {
    const csv = `Projet,Pays,Prénom,Nom,Sexe,ColonneInconnue
P14,CMR,Alice,Dupont,F,blabla`;
    const result = await parseCsv(toBuffer(csv), HEADERS_TEST);
    expect(result.headersNonReconnus).toContain('ColonneInconnue');
  });

  it('conserve donneesBrutes avec les headers originaux', async () => {
    const csv = `Projet,Pays,Prénom,Nom,Sexe
P14,CMR,Alice,Dupont,F`;
    const result = await parseCsv(toBuffer(csv), HEADERS_TEST);
    expect(result.lignes[0]!.donneesBrutes['Projet']).toBe('P14');
    expect(result.lignes[0]!.donneesBrutes['Prénom']).toBe('Alice');
  });
});
