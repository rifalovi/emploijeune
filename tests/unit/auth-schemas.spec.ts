import { describe, it, expect } from 'vitest';
import {
  motDePasseSchema,
  connexionMotPasseSchema,
  connexionMagicLinkSchema,
  demanderResetSchema,
  changerMotPasseSchema,
} from '@/lib/schemas/auth';

describe('motDePasseSchema (politique V1)', () => {
  it('accepte un mot de passe conforme', () => {
    expect(motDePasseSchema.safeParse('Mali2026').success).toBe(true);
    expect(motDePasseSchema.safeParse('Bamako1!').success).toBe(true);
    expect(motDePasseSchema.safeParse('CarlosH123').success).toBe(true);
  });

  it('rejette si moins de 8 caractères', () => {
    const r = motDePasseSchema.safeParse('Ab1');
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/8 caractères/);
    }
  });

  it('rejette si pas de majuscule', () => {
    expect(motDePasseSchema.safeParse('mali2026').success).toBe(false);
  });

  it('rejette si pas de chiffre', () => {
    expect(motDePasseSchema.safeParse('MaliBamako').success).toBe(false);
  });

  it('rejette si plus de 72 caractères (limite bcrypt Supabase)', () => {
    const long = 'A1' + 'a'.repeat(80);
    expect(motDePasseSchema.safeParse(long).success).toBe(false);
  });

  it('accepte les caractères spéciaux mais ne les exige pas', () => {
    expect(motDePasseSchema.safeParse('Mali2026!@#').success).toBe(true);
    expect(motDePasseSchema.safeParse('Mali2026').success).toBe(true);
  });
});

describe('connexionMotPasseSchema', () => {
  it('accepte email + mdp non vide', () => {
    expect(
      connexionMotPasseSchema.safeParse({
        email: 'carlos@francophonie.org',
        motDePasse: 'whatever',
      }).success,
    ).toBe(true);
  });

  it('rejette email invalide', () => {
    expect(
      connexionMotPasseSchema.safeParse({ email: 'pas-un-email', motDePasse: 'x' }).success,
    ).toBe(false);
  });

  it('rejette mdp vide', () => {
    expect(
      connexionMotPasseSchema.safeParse({
        email: 'carlos@francophonie.org',
        motDePasse: '',
      }).success,
    ).toBe(false);
  });

  it('lowercase + trim sur l’email', () => {
    const r = connexionMotPasseSchema.parse({
      email: '  Carlos@Francophonie.ORG  ',
      motDePasse: 'x',
    });
    expect(r.email).toBe('carlos@francophonie.org');
  });

  it('ne valide PAS la politique mdp à la connexion (mdp existant peut ne pas la respecter)', () => {
    // Cas typique : un compte créé avant durcissement de la politique
    expect(
      connexionMotPasseSchema.safeParse({
        email: 'old@francophonie.org',
        motDePasse: 'abc', // 3 chars, pas conforme à motDePasseSchema
      }).success,
    ).toBe(true);
  });
});

describe('connexionMagicLinkSchema', () => {
  it('accepte un email valide', () => {
    expect(connexionMagicLinkSchema.safeParse({ email: 'a@b.fr' }).success).toBe(true);
  });

  it('rejette email invalide', () => {
    expect(connexionMagicLinkSchema.safeParse({ email: 'pas valid' }).success).toBe(false);
  });
});

describe('demanderResetSchema', () => {
  it('accepte un email valide', () => {
    expect(demanderResetSchema.safeParse({ email: 'reset@francophonie.org' }).success).toBe(true);
  });
});

describe('changerMotPasseSchema', () => {
  it('accepte mdp conforme + confirmation identique', () => {
    expect(
      changerMotPasseSchema.safeParse({
        nouveauMotPasse: 'Mali2026',
        confirmation: 'Mali2026',
      }).success,
    ).toBe(true);
  });

  it('rejette confirmation différente', () => {
    const r = changerMotPasseSchema.safeParse({
      nouveauMotPasse: 'Mali2026',
      confirmation: 'Mali2027',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'confirmation')).toBe(true);
    }
  });

  it('rejette mdp non conforme à la politique', () => {
    const r = changerMotPasseSchema.safeParse({
      nouveauMotPasse: 'court',
      confirmation: 'court',
    });
    expect(r.success).toBe(false);
  });

  it('rejette si confirmation conforme à la policy mais mdp différent', () => {
    expect(
      changerMotPasseSchema.safeParse({
        nouveauMotPasse: 'Mali2026',
        confirmation: 'Bamako1A',
      }).success,
    ).toBe(false);
  });
});
