import { describe, it, expect } from 'vitest';
import { formaterMontant } from '@/lib/utils/formater-montant';

/**
 * Les chaînes formatées par `Intl.NumberFormat('fr-FR', ...)` utilisent des
 * espaces insécables (U+00A0) et insécables étroits (U+202F) selon la
 * version du moteur (Node 18+ utilise NBSP étroit pour les séparateurs de
 * milliers et les espaces pré-symbole). On compare donc via `String.raw`
 * avec un helper qui neutralise les variantes d'espaces.
 */
function normaliserEspaces(s: string): string {
  return s.replace(/[\u00A0\u202F]/g, ' ');
}

describe('formaterMontant — devises courantes OIF', () => {
  it('formate un montant en EUR (devise par défaut)', () => {
    const formate = normaliserEspaces(formaterMontant(1500.5));
    expect(formate).toContain('1 500,50');
    expect(formate).toContain('€');
  });

  it('formate un montant en XOF (franc CFA BCEAO) sans décimales', () => {
    const formate = normaliserEspaces(formaterMontant(250000, 'XOF'));
    // XOF n'a pas de sous-unité → Intl affiche 250 000 sans virgule décimale
    expect(formate).toContain('250 000');
    expect(formate.toLowerCase()).toContain('cfa');
  });

  it('formate un montant en USD avec 2 décimales', () => {
    const formate = normaliserEspaces(formaterMontant(999.99, 'USD'));
    expect(formate).toContain('999,99');
    // Intl fr-FR peut rendre "999,99 $US" ou "999,99 US$" selon la version
    expect(formate.toLowerCase()).toContain('$');
  });

  it('formate un montant en MAD (dirham marocain)', () => {
    const formate = normaliserEspaces(formaterMontant(10000, 'MAD'));
    expect(formate).toContain('10 000');
  });

  it('formate un montant en HTG (gourde haïtienne)', () => {
    const formate = normaliserEspaces(formaterMontant(5000, 'HTG'));
    expect(formate).toContain('5 000');
  });
});

describe('formaterMontant — cas limites', () => {
  it('retourne chaîne vide si montant undefined', () => {
    expect(formaterMontant(undefined, 'EUR')).toBe('');
  });

  it('retourne chaîne vide si montant null', () => {
    expect(formaterMontant(null, 'EUR')).toBe('');
  });

  it('retourne chaîne vide si montant NaN', () => {
    expect(formaterMontant(Number.NaN, 'EUR')).toBe('');
  });

  it('formate zéro correctement', () => {
    const formate = normaliserEspaces(formaterMontant(0, 'EUR'));
    expect(formate).toContain('0,00');
    expect(formate).toContain('€');
  });

  it('formate un grand montant avec séparateurs de milliers', () => {
    const formate = normaliserEspaces(formaterMontant(1234567.89, 'EUR'));
    expect(formate).toContain('1 234 567,89');
  });

  it('gère la devise spéciale « Autre » : montant numérique sans symbole', () => {
    const formate = normaliserEspaces(formaterMontant(1500, 'Autre'));
    expect(formate).toContain('1 500');
    // Pas de symbole monétaire pour la devise libre
    expect(formate).not.toContain('€');
    expect(formate).not.toContain('$');
  });

  it('gère devise null → formatage numérique brut', () => {
    const formate = normaliserEspaces(formaterMontant(1500, null));
    expect(formate).toContain('1 500');
  });
});
