import { describe, it, expect } from 'vitest';
import { mapLigneVersBeneficiaire } from '@/lib/imports/mapping-beneficiaires';
import { mapLigneVersStructure } from '@/lib/imports/mapping-structures';

describe('mapLigneVersBeneficiaire', () => {
  const ligneValide = {
    'Code projet *': 'PROJ_A14',
    'Code pays bénéficiaire *': 'MLI',
    'Prénom *': 'Awa',
    'Nom *': 'TRAORE',
    'Sexe *': 'F',
    'Date de naissance (jj/mm/aaaa)': '1998-03-15',
    'Domaine de formation *': 'NUM_INFO',
    'Modalité *': 'PRESENTIEL',
    'Année de la formation *': 2024,
    'Statut *': 'FORMATION_ACHEVEE',
    'Consentement *': 'Oui',
  };

  it('parse une ligne 100% valide', () => {
    const r = mapLigneVersBeneficiaire(ligneValide);
    expect(r.erreursMapping).toHaveLength(0);
    expect(r.donneesParsees?.projet_code).toBe('PROJ_A14');
    expect(r.donneesParsees?.consentement_recueilli).toBe(true);
    expect(r.donneesParsees?.annee_formation).toBe(2024);
  });

  it('accepte les libellés humains pour Sexe (Femme/Homme)', () => {
    const r = mapLigneVersBeneficiaire({ ...ligneValide, 'Sexe *': 'Femme' });
    expect(r.donneesParsees?.sexe).toBe('F');
  });

  it('accepte le libellé du consentement (long format export)', () => {
    const r = mapLigneVersBeneficiaire({
      ...ligneValide,
      'Consentement *': 'Oui — consentement recueilli',
    });
    expect(r.donneesParsees?.consentement_recueilli).toBe(true);
  });

  it('rejette code projet inconnu', () => {
    const r = mapLigneVersBeneficiaire({ ...ligneValide, 'Code projet *': 'PROJ_INEXISTANT' });
    expect(r.donneesParsees).toBeNull();
    expect(r.erreursMapping[0]?.colonne).toBe('Code projet *');
  });

  it('rejette année invalide (texte)', () => {
    const r = mapLigneVersBeneficiaire({ ...ligneValide, 'Année de la formation *': 'abcd' });
    expect(r.donneesParsees).toBeNull();
    expect(r.erreursMapping.some((e) => e.colonne === 'Année de la formation *')).toBe(true);
  });

  it('parse date FR (jj/mm/aaaa) en ISO', () => {
    const r = mapLigneVersBeneficiaire({
      ...ligneValide,
      'Date de naissance (jj/mm/aaaa)': '15/03/1998',
    });
    expect(r.donneesParsees?.date_naissance).toBe('1998-03-15');
  });

  it('cumule plusieurs erreurs sur la même ligne', () => {
    const r = mapLigneVersBeneficiaire({
      ...ligneValide,
      'Sexe *': 'X',
      'Consentement *': 'PEUT-ÊTRE',
    });
    expect(r.donneesParsees).toBeNull();
    expect(r.erreursMapping.length).toBeGreaterThanOrEqual(2);
  });
});

describe('mapLigneVersStructure', () => {
  const ligneValide = {
    'Code projet *': 'PROJ_A14',
    'Code pays *': 'MLI',
    'Nom structure *': 'COOP AGRI SAHEL',
    'Type structure *': 'COOP',
    'Secteur activité *': 'AGR_SYL_PCH',
    'Statut création *': 'creation',
    'Année appui *': 2024,
    'Nature appui *': 'SUBVENTION',
    'Consentement *': 'Oui',
    'Porteur — nom *': 'TRAORE',
    'Porteur — sexe *': 'F',
    'Montant appui': 1500.5,
    Devise: 'EUR',
  };

  it('parse une ligne 100% valide', () => {
    const r = mapLigneVersStructure(ligneValide);
    expect(r.erreursMapping).toHaveLength(0);
    expect(r.donneesParsees?.projet_code).toBe('PROJ_A14');
    expect(r.donneesParsees?.statut_creation).toBe('creation');
    expect(r.donneesParsees?.montant_appui).toBe(1500.5);
  });

  it('accepte le libellé statut français (Création)', () => {
    const r = mapLigneVersStructure({ ...ligneValide, 'Statut création *': 'Création' });
    expect(r.donneesParsees?.statut_creation).toBe('creation');
  });

  it('accepte le libellé devise (Euro (€))', () => {
    const r = mapLigneVersStructure({ ...ligneValide, Devise: 'Euro (€)' });
    expect(r.donneesParsees?.devise_code).toBe('EUR');
  });

  it('rejette nom de structure manquant', () => {
    const r = mapLigneVersStructure({ ...ligneValide, 'Nom structure *': '' });
    expect(r.donneesParsees).toBeNull();
    expect(r.erreursMapping.some((e) => e.colonne === 'Nom structure *')).toBe(true);
  });

  it('rejette type structure non reconnu', () => {
    const r = mapLigneVersStructure({ ...ligneValide, 'Type structure *': 'INCONNU' });
    expect(r.donneesParsees).toBeNull();
    expect(r.erreursMapping.some((e) => e.colonne === 'Type structure *')).toBe(true);
  });

  it('parse montant avec virgule décimale française', () => {
    const r = mapLigneVersStructure({ ...ligneValide, 'Montant appui': '1 500,50' });
    expect(r.donneesParsees?.montant_appui).toBe(1500.5);
  });
});
