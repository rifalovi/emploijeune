import { describe, it, expect } from 'vitest';
import {
  modifierUtilisateurSchema,
  ROLES_MODIFIABLES,
  ROLE_MODIFIABLE_LIBELLES,
} from '@/lib/schemas/utilisateur-modifier';

const valide = {
  utilisateurId: '11111111-1111-4111-8111-111111111111',
  nom_complet: 'Awa TRAORE',
  role: 'editeur_projet' as const,
  organisation_id: '22222222-2222-4222-8222-222222222222',
  actif: true,
};

describe('modifierUtilisateurSchema', () => {
  it('accepte un payload valide', () => {
    expect(modifierUtilisateurSchema.safeParse(valide).success).toBe(true);
  });

  it('rejette utilisateurId non UUID', () => {
    expect(
      modifierUtilisateurSchema.safeParse({ ...valide, utilisateurId: 'pas-uuid' }).success,
    ).toBe(false);
  });

  it('rejette nom_complet trop court', () => {
    expect(modifierUtilisateurSchema.safeParse({ ...valide, nom_complet: 'A' }).success).toBe(
      false,
    );
  });

  it('rejette nom_complet avec chiffres', () => {
    expect(
      modifierUtilisateurSchema.safeParse({ ...valide, nom_complet: 'Carlos2024' }).success,
    ).toBe(false);
  });

  it('accepte nom_complet avec accents', () => {
    expect(
      modifierUtilisateurSchema.safeParse({ ...valide, nom_complet: 'Aïssatou M’BENGUE' }).success,
    ).toBe(true);
  });

  it('accepte super_admin (v2.0.1+)', () => {
    expect(modifierUtilisateurSchema.safeParse({ ...valide, role: 'super_admin' }).success).toBe(
      true,
    );
  });

  it('rejette rôle hors enum', () => {
    expect(modifierUtilisateurSchema.safeParse({ ...valide, role: 'visiteur' }).success).toBe(
      false,
    );
  });

  it('accepte organisation_id vide ou null', () => {
    expect(modifierUtilisateurSchema.safeParse({ ...valide, organisation_id: '' }).success).toBe(
      true,
    );
    expect(modifierUtilisateurSchema.safeParse({ ...valide, organisation_id: null }).success).toBe(
      true,
    );
  });

  it('rejette raison de plus de 500 caractères', () => {
    const trop = 'x'.repeat(600);
    expect(
      modifierUtilisateurSchema.safeParse({ ...valide, raison_changement: trop }).success,
    ).toBe(false);
  });

  it('actif est obligatoire (boolean)', () => {
    const sansActif = { ...valide };
    delete (sansActif as { actif?: boolean }).actif;
    expect(modifierUtilisateurSchema.safeParse(sansActif).success).toBe(false);
  });
});

describe('ROLES_MODIFIABLES', () => {
  it('expose 5 rôles (super_admin inclus depuis v2.0.1)', () => {
    expect(ROLES_MODIFIABLES).toEqual([
      'super_admin',
      'admin_scs',
      'editeur_projet',
      'contributeur_partenaire',
      'lecteur',
    ]);
  });

  it('libellés français présents pour chaque rôle', () => {
    for (const r of ROLES_MODIFIABLES) {
      expect(ROLE_MODIFIABLE_LIBELLES[r]).toBeTruthy();
      expect(ROLE_MODIFIABLE_LIBELLES[r].length).toBeGreaterThan(3);
    }
  });
});
