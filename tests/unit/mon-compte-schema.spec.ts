import { describe, it, expect } from 'vitest';
import { changerMonMotPasseSchema } from '@/lib/utilisateurs/mon-compte';

describe('changerMonMotPasseSchema', () => {
  const valideBase = {
    motPasseActuel: 'AncienMdp1',
    nouveauMotPasse: 'NouveauMdp2',
    confirmation: 'NouveauMdp2',
  };

  it('accepte un payload valide', () => {
    expect(changerMonMotPasseSchema.safeParse(valideBase).success).toBe(true);
  });

  it('rejette mdp actuel vide', () => {
    expect(changerMonMotPasseSchema.safeParse({ ...valideBase, motPasseActuel: '' }).success).toBe(
      false,
    );
  });

  it('rejette nouveau mdp non conforme à la politique', () => {
    expect(
      changerMonMotPasseSchema.safeParse({
        ...valideBase,
        nouveauMotPasse: 'court',
        confirmation: 'court',
      }).success,
    ).toBe(false);
  });

  it('rejette confirmation différente du nouveau', () => {
    const r = changerMonMotPasseSchema.safeParse({
      ...valideBase,
      confirmation: 'AutreMdp123',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'confirmation')).toBe(true);
    }
  });

  it('rejette nouveau identique à l’actuel', () => {
    const r = changerMonMotPasseSchema.safeParse({
      motPasseActuel: 'MemeMdp123',
      nouveauMotPasse: 'MemeMdp123',
      confirmation: 'MemeMdp123',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'nouveauMotPasse')).toBe(true);
    }
  });
});
