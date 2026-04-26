import { describe, it, expect } from 'vitest';
import {
  creerDemandeAccesSchema,
  rejeterDemandeSchema,
  ROLE_DEMANDABLE_LIBELLES,
  ROLES_DEMANDABLES,
} from '@/lib/schemas/demande-acces';

describe('creerDemandeAccesSchema', () => {
  const valide = {
    email: 'awa.traore@francophonie.org',
    prenom: 'Awa',
    nom: 'TRAORE',
    role_souhaite: 'editeur_projet' as const,
    contexte_souhaite: 'PROJ_A14, PROJ_A16a',
    justification: 'Je suis chargée de mission OIF pour les projets D-CLIC et PROFEFA depuis 2024.',
    consentement_rgpd: true as const,
  };

  it('accepte un payload valide', () => {
    expect(creerDemandeAccesSchema.safeParse(valide).success).toBe(true);
  });

  it('rejette consentement RGPD = false', () => {
    expect(creerDemandeAccesSchema.safeParse({ ...valide, consentement_rgpd: false }).success).toBe(
      false,
    );
  });

  it('rejette email invalide', () => {
    expect(creerDemandeAccesSchema.safeParse({ ...valide, email: 'pas-email' }).success).toBe(
      false,
    );
  });

  it('rejette justification trop courte (< 20 chars)', () => {
    expect(creerDemandeAccesSchema.safeParse({ ...valide, justification: 'court' }).success).toBe(
      false,
    );
  });

  it('rejette role_souhaite hors enum (admin_scs interdit)', () => {
    expect(
      creerDemandeAccesSchema.safeParse({ ...valide, role_souhaite: 'admin_scs' as never }).success,
    ).toBe(false);
  });

  it('lowercase + trim de l’email', () => {
    const r = creerDemandeAccesSchema.parse({
      ...valide,
      email: '  Awa@FRANCO.ORG  ',
    });
    expect(r.email).toBe('awa@franco.org');
  });

  it('UPPERCASE du nom', () => {
    const r = creerDemandeAccesSchema.parse({ ...valide, nom: 'traore' });
    expect(r.nom).toBe('TRAORE');
  });

  it('contexte_souhaite optionnel (chaîne vide → undefined)', () => {
    const r = creerDemandeAccesSchema.parse({ ...valide, contexte_souhaite: '' });
    expect(r.contexte_souhaite).toBeUndefined();
  });
});

describe('rejeterDemandeSchema', () => {
  it('accepte un payload valide', () => {
    expect(
      rejeterDemandeSchema.safeParse({
        demandeId: '11111111-1111-4111-8111-111111111111',
        raison: 'Hors périmètre du pilote actuel.',
      }).success,
    ).toBe(true);
  });

  it('rejette UUID invalide', () => {
    expect(
      rejeterDemandeSchema.safeParse({ demandeId: 'pas-uuid', raison: 'Raison valide longue' })
        .success,
    ).toBe(false);
  });

  it('rejette raison trop courte (< 10 chars)', () => {
    expect(
      rejeterDemandeSchema.safeParse({
        demandeId: '11111111-1111-4111-8111-111111111111',
        raison: 'court',
      }).success,
    ).toBe(false);
  });
});

describe('ROLES_DEMANDABLES + libellés', () => {
  it('expose 2 rôles (pas admin_scs ni lecteur)', () => {
    expect(ROLES_DEMANDABLES).toEqual(['editeur_projet', 'contributeur_partenaire']);
  });

  it('libellés français présents', () => {
    expect(ROLE_DEMANDABLE_LIBELLES.editeur_projet).toMatch(/Coordonnateur/);
    expect(ROLE_DEMANDABLE_LIBELLES.contributeur_partenaire).toMatch(/Partenaire/);
  });
});
