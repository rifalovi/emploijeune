import { describe, it, expect } from 'vitest';
import {
  beneficiaireInsertSchema,
  beneficiaireUpdateSchema,
  beneficiaireFiltersSchema,
  repriseCohorteSchema,
} from '@/lib/schemas/beneficiaire';

/** Gabarit minimal valide de création. */
const baseValide = {
  prenom: 'Awa',
  nom: 'Traoré',
  sexe: 'F' as const,
  projet_code: 'PROJ_A16a' as const,
  pays_code: 'MLI' as const,
  domaine_formation_code: 'NUM_INFO' as const,
  annee_formation: 2024,
  statut_code: 'FORMATION_ACHEVEE' as const,
  consentement_recueilli: false,
};

describe('beneficiaireInsertSchema — champs obligatoires', () => {
  it('accepte un bénéficiaire minimum valide', () => {
    const res = beneficiaireInsertSchema.safeParse(baseValide);
    expect(res.success).toBe(true);
  });

  it('normalise le nom en majuscules françaises', () => {
    const res = beneficiaireInsertSchema.safeParse({ ...baseValide, nom: 'Côté' });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.nom).toBe('CÔTÉ');
  });

  it('rejette prénom vide', () => {
    const res = beneficiaireInsertSchema.safeParse({ ...baseValide, prenom: '' });
    expect(res.success).toBe(false);
  });

  it('rejette un caractère non autorisé dans le nom', () => {
    const res = beneficiaireInsertSchema.safeParse({ ...baseValide, nom: 'Traoré<script>' });
    expect(res.success).toBe(false);
  });

  it('rejette un sexe hors enum', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      sexe: 'Neutre' as unknown as 'F',
    });
    expect(res.success).toBe(false);
  });

  it('rejette un code projet non référencé', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      projet_code: 'P14' as unknown as 'PROJ_A14',
    });
    expect(res.success).toBe(false);
  });

  it('rejette un code pays en minuscules', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      pays_code: 'mli' as unknown as 'MLI',
    });
    expect(res.success).toBe(false);
  });

  it('rejette une année < 2020', () => {
    const res = beneficiaireInsertSchema.safeParse({ ...baseValide, annee_formation: 2019 });
    expect(res.success).toBe(false);
  });

  it('accepte une année string et la coerce en number', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      annee_formation: '2024' as unknown as 2024,
    });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.annee_formation).toBe(2024);
  });
});

describe('beneficiaireInsertSchema — règles RGPD (superRefine)', () => {
  it('consentement=true sans date de consentement → erreur', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      consentement_recueilli: true,
      consentement_date: undefined,
      telephone: '+22676123456',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes('consentement_date'))).toBe(true);
    }
  });

  it('consentement=true sans aucun contact → erreur', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      consentement_recueilli: true,
      consentement_date: '2024-01-15',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes('telephone'))).toBe(true);
    }
  });

  it('consentement=true avec téléphone valide → OK', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      consentement_recueilli: true,
      consentement_date: '2024-01-15',
      telephone: '+22676123456',
    });
    expect(res.success).toBe(true);
  });

  it('consentement=true avec courriel uniquement → OK', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      consentement_recueilli: true,
      consentement_date: '2024-01-15',
      courriel: 'awa@example.org',
    });
    expect(res.success).toBe(true);
  });

  it('consentement=false avec téléphone → erreur RGPD (contact sans consentement)', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      consentement_recueilli: false,
      telephone: '+22676123456',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes('consentement_recueilli'))).toBe(true);
    }
  });

  it('téléphone sans indicatif + → erreur format', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      consentement_recueilli: true,
      consentement_date: '2024-01-15',
      telephone: '0676123456',
    });
    expect(res.success).toBe(false);
  });

  it('téléphone trop court → erreur', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      consentement_recueilli: true,
      consentement_date: '2024-01-15',
      telephone: '+22612',
    });
    expect(res.success).toBe(false);
  });

  it('courriel invalide → erreur', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      consentement_recueilli: true,
      consentement_date: '2024-01-15',
      courriel: 'pas-un-email',
    });
    expect(res.success).toBe(false);
  });
});

describe('beneficiaireInsertSchema — règles dates formation', () => {
  it('date_fin < date_debut → erreur', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      date_debut_formation: '2024-06-01',
      date_fin_formation: '2024-05-01',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes('date_fin_formation'))).toBe(true);
    }
  });

  it('date_fin == date_debut → OK', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      date_debut_formation: '2024-06-01',
      date_fin_formation: '2024-06-01',
    });
    expect(res.success).toBe(true);
  });

  it('date_fin > date_debut → OK', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      date_debut_formation: '2024-01-15',
      date_fin_formation: '2024-06-30',
    });
    expect(res.success).toBe(true);
  });

  it('seule date_debut renseignée → OK', () => {
    const res = beneficiaireInsertSchema.safeParse({
      ...baseValide,
      date_debut_formation: '2024-01-15',
    });
    expect(res.success).toBe(true);
  });
});

describe('beneficiaireUpdateSchema', () => {
  it('exige un id UUID', () => {
    const res = beneficiaireUpdateSchema.safeParse(baseValide);
    expect(res.success).toBe(false);
  });

  it('accepte un id UUID valide + base', () => {
    const res = beneficiaireUpdateSchema.safeParse({
      ...baseValide,
      id: '123e4567-e89b-42d3-a456-426614174000',
    });
    expect(res.success).toBe(true);
  });

  it("applique les mêmes règles RGPD que l'insert", () => {
    const res = beneficiaireUpdateSchema.safeParse({
      ...baseValide,
      id: '123e4567-e89b-42d3-a456-426614174000',
      consentement_recueilli: true,
    });
    expect(res.success).toBe(false);
  });
});

describe('beneficiaireFiltersSchema', () => {
  it('page par défaut = 1 quand absent', () => {
    const res = beneficiaireFiltersSchema.safeParse({});
    if (!res.success) throw new Error('should be valid');
    expect(res.data.page).toBe(1);
  });

  it("normalise 'tous' en undefined pour les filtres enum", () => {
    const res = beneficiaireFiltersSchema.safeParse({
      projet_code: 'tous',
      pays_code: 'tous',
      ps: 'tous',
    });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.projet_code).toBeUndefined();
    expect(res.data.pays_code).toBeUndefined();
    expect(res.data.ps).toBeUndefined();
  });

  it('normalise la chaîne vide en undefined pour la recherche', () => {
    const res = beneficiaireFiltersSchema.safeParse({ q: '   ' });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.q).toBeUndefined();
  });

  it('accepte un filtre PS valide', () => {
    const res = beneficiaireFiltersSchema.safeParse({ ps: 'PS3' });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.ps).toBe('PS3');
  });

  it('rejette un PS invalide', () => {
    const res = beneficiaireFiltersSchema.safeParse({ ps: 'PS9' });
    expect(res.success).toBe(false);
  });

  it("mien='true' → boolean true", () => {
    const res = beneficiaireFiltersSchema.safeParse({ mien: 'true' });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.mien).toBe(true);
  });

  it('mien absent → undefined', () => {
    const res = beneficiaireFiltersSchema.safeParse({});
    if (!res.success) throw new Error('should be valid');
    expect(res.data.mien).toBeUndefined();
  });
});

describe('repriseCohorteSchema', () => {
  it('accepte tous les champs à undefined', () => {
    const res = repriseCohorteSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it('accepte un pré-remplissage typique', () => {
    const res = repriseCohorteSchema.safeParse({
      cohorte_projet: 'PROJ_A16a',
      cohorte_pays: 'MLI',
      cohorte_domaine: 'NUM_INFO',
      cohorte_annee: '2024',
      cohorte_modalite: 'PRESENTIEL',
    });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.cohorte_projet).toBe('PROJ_A16a');
    expect(res.data.cohorte_annee).toBe(2024);
  });

  it('rejette un projet inexistant', () => {
    const res = repriseCohorteSchema.safeParse({
      cohorte_projet: 'PROJ_XX',
    });
    expect(res.success).toBe(false);
  });
});
