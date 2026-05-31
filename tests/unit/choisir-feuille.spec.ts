import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { detecterFeuilles, choisirMeilleureFeuille } from '@/lib/imports/choisir-feuille';

/** Crée un workbook ExcelJS en mémoire avec les feuilles définies. */
function creerWorkbook(
  feuilles: Array<{ nom: string; headers: string[]; nbLignes: number }>,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  for (const f of feuilles) {
    const ws = wb.addWorksheet(f.nom);
    ws.addRow(f.headers);
    for (let i = 0; i < f.nbLignes; i++) {
      ws.addRow(f.headers.map((_, j) => `val_${i}_${j}`));
    }
  }
  return wb;
}

describe('detecterFeuilles', () => {
  it('retourne les scores tries du meilleur au pire', () => {
    const wb = creerWorkbook([
      { nom: 'Feuil1', headers: ['Date', 'Montant'], nbLignes: 5 },
      { nom: 'Beneficiaires', headers: ['Prenom', 'Nom', 'Sexe', 'Projet'], nbLignes: 100 },
      { nom: 'Params', headers: ['Cle', 'Valeur'], nbLignes: 3 },
    ]);
    const detections = detecterFeuilles(wb, 'beneficiaires');
    expect(detections[0]!.nom).toBe('Beneficiaires');
    expect(detections[0]!.score).toBeGreaterThan(detections[1]!.score);
    expect(detections[0]!.colonnesReconnues.length).toBeGreaterThanOrEqual(3);
  });

  it('donne un bonus nom pour les feuilles contenant un mot-cle', () => {
    const wb = creerWorkbook([
      { nom: 'Donnees', headers: ['Prenom', 'Nom', 'Sexe', 'Projet'], nbLignes: 50 },
      { nom: 'Base beneficiaires Individuels', headers: ['Prenom', 'Nom', 'Sexe', 'Projet'], nbLignes: 50 },
    ]);
    const detections = detecterFeuilles(wb, 'beneficiaires');
    const avecBonus = detections.find((d) => d.nom.includes('beneficiaires'))!;
    const sansBonus = detections.find((d) => d.nom === 'Donnees')!;
    expect(avecBonus.score).toBeGreaterThan(sansBonus.score);
  });

  it('penalise les feuilles avec < 10 lignes', () => {
    const wb = creerWorkbook([
      { nom: 'Petite', headers: ['Prenom', 'Nom', 'Sexe', 'Projet'], nbLignes: 3 },
      { nom: 'Grande', headers: ['Prenom', 'Nom', 'Sexe', 'Projet'], nbLignes: 100 },
    ]);
    const detections = detecterFeuilles(wb, 'beneficiaires');
    const petite = detections.find((d) => d.nom === 'Petite')!;
    const grande = detections.find((d) => d.nom === 'Grande')!;
    expect(grande.score).toBeGreaterThan(petite.score);
  });

  it('distingue le scoring beneficiaires vs structures', () => {
    const wb = creerWorkbook([
      { nom: 'Individus', headers: ['Prenom', 'Nom', 'Sexe', 'Projet', 'Formation'], nbLignes: 50 },
      { nom: 'Micro entreprises', headers: ['Nom structure', 'Type', 'Secteur', 'Projet', 'Montant'], nbLignes: 50 },
    ]);

    const detectBenef = detecterFeuilles(wb, 'beneficiaires');
    expect(detectBenef[0]!.nom).toBe('Individus');

    const detectStruct = detecterFeuilles(wb, 'structures');
    expect(detectStruct[0]!.nom).toBe('Micro entreprises');
  });
});

describe('choisirMeilleureFeuille', () => {
  it('retourne la seule feuille si workbook mono-onglet', () => {
    const wb = creerWorkbook([
      { nom: 'Donnees', headers: ['Prenom', 'Nom', 'Sexe', 'Projet'], nbLignes: 50 },
    ]);
    const { ws, detections } = choisirMeilleureFeuille(wb, 'beneficiaires');
    expect(ws).not.toBeNull();
    expect(ws!.name).toBe('Donnees');
    expect(detections).toHaveLength(1);
  });

  it('detecte la bonne feuille parmi 8 onglets (cas P16a)', () => {
    const wb = creerWorkbook([
      { nom: 'Feuil1', headers: ['Date', 'Montant', 'Devise'], nbLignes: 5 },
      { nom: 'Feuil2', headers: ['Ref', 'Description'], nbLignes: 200 },
      { nom: 'Feuil3', headers: ['Code', 'Libelle'], nbLignes: 10 },
      { nom: 'Base beneficiaires Individuels', headers: ['Prenom', 'Nom', 'Sexe', 'Projet', 'Pays', 'Formation', 'Domaine'], nbLignes: 3892 },
      { nom: 'Base des micro entreprises_P16a', headers: ['Nom structure', 'Type', 'Secteur', 'Projet', 'Montant'], nbLignes: 78 },
      { nom: 'Resultats', headers: ['Indicateur', 'Valeur'], nbLignes: 15 },
      { nom: 'Subventions', headers: ['Date', 'Montant', 'Beneficiaire'], nbLignes: 44 },
      { nom: 'Parametres', headers: ['Cle', 'Valeur'], nbLignes: 2 },
    ]);

    const { ws: wsBenef } = choisirMeilleureFeuille(wb, 'beneficiaires');
    expect(wsBenef).not.toBeNull();
    expect(wsBenef!.name).toBe('Base beneficiaires Individuels');

    const { ws: wsStruct } = choisirMeilleureFeuille(wb, 'structures');
    expect(wsStruct).not.toBeNull();
    expect(wsStruct!.name).toBe('Base des micro entreprises_P16a');
  });

  it('retourne null si aucune feuille ne matche (score < 30)', () => {
    const wb = creerWorkbook([
      { nom: 'Subventions', headers: ['Date', 'Montant', 'Devise'], nbLignes: 100 },
      { nom: 'Resultats', headers: ['Indicateur', 'Valeur'], nbLignes: 50 },
    ]);
    const { ws, detections } = choisirMeilleureFeuille(wb, 'beneficiaires');
    expect(ws).toBeNull();
    expect(detections.length).toBeGreaterThan(0);
  });
});
