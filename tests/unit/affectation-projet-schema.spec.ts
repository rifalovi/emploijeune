import { describe, it, expect } from 'vitest';
import {
  ajouterProjetSchema,
  retirerProjetSchema,
  transfererProjetSchema,
  changerProjetStructureSchema,
  ROLES_DANS_PROJET,
  ROLE_DANS_PROJET_LIBELLES,
} from '@/lib/schemas/affectation-projet';

const userId = '11111111-1111-4111-8111-111111111111';
const userId2 = '22222222-2222-4222-8222-222222222222';
const structureId = '33333333-3333-4333-8333-333333333333';

describe('ajouterProjetSchema', () => {
  it('accepte un payload valide', () => {
    const r = ajouterProjetSchema.safeParse({
      userId,
      projet_code: 'PROJ_A14',
      role_dans_projet: 'gestionnaire_principal',
    });
    expect(r.success).toBe(true);
  });

  it('défaut role_dans_projet = gestionnaire_principal', () => {
    const r = ajouterProjetSchema.safeParse({ userId, projet_code: 'PROJ_A14' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.role_dans_projet).toBe('gestionnaire_principal');
  });

  it('rejette code projet en minuscules', () => {
    expect(ajouterProjetSchema.safeParse({ userId, projet_code: 'proj_a14' }).success).toBe(false);
  });

  it('rejette userId non UUID', () => {
    expect(
      ajouterProjetSchema.safeParse({ userId: 'pas-uuid', projet_code: 'PROJ_A14' }).success,
    ).toBe(false);
  });

  it('rejette role_dans_projet hors enum', () => {
    expect(
      ajouterProjetSchema.safeParse({
        userId,
        projet_code: 'PROJ_A14',
        role_dans_projet: 'super_role',
      }).success,
    ).toBe(false);
  });

  it('raison plus de 500 chars rejetée', () => {
    expect(
      ajouterProjetSchema.safeParse({
        userId,
        projet_code: 'PROJ_A14',
        raison: 'x'.repeat(600),
      }).success,
    ).toBe(false);
  });
});

describe('retirerProjetSchema', () => {
  it('accepte un payload valide', () => {
    expect(
      retirerProjetSchema.safeParse({ userId, projet_code: 'PROJ_A14', raison: 'fin de mission' })
        .success,
    ).toBe(true);
  });

  it('raison optionnelle', () => {
    expect(retirerProjetSchema.safeParse({ userId, projet_code: 'PROJ_A14' }).success).toBe(true);
  });
});

describe('transfererProjetSchema', () => {
  it('accepte un payload valide', () => {
    expect(
      transfererProjetSchema.safeParse({
        fromUserId: userId,
        toUserId: userId2,
        projet_code: 'PROJ_A14',
        raison: 'départ de Marie',
      }).success,
    ).toBe(true);
  });

  it('raison obligatoire (min 3 chars)', () => {
    expect(
      transfererProjetSchema.safeParse({
        fromUserId: userId,
        toUserId: userId2,
        projet_code: 'PROJ_A14',
        raison: '',
      }).success,
    ).toBe(false);
  });

  it('raison trop longue rejetée', () => {
    expect(
      transfererProjetSchema.safeParse({
        fromUserId: userId,
        toUserId: userId2,
        projet_code: 'PROJ_A14',
        raison: 'x'.repeat(600),
      }).success,
    ).toBe(false);
  });
});

describe('changerProjetStructureSchema', () => {
  it('accepte un payload valide', () => {
    expect(
      changerProjetStructureSchema.safeParse({
        structureId,
        nouveauProjetCode: 'PROJ_A14',
        motif: 'fin de financement A1',
      }).success,
    ).toBe(true);
  });

  it('motif obligatoire (min 3 chars)', () => {
    expect(
      changerProjetStructureSchema.safeParse({
        structureId,
        nouveauProjetCode: 'PROJ_A14',
        motif: '',
      }).success,
    ).toBe(false);
  });

  it('rejette structureId non UUID', () => {
    expect(
      changerProjetStructureSchema.safeParse({
        structureId: 'pas-uuid',
        nouveauProjetCode: 'PROJ_A14',
        motif: 'changement',
      }).success,
    ).toBe(false);
  });
});

describe('ROLES_DANS_PROJET', () => {
  it('expose 2 rôles', () => {
    expect(ROLES_DANS_PROJET).toEqual(['gestionnaire_principal', 'co_gestionnaire']);
  });

  it('libellés français présents pour chaque rôle', () => {
    for (const r of ROLES_DANS_PROJET) {
      expect(ROLE_DANS_PROJET_LIBELLES[r]).toBeTruthy();
    }
  });
});
