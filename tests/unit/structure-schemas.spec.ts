import { describe, it, expect } from 'vitest';
import {
  structureInsertSchema,
  structureUpdateSchema,
  structureFiltersSchema,
  repriseCohorteStructureSchema,
} from '@/lib/schemas/structure';

/** Gabarit minimal valide de création (champs obligatoires uniquement). */
const baseValide = {
  nom_structure: 'COOPAGRO',
  type_structure_code: 'COOP' as const,
  secteur_activite_code: 'AGR_SYL_PCH' as const,
  statut_creation: 'creation' as const,
  projet_code: 'PROJ_A16a' as const,
  pays_code: 'MLI' as const,
  porteur_nom: 'Traoré',
  porteur_sexe: 'F' as const,
  annee_appui: 2024,
  nature_appui_code: 'SUBVENTION' as const,
  consentement_recueilli: false,
};

describe('structureInsertSchema — champs obligatoires', () => {
  it('accepte une structure minimum valide', () => {
    const res = structureInsertSchema.safeParse(baseValide);
    expect(res.success).toBe(true);
  });

  it('normalise le nom du porteur en majuscules françaises', () => {
    const res = structureInsertSchema.safeParse({ ...baseValide, porteur_nom: 'Côté' });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.porteur_nom).toBe('CÔTÉ');
  });

  it('rejette un nom de structure vide', () => {
    const res = structureInsertSchema.safeParse({ ...baseValide, nom_structure: '' });
    expect(res.success).toBe(false);
  });

  it('rejette un nom de structure contenant des chevrons (protection XSS)', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      nom_structure: 'COOPAGRO<script>',
    });
    expect(res.success).toBe(false);
  });

  it('accepte un nom de structure avec chiffres et ponctuation (cas réaliste)', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      nom_structure: 'GIE 3-FRÈRES & Cie (2024)',
    });
    expect(res.success).toBe(true);
  });

  it('rejette un type de structure hors enum', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      type_structure_code: 'INCONNU' as unknown as 'COOP',
    });
    expect(res.success).toBe(false);
  });

  it('rejette un statut_creation hors enum', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      statut_creation: 'faux' as unknown as 'creation',
    });
    expect(res.success).toBe(false);
  });

  it('rejette une année d’appui avant 2000', () => {
    const res = structureInsertSchema.safeParse({ ...baseValide, annee_appui: 1999 });
    expect(res.success).toBe(false);
  });

  it('rejette une année d’appui trop future (> année+1)', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      annee_appui: new Date().getFullYear() + 2,
    });
    expect(res.success).toBe(false);
  });
});

describe('structureInsertSchema — règles RGPD', () => {
  const avecConsentement = {
    ...baseValide,
    consentement_recueilli: true,
    consentement_date: '2024-05-01',
    telephone_porteur: '+22676123456',
  };

  it('accepte consentement=true + date + téléphone valides', () => {
    const res = structureInsertSchema.safeParse(avecConsentement);
    expect(res.success).toBe(true);
  });

  it('rejette consentement=true sans date de consentement', () => {
    const res = structureInsertSchema.safeParse({
      ...avecConsentement,
      consentement_date: undefined,
    });
    expect(res.success).toBe(false);
  });

  it('rejette consentement=true sans aucun contact', () => {
    const res = structureInsertSchema.safeParse({
      ...avecConsentement,
      telephone_porteur: undefined,
      courriel_porteur: undefined,
    });
    expect(res.success).toBe(false);
  });

  it('rejette consentement=false avec un téléphone saisi (fuite RGPD)', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      telephone_porteur: '+22676123456',
    });
    expect(res.success).toBe(false);
  });

  it('rejette date consentement > date création structure', () => {
    const res = structureInsertSchema.safeParse({
      ...avecConsentement,
      date_creation: '2024-01-01',
      consentement_date: '2025-06-15',
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const issue = res.error.issues.find((i) => i.path[0] === 'consentement_date');
    expect(issue?.message).toContain('antérieure ou égale');
  });

  it('accepte date consentement = date création (inscription le jour même)', () => {
    const res = structureInsertSchema.safeParse({
      ...avecConsentement,
      date_creation: '2024-05-01',
      consentement_date: '2024-05-01',
    });
    expect(res.success).toBe(true);
  });
});

describe('structureInsertSchema — règle montant ↔ devise', () => {
  it('accepte montant + devise cohérents', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      montant_appui: 5000,
      devise_code: 'EUR',
    });
    expect(res.success).toBe(true);
  });

  it('accepte ni montant ni devise (tous deux optionnels ensemble)', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      montant_appui: undefined,
      devise_code: undefined,
    });
    expect(res.success).toBe(true);
  });

  it('rejette montant sans devise', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      montant_appui: 5000,
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) => i.path[0] === 'devise_code')).toBe(true);
  });

  it('rejette un montant négatif', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      montant_appui: -100,
      devise_code: 'EUR',
    });
    expect(res.success).toBe(false);
  });
});

describe('structureInsertSchema — coordonnées géographiques', () => {
  it('accepte latitude/longitude valides (Bamako)', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      latitude: 12.6392,
      longitude: -8.0029,
    });
    expect(res.success).toBe(true);
  });

  it('rejette latitude hors plage (> 90)', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      latitude: 91,
      longitude: 0,
    });
    expect(res.success).toBe(false);
  });

  it('rejette longitude hors plage (< -180)', () => {
    const res = structureInsertSchema.safeParse({
      ...baseValide,
      latitude: 0,
      longitude: -181,
    });
    expect(res.success).toBe(false);
  });
});

describe('structureUpdateSchema — édition', () => {
  it('exige un id UUID valide', () => {
    const sansId = { ...baseValide };
    const res = structureUpdateSchema.safeParse(sansId);
    expect(res.success).toBe(false);
  });

  it('rejette un id non-UUID', () => {
    const res = structureUpdateSchema.safeParse({ ...baseValide, id: 'pas-un-uuid' });
    expect(res.success).toBe(false);
  });

  it('accepte un id UUID v4 valide', () => {
    const res = structureUpdateSchema.safeParse({
      ...baseValide,
      id: '123e4567-e89b-42d3-a456-426614174000',
    });
    expect(res.success).toBe(true);
  });
});

describe('structureFiltersSchema — query string', () => {
  it('parse des filtres simples', () => {
    const res = structureFiltersSchema.safeParse({
      projet_code: 'PROJ_A16a',
      pays_code: 'MLI',
      annee_appui: '2024',
      page: '3',
    });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.projet_code).toBe('PROJ_A16a');
    expect(res.data.annee_appui).toBe(2024);
    expect(res.data.page).toBe(3);
  });

  it('normalise "tous" en undefined', () => {
    const res = structureFiltersSchema.safeParse({
      projet_code: 'tous',
      secteur_activite_code: 'tous',
    });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.projet_code).toBeUndefined();
    expect(res.data.secteur_activite_code).toBeUndefined();
  });

  it('applique page=1 par défaut', () => {
    const res = structureFiltersSchema.safeParse({});
    if (!res.success) throw new Error('should be valid');
    expect(res.data.page).toBe(1);
  });

  it('rejette une année < 2000', () => {
    const res = structureFiltersSchema.safeParse({ annee_appui: 1999 });
    expect(res.success).toBe(false);
  });
});

describe('repriseCohorteStructureSchema', () => {
  it('parse les params de cohorte', () => {
    const res = repriseCohorteStructureSchema.safeParse({
      cohorte_projet: 'PROJ_A16a',
      cohorte_pays: 'MLI',
      cohorte_nature_appui: 'SUBVENTION',
      cohorte_devise: 'XOF',
      cohorte_annee: '2024',
    });
    if (!res.success) throw new Error('should be valid');
    expect(res.data.cohorte_projet).toBe('PROJ_A16a');
    expect(res.data.cohorte_annee).toBe(2024);
  });

  it('rejette une cohorte_nature_appui inexistante', () => {
    const res = repriseCohorteStructureSchema.safeParse({
      cohorte_nature_appui: 'INCONNU',
    });
    expect(res.success).toBe(false);
  });
});
