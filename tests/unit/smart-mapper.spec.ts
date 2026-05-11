import { describe, it, expect } from 'vitest';
import {
  detecterEnTetesFlexibles,
  normaliserCodeProjet,
  normaliserCodePays,
  normaliserSexe,
  normaliserTrancheAge,
  normaliserDomaineFormation,
  normaliserModalite,
  normaliserStatut,
  normaliserConsentement,
  calculerScoreCompletude,
  fusionnerBeneficiaires,
  normaliserPourComparaison,
} from '@/lib/imports/smart-mapper';

describe('normaliserPourComparaison', () => {
  it('lowercase + strip accents + collapse whitespace + remove *', () => {
    expect(normaliserPourComparaison('Pays *')).toBe('pays');
    expect(normaliserPourComparaison('Année  durant')).toBe('annee durant');
    expect(normaliserPourComparaison(' Prénoms* ')).toBe('prenoms');
  });
});

describe('normaliserCodeProjet', () => {
  it('accepte le code officiel direct', () => {
    expect(normaliserCodeProjet('PROJ_A14')).toBe('PROJ_A14');
    expect(normaliserCodeProjet('proj_a14')).toBe('PROJ_A14');
  });
  it('mappe les alias abrégés', () => {
    expect(normaliserCodeProjet('P6')).toBe('PROJ_A06');
    expect(normaliserCodeProjet('P 6')).toBe('PROJ_A06');
    expect(normaliserCodeProjet('p16a')).toBe('PROJ_A16a');
    expect(normaliserCodeProjet('P14')).toBe('PROJ_A14');
  });
  it('retourne null pour les inconnus / vides', () => {
    expect(normaliserCodeProjet('')).toBeNull();
    expect(normaliserCodeProjet(null)).toBeNull();
    expect(normaliserCodeProjet('PXYZ')).toBeNull();
  });
});

describe('normaliserCodePays', () => {
  it('accepte le code ISO-3 direct', () => {
    expect(normaliserCodePays('CMR')).toBe('CMR');
    expect(normaliserCodePays('cmr')).toBe('CMR');
  });
  it('mappe les libellés français', () => {
    expect(normaliserCodePays('Cameroun')).toBe('CMR');
    expect(normaliserCodePays('cameroun')).toBe('CMR');
    expect(normaliserCodePays("Côte d'Ivoire")).toBe('CIV');
    expect(normaliserCodePays('Bénin')).toBe('BEN');
    expect(normaliserCodePays('RDC')).toBe('COD');
  });
  it('retourne null pour les inconnus', () => {
    expect(normaliserCodePays('Atlantide')).toBeNull();
    expect(normaliserCodePays(null)).toBeNull();
  });
});

describe('normaliserSexe', () => {
  it('mappe H/F/M/etc.', () => {
    expect(normaliserSexe('H')).toBe('M');
    expect(normaliserSexe('h')).toBe('M');
    expect(normaliserSexe('Homme')).toBe('M');
    expect(normaliserSexe('Masculin')).toBe('M');
    expect(normaliserSexe('Male')).toBe('M');
    expect(normaliserSexe('M')).toBe('M');
    expect(normaliserSexe('Femme')).toBe('F');
    expect(normaliserSexe('Féminin')).toBe('F');
    expect(normaliserSexe('F')).toBe('F');
  });
  it("renvoie 'Autre' / null si non reconnu", () => {
    expect(normaliserSexe('Autre')).toBe('Autre');
    expect(normaliserSexe('xyz')).toBeNull();
    expect(normaliserSexe('')).toBeNull();
  });
});

describe('normaliserTrancheAge', () => {
  it('mappe les variantes Jeune / Adulte', () => {
    expect(normaliserTrancheAge('Jeune')).toBe('Jeune');
    expect(normaliserTrancheAge('jeune')).toBe('Jeune');
    expect(normaliserTrancheAge('J')).toBe('Jeune');
    expect(normaliserTrancheAge('18-34')).toBe('Jeune');
    expect(normaliserTrancheAge('18-34 ans')).toBe('Jeune');
    expect(normaliserTrancheAge('Adulte')).toBe('Adulte');
    expect(normaliserTrancheAge('A')).toBe('Adulte');
    expect(normaliserTrancheAge('35+')).toBe('Adulte');
    expect(normaliserTrancheAge('35 ans et +')).toBe('Adulte');
  });
  it('null si vide ou inconnu', () => {
    expect(normaliserTrancheAge('')).toBeNull();
    expect(normaliserTrancheAge('senior')).toBeNull();
  });
});

describe('normaliserDomaineFormation', () => {
  it('accepte les codes officiels directs', () => {
    expect(normaliserDomaineFormation('NUM_INFO')).toBe('NUM_INFO');
    expect(normaliserDomaineFormation('agroalim')).toBe('AGROALIM');
  });
  it('mappe les libellés courants', () => {
    expect(normaliserDomaineFormation('numérique')).toBe('NUM_INFO');
    expect(normaliserDomaineFormation('compétences techniques')).toBe('NUM_INFO');
    expect(normaliserDomaineFormation('agriculture')).toBe('AGR_ELV_PCH');
    expect(normaliserDomaineFormation('entrepreneuriat')).toBe('ENTREPR_GEST');
    expect(normaliserDomaineFormation('tourisme')).toBe('TOURISME');
  });
  it('null pour les inconnus', () => {
    expect(normaliserDomaineFormation('xyz')).toBeNull();
  });
});

describe('normaliserModalite', () => {
  it('mappe presentiel/en ligne/hybride', () => {
    expect(normaliserModalite('Présentiel')).toBe('PRESENTIEL');
    expect(normaliserModalite('en ligne')).toBe('EN_LIGNE');
    expect(normaliserModalite('hybride')).toBe('HYBRIDE');
    expect(normaliserModalite('mixte')).toBe('HYBRIDE');
  });
});

describe('normaliserStatut', () => {
  it('mappe les statuts texte', () => {
    expect(normaliserStatut('INSCRIT')).toBe('INSCRIT');
    expect(normaliserStatut('inscrit')).toBe('INSCRIT');
    expect(normaliserStatut('Formation achevée')).toBe('FORMATION_ACHEVEE');
    expect(normaliserStatut('diplomé')).toBe('FORMATION_ACHEVEE');
    expect(normaliserStatut('abandon')).toBe('ABANDON');
  });
});

describe('normaliserConsentement', () => {
  it('vérité', () => {
    expect(normaliserConsentement(true)).toBe(true);
    expect(normaliserConsentement('oui')).toBe(true);
    expect(normaliserConsentement('Yes')).toBe(true);
    expect(normaliserConsentement(1)).toBe(true);
  });
  it('faux', () => {
    expect(normaliserConsentement(false)).toBe(false);
    expect(normaliserConsentement('non')).toBe(false);
    expect(normaliserConsentement('refus')).toBe(false);
  });
  it('null si ambigu', () => {
    expect(normaliserConsentement('')).toBeNull();
    expect(normaliserConsentement(null)).toBeNull();
    expect(normaliserConsentement('peut-etre')).toBeNull();
  });
});

describe('detecterEnTetesFlexibles', () => {
  const headersOfficiels = [
    'Code projet *',
    'Code pays bénéficiaire *',
    'Prénom *',
    'Nom *',
    'Sexe *',
    'Domaine de formation *',
    'Modalité *',
    'Année de la formation *',
    'Statut *',
    'Consentement *',
    'Courriel',
    'Téléphone (avec indicatif)',
    "Partenaire d'accompagnement",
    'Fonction / Statut actuel',
    "Tranche d'âge déclarée",
  ];

  it('match exact (insensible casse/accent)', () => {
    const { mapping, headersMappesAuto } = detecterEnTetesFlexibles(
      ['Code projet *', 'Code pays bénéficiaire *'],
      headersOfficiels,
    );
    expect(mapping.get('Code projet *')).toBe('Code projet *');
    // L'exact match ne va PAS dans headersMappesAuto (pas de transformation)
    expect(headersMappesAuto['Code projet *']).toBeUndefined();
  });

  it('match via synonyme connu', () => {
    const { mapping, headersMappesAuto } = detecterEnTetesFlexibles(
      ['Projet', 'Pays de Provenance', 'Genre', 'Contact'],
      headersOfficiels,
    );
    expect(mapping.get('Projet')).toBe('Code projet *');
    expect(mapping.get('Pays de Provenance')).toBe('Code pays bénéficiaire *');
    expect(mapping.get('Genre')).toBe('Sexe *');
    expect(mapping.get('Contact')).toBe('Téléphone (avec indicatif)');
    expect(Object.keys(headersMappesAuto).length).toBe(4);
  });

  it('détecte les en-têtes réelles du fichier P6 (cas concret)', () => {
    const headersP6 = [
      'N°',
      'Projet',
      'Prénoms*',
      'Nom*',
      'Sexe*\n(M/F)',
      'Jeune (18-34 ans)/*\nAdulte (35 ans et +)1',
      'Pays de Provenance*',
      'Fonction',
      'Structure',
      'Type de formation suivi',
      'Année durant laquelle la formation a été suivie',
    ];
    const { mapping, headersNonReconnus } = detecterEnTetesFlexibles(
      headersP6,
      headersOfficiels,
    );
    expect(mapping.get('Projet')).toBe('Code projet *');
    expect(mapping.get('Prénoms*')).toBe('Prénom *');
    expect(mapping.get('Nom*')).toBe('Nom *');
    expect(mapping.get('Sexe*\n(M/F)')).toBe('Sexe *');
    expect(mapping.get('Pays de Provenance*')).toBe('Code pays bénéficiaire *');
    expect(mapping.get('Fonction')).toBe('Fonction / Statut actuel');
    expect(mapping.get('Structure')).toBe("Partenaire d'accompagnement");
    expect(mapping.get('Type de formation suivi')).toBe('Domaine de formation *');
    expect(mapping.get('Année durant laquelle la formation a été suivie')).toBe(
      'Année de la formation *',
    );
    expect(mapping.get('Jeune (18-34 ans)/*\nAdulte (35 ans et +)1')).toBe(
      "Tranche d'âge déclarée",
    );
    expect(headersNonReconnus).toEqual(['N°']);
  });

  it('liste les non-reconnus', () => {
    const { headersNonReconnus } = detecterEnTetesFlexibles(
      ['Note libre', 'XYZ'],
      headersOfficiels,
    );
    expect(headersNonReconnus).toEqual(['Note libre', 'XYZ']);
  });
});

describe('calculerScoreCompletude', () => {
  it('compte les champs renseignés avec poids', () => {
    expect(calculerScoreCompletude({})).toBe(0);
    expect(calculerScoreCompletude({ prenom: 'Alice' })).toBe(3);
    expect(
      calculerScoreCompletude({
        prenom: 'Alice',
        nom: 'Dupont',
        sexe: 'F',
        pays_code: 'BEN',
      }),
    ).toBe(3 + 3 + 2 + 2);
  });
  it('ignore les chaînes vides et null', () => {
    expect(calculerScoreCompletude({ prenom: '', nom: null, sexe: 'F' })).toBe(2);
  });
});

describe('fusionnerBeneficiaires', () => {
  // Type explicite pour permettre la coexistence string | null dans les champs.
  type Fixture = {
    prenom: string | null;
    nom: string | null;
    sexe?: string | null;
    courriel?: string | null;
  };

  it("ne remplace pas un champ existant non vide", () => {
    const existant: Fixture = { prenom: 'Alice', nom: 'Dupont', courriel: null };
    const nouveau: Partial<Fixture> = { prenom: 'Bob', courriel: 'a@b.com' };
    const { fusionne, champsMisAJour } = fusionnerBeneficiaires(existant, nouveau);
    expect(fusionne.prenom).toBe('Alice'); // pas écrasé
    expect(fusionne.nom).toBe('Dupont');
    expect(fusionne.courriel).toBe('a@b.com'); // comblement du null
    expect(champsMisAJour).toEqual(['courriel']);
  });

  it('comble plusieurs champs manquants', () => {
    const existant: Fixture = { prenom: 'Alice', nom: '', sexe: null, courriel: undefined };
    const nouveau: Partial<Fixture> = { nom: 'Dupont', sexe: 'F', courriel: 'a@b.com' };
    const { fusionne, champsMisAJour } = fusionnerBeneficiaires(existant, nouveau);
    expect(fusionne.nom).toBe('Dupont');
    expect(fusionne.sexe).toBe('F');
    expect(fusionne.courriel).toBe('a@b.com');
    expect(champsMisAJour.sort()).toEqual(['courriel', 'nom', 'sexe']);
  });
});
