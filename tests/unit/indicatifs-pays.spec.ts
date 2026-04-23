import { describe, it, expect } from 'vitest';
import {
  INDICATIFS_PAYS,
  PAYS_PICKER_DEFAUT,
  appliquerIndicatif,
  emojiDrapeau,
} from '@/lib/data/indicatifs-pays';

describe('INDICATIFS_PAYS', () => {
  it('couvre les 61 pays de la nomenclature', () => {
    expect(Object.keys(INDICATIFS_PAYS)).toHaveLength(61);
  });

  it('a les indicatifs attendus pour les 5 pays du picker par défaut', () => {
    expect(INDICATIFS_PAYS.MLI?.indicatif).toBe('+223');
    expect(INDICATIFS_PAYS.BFA?.indicatif).toBe('+226');
    expect(INDICATIFS_PAYS.HTI?.indicatif).toBe('+509');
    expect(INDICATIFS_PAYS.KHM?.indicatif).toBe('+855');
    expect(INDICATIFS_PAYS.MDG?.indicatif).toBe('+261');
  });

  it('PAYS_PICKER_DEFAUT compte exactement 5 codes', () => {
    expect(PAYS_PICKER_DEFAUT).toHaveLength(5);
  });

  it('chaque entrée a les 4 champs requis', () => {
    for (const pays of Object.values(INDICATIFS_PAYS)) {
      expect(pays.code_iso).toMatch(/^[A-Z]{3}$/);
      expect(pays.code_iso2).toMatch(/^[A-Z]{2}$/);
      expect(pays.libelle.length).toBeGreaterThan(0);
      expect(pays.indicatif).toMatch(/^\+\d+$/);
    }
  });
});

describe('emojiDrapeau', () => {
  it('convertit FR → 🇫🇷', () => {
    expect(emojiDrapeau('FR')).toBe('🇫🇷');
  });

  it('convertit ML → 🇲🇱', () => {
    expect(emojiDrapeau('ML')).toBe('🇲🇱');
  });

  it('retourne chaîne vide pour un code trop court', () => {
    expect(emojiDrapeau('F')).toBe('');
  });

  it('retourne chaîne vide pour un code trop long', () => {
    expect(emojiDrapeau('FRA')).toBe('');
  });

  it('gère les codes en minuscules', () => {
    expect(emojiDrapeau('fr')).toBe('🇫🇷');
  });
});

describe('appliquerIndicatif', () => {
  it('ajoute l\u2019indicatif à une chaîne vide', () => {
    expect(appliquerIndicatif('', '+226')).toBe('+226');
  });

  it('remplace un indicatif existant', () => {
    expect(appliquerIndicatif('+22676123456', '+223')).toBe('+22376123456');
  });

  it('prépend l\u2019indicatif à une chaîne sans +', () => {
    expect(appliquerIndicatif('76123456', '+226')).toBe('+22676123456');
  });

  it('remplace un indicatif court (+33) par un long (+1246)', () => {
    expect(appliquerIndicatif('+33123456789', '+1246')).toBe('+1246123456789');
  });

  it('gère les espaces en début de chaîne (trim)', () => {
    expect(appliquerIndicatif('  +22676123456', '+223')).toBe('+22376123456');
  });

  it('détecte le plus long indicatif connu (Canada +1 vs Barbade +1246)', () => {
    // Clean commence par +1 (Canada) mais pas par +1246 (Barbade) — matching
    // par liste connue, pas par longueur fixe : on ne retire que +1.
    expect(appliquerIndicatif('+12345678', '+1758')).toBe('+17582345678');
  });

  it('remplace un indicatif à 4 chiffres connu', () => {
    // +1246 (Barbade) détecté, remplacé par +223 → +223 + ce qui suit
    expect(appliquerIndicatif('+1246123456', '+223')).toBe('+223123456');
  });

  it('heuristique : indicatif inconnu → fallback sur 1-4 digits', () => {
    expect(appliquerIndicatif('+9999876543', '+226')).toBe('+226876543');
  });
});
