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

describe('calculerTrancheAge', () => {
  const ref = new Date('2026-04-23');

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
    expect(calculerTrancheAge('2000-01-01', ref)).toBe('18-29 ans (cœur de cible)');
  });

  it('classe 15 ans → tranche mineur', () => {
    const n = new Date('2011-04-01');
    expect(calculerTrancheAge(n, ref)).toBe('15-17 ans (mineur)');
  });

  it('classe 17 ans → tranche mineur', () => {
    // 2009-04-01 sur 2026-04-23 : 17 ans et 22 jours
    const n = new Date('2009-04-01');
    expect(calculerTrancheAge(n, ref)).toBe('15-17 ans (mineur)');
  });

  it('classe 18 ans → cœur de cible', () => {
    const n = new Date('2008-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('18-29 ans (cœur de cible)');
  });

  it('classe 29 ans → cœur de cible', () => {
    const n = new Date('1996-05-01');
    expect(calculerTrancheAge(n, ref)).toBe('18-29 ans (cœur de cible)');
  });

  it('classe 30 ans → institutionnel élargi', () => {
    const n = new Date('1996-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('30-35 ans (institutionnel élargi)');
  });

  it('classe 35 ans → institutionnel élargi', () => {
    const n = new Date('1991-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('30-35 ans (institutionnel élargi)');
  });

  it('classe 14 ans → hors cible', () => {
    const n = new Date('2012-04-01');
    expect(calculerTrancheAge(n, ref)).toBe('Hors cible');
  });

  it('classe 36 ans → hors cible', () => {
    const n = new Date('1990-04-23');
    expect(calculerTrancheAge(n, ref)).toBe('Hors cible');
  });
});
