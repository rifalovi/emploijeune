import { describe, it, expect } from 'vitest';
import {
  creerCompteUtilisateurSchema,
  ROLES_CREABLES,
  ROLE_CREABLE_LIBELLES,
} from '@/lib/schemas/utilisateur';

const baseValide = {
  email: 'awa.traore@francophonie.org',
  prenom: 'Awa',
  nom: 'TRAORE',
  role: 'editeur_projet' as const,
  projets_geres: ['PROJ_A14'],
};

describe('creerCompteUtilisateurSchema', () => {
  it('accepte un coordonnateur valide avec un projet', () => {
    expect(creerCompteUtilisateurSchema.safeParse(baseValide).success).toBe(true);
  });

  it('rejette un coordonnateur sans projet', () => {
    const r = creerCompteUtilisateurSchema.safeParse({
      ...baseValide,
      projets_geres: [],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'projets_geres')).toBe(true);
    }
  });

  it('accepte un contributeur partenaire avec organisation', () => {
    expect(
      creerCompteUtilisateurSchema.safeParse({
        ...baseValide,
        role: 'contributeur_partenaire',
        projets_geres: undefined,
        organisation_id: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
  });

  it('rejette un contributeur partenaire sans organisation', () => {
    const r = creerCompteUtilisateurSchema.safeParse({
      ...baseValide,
      role: 'contributeur_partenaire',
      projets_geres: undefined,
      organisation_id: undefined,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'organisation_id')).toBe(true);
    }
  });

  it('accepte un lecteur sans organisation ni projet', () => {
    expect(
      creerCompteUtilisateurSchema.safeParse({
        ...baseValide,
        role: 'lecteur',
        projets_geres: [],
      }).success,
    ).toBe(true);
  });

  it('rejette un email invalide', () => {
    expect(
      creerCompteUtilisateurSchema.safeParse({ ...baseValide, email: 'pas-un-email' }).success,
    ).toBe(false);
  });

  it('rejette un nom contenant des chiffres', () => {
    expect(
      creerCompteUtilisateurSchema.safeParse({ ...baseValide, nom: 'TRAORE2024' }).success,
    ).toBe(false);
  });

  it('lowercase + trim sur l’email', () => {
    const r = creerCompteUtilisateurSchema.parse({
      ...baseValide,
      email: '  Awa.Traore@FRANCOPHONIE.ORG  ',
    });
    expect(r.email).toBe('awa.traore@francophonie.org');
  });

  it('uppercase sur le nom (style fr-FR)', () => {
    const r = creerCompteUtilisateurSchema.parse({ ...baseValide, nom: 'traore' });
    expect(r.nom).toBe('TRAORE');
  });

  it('accepte les caractères accentués dans prénom/nom', () => {
    expect(
      creerCompteUtilisateurSchema.safeParse({
        ...baseValide,
        prenom: 'Aïssatou',
        nom: 'M’BENGUE',
      }).success,
    ).toBe(true);
  });

  it('rejette un rôle inattendu (admin_scs interdit à la création par cet endpoint)', () => {
    expect(
      creerCompteUtilisateurSchema.safeParse({ ...baseValide, role: 'admin_scs' }).success,
    ).toBe(false);
  });

  it('rejette un projet_code hors nomenclature', () => {
    expect(
      creerCompteUtilisateurSchema.safeParse({ ...baseValide, projets_geres: ['PROJ_INVALID'] })
        .success,
    ).toBe(false);
  });
});

describe('ROLES_CREABLES + libellés', () => {
  it('expose 3 rôles créables (pas admin_scs)', () => {
    expect(ROLES_CREABLES).toEqual(['editeur_projet', 'contributeur_partenaire', 'lecteur']);
  });

  it('chaque rôle a un libellé non vide', () => {
    for (const r of ROLES_CREABLES) {
      expect(ROLE_CREABLE_LIBELLES[r]).toBeTruthy();
    }
  });
});
