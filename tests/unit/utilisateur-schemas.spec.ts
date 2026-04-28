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

  it("accepte admin_scs au niveau Zod (v2.0.1) — la hiérarchie est appliquée par la Server Action via rolesCreablesPar", () => {
    // Le schéma Zod accepte tous les rôles ; le filtrage hiérarchique est fait
    // côté Server Action (cf. rolesCreablesPar dans @/lib/schemas/utilisateur).
    expect(
      creerCompteUtilisateurSchema.safeParse({ ...baseValide, role: 'admin_scs' }).success,
    ).toBe(true);
  });

  it('rejette un rôle inconnu', () => {
    expect(
      creerCompteUtilisateurSchema.safeParse({ ...baseValide, role: 'visiteur' }).success,
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
  it('expose les 5 rôles (v2.0.1+) — le filtrage est fait par rolesCreablesPar', () => {
    expect(ROLES_CREABLES).toEqual([
      'super_admin',
      'admin_scs',
      'editeur_projet',
      'contributeur_partenaire',
      'lecteur',
    ]);
  });

  it('chaque rôle a un libellé non vide', () => {
    for (const r of ROLES_CREABLES) {
      expect(ROLE_CREABLE_LIBELLES[r]).toBeTruthy();
    }
  });
});

describe('rolesCreablesPar — hiérarchie v2.0.1', () => {
  it('super_admin peut créer tous les rôles', async () => {
    const { rolesCreablesPar } = await import('@/lib/schemas/utilisateur');
    const roles = rolesCreablesPar('super_admin');
    expect(roles).toContain('super_admin');
    expect(roles).toContain('admin_scs');
    expect(roles).toContain('lecteur');
    expect(roles).toHaveLength(5);
  });

  it("admin_scs peut créer uniquement editeur_projet, contributeur_partenaire, lecteur", async () => {
    const { rolesCreablesPar } = await import('@/lib/schemas/utilisateur');
    const roles = rolesCreablesPar('admin_scs');
    expect(roles).toEqual(['editeur_projet', 'contributeur_partenaire', 'lecteur']);
  });

  it("les autres rôles ne peuvent rien créer", async () => {
    const { rolesCreablesPar } = await import('@/lib/schemas/utilisateur');
    expect(rolesCreablesPar('editeur_projet')).toEqual([]);
    expect(rolesCreablesPar('contributeur_partenaire')).toEqual([]);
    expect(rolesCreablesPar('lecteur')).toEqual([]);
  });
});
