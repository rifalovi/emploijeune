import { describe, it, expect } from 'vitest';
import { calculerAge, calculerTrancheAge } from '@/components/beneficiaires/tranche-age';

describe('calculerAge', () => {
  it('retourne 0 pour une naissance ce jour', () => {
    const today = new Date('2026-04-23');
    const naissance = new Date('2026-04-23');
    expect(calculerAge(naissance, today)).toBe(0);
  });

  it("retourne l'âge correct au jour de l'anniversaire", () => {
    const ref = new Date('2026-04-23');
    const naissance = new Date('2000-04-23');
    expect(calculerAge(naissance, ref)).toBe(26);
  });

  it("retrenche 1 an si l'anniversaire n'a pas encore eu lieu", () => {
    const ref = new Date('2026-04-22');
    const naissance = new Date('2000-04-23');
    expect(calculerAge(naissance, ref)).toBe(25);
  });

  it('gère le cas même mois, jour antérieur', () => {
    const ref = new Date('2026-04-10');
    const naissance = new Date('2000-04-23');
    expect(calculerAge(naissance, ref)).toBe(25);
  });

  it('gère la bascule en mois postérieur', () => {
    const ref = new Date('2026-05-01');
    const naissance = new Date('2000-04-23');
    expect(calculerAge(naissance, ref)).toBe(26);
  });
});

/**
 * Tranches officielles OIF (Questionnaire A V2 Q105) : 18-34, 35-60, +60.
 * Plateforme V1 ajoute : « Mineur (<18) » et « Non renseigné ».
 */
describe('calculerTrancheAge', () => {
  const ref = new Date('2026-04-23');

  // ===== Cas de bord : entrée invalide =====

  it('retourne « Non renseigné » si dateNaissance est null', () => {
    expect(calculerTrancheAge(null, ref)).toBe('Non renseigné');
  });

  it('retourne « Non renseigné » si dateNaissance est undefined', () => {
    expect(calculerTrancheAge(undefined, ref)).toBe('Non renseigné');
  });

  it('retourne « Non renseigné » si la date est invalide', () => {
    expect(calculerTrancheAge('pas-une-date', ref)).toBe('Non renseigné');
  });

  it('accepte une chaîne ISO', () => {
    // 2000-01-01 sur 2026-04-23 → 26 ans
    expect(calculerTrancheAge('2000-01-01', ref)).toBe('18-34 ans');
  });

  // ===== Tranche Mineur (<18) =====

  it('classe 0 an → Mineur', () => {
    const n = new Date('2026-01-01');
    expect(calculerTrancheAge(n, ref)).toBe('Mineur (<18)');
  });

  it('classe 17 ans → Mineur (borne sup)', () => {
    // 2009-04-01 sur 2026-04-23 → 17 ans et 22 jours
    const n = new Date('2009-04-01');
    expect(calculerTrancheAge(n, ref)).toBe('Mineur (<18)');
  });

  // ===== Tranche 18-34 ans =====

  it('classe 18 ans pile → 18-34 ans (borne inf)', () => {
    // 2008-04-23 sur 2026-04-23 → exactement 18 ans
    const n = new Date('2008-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('18-34 ans');
  });

  it('classe 30 ans → 18-34 ans', () => {
    const n = new Date('1996-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('18-34 ans');
  });

  it('classe 34 ans → 18-34 ans (borne sup)', () => {
    const n = new Date('1991-05-01');
    expect(calculerTrancheAge(n, ref)).toBe('18-34 ans');
  });

  // ===== Tranche 35-60 ans =====

  it('classe 35 ans pile → 35-60 ans (borne inf)', () => {
    const n = new Date('1991-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('35-60 ans');
  });

  it('classe 50 ans → 35-60 ans', () => {
    const n = new Date('1976-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('35-60 ans');
  });

  it('classe 60 ans → 35-60 ans (borne sup)', () => {
    const n = new Date('1966-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('35-60 ans');
  });

  // ===== Tranche +60 ans =====

  it('classe 61 ans → +60 ans', () => {
    const n = new Date('1965-04-01');
    expect(calculerTrancheAge(n, ref)).toBe('+60 ans');
  });

  it('classe 80 ans → +60 ans', () => {
    const n = new Date('1946-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('+60 ans');
  });
});
