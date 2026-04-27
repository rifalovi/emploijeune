import { describe, it, expect } from 'vitest';
import {
  indicateursOifSchema,
  PERIODES,
  PERIODE_LIBELLES,
  TAUX_FCFA_PAR_EUR,
  convertirEur,
  formaterMontant,
} from '@/lib/kpis/indicateurs-oif';

const payloadValide = {
  role: 'admin_scs' as const,
  periode: '30j' as const,
  scope: 'global' as const,
  indicateurs: {
    A1: { libelle: 'Jeunes formés', valeur: 1234, femmes: 600, hommes: 634 },
    A4: { libelle: 'Gain de compétences', valeur: null, proxy: 'Phase 2 — D2' },
    B1: { libelle: 'Activités économiques', valeur: 89 },
    B4: { libelle: 'Emplois indirects', valeur: 234, mention: 'Estimation' },
    F1: { libelle: 'Apport du français', valeur: null, proxy: 'Phase 2 — D3' },
  },
  bar_projets: [{ code: 'PROJ_A14', libelle: 'Numérique', beneficiaires: 234 }],
  pie_programmes: [{ code: 'PS1', libelle: 'Langue', beneficiaires: 456 }],
};

describe('indicateursOifSchema', () => {
  it('accepte le payload complet', () => {
    expect(indicateursOifSchema.safeParse(payloadValide).success).toBe(true);
  });

  it('accepte indicateurs avec valeur null (proxies)', () => {
    const r = indicateursOifSchema.safeParse(payloadValide);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.indicateurs.A4.valeur).toBeNull();
      expect(r.data.indicateurs.F1.valeur).toBeNull();
    }
  });

  it('rejette une période invalide', () => {
    expect(indicateursOifSchema.safeParse({ ...payloadValide, periode: '6m' }).success).toBe(false);
  });

  it('rejette un rôle inconnu', () => {
    expect(indicateursOifSchema.safeParse({ ...payloadValide, role: 'super_admin' }).success).toBe(
      false,
    );
  });

  it('rejette un scope inconnu', () => {
    expect(indicateursOifSchema.safeParse({ ...payloadValide, scope: 'planete' }).success).toBe(
      false,
    );
  });

  it('accepte bar_projets et pie_programmes vides', () => {
    expect(
      indicateursOifSchema.safeParse({
        ...payloadValide,
        bar_projets: [],
        pie_programmes: [],
      }).success,
    ).toBe(true);
  });
});

describe('PERIODES + libellés', () => {
  it('expose 4 périodes', () => {
    expect(PERIODES).toEqual(['7j', '30j', '90j', 'all']);
  });

  it('chaque période a un libellé', () => {
    for (const p of PERIODES) {
      expect(PERIODE_LIBELLES[p]).toBeTruthy();
    }
  });
});

describe('Conversion devise EUR ↔ FCFA', () => {
  it('parité fixe BCEAO/BEAC à 655.957', () => {
    expect(TAUX_FCFA_PAR_EUR).toBe(655.957);
  });

  it('convertirEur identité en EUR', () => {
    expect(convertirEur(100, 'EUR')).toBe(100);
  });

  it('convertirEur applique le taux en FCFA', () => {
    expect(convertirEur(1, 'FCFA')).toBeCloseTo(655.957);
    expect(convertirEur(100, 'FCFA')).toBeCloseTo(65595.7);
  });

  it('formaterMontant EUR avec 2 décimales par défaut', () => {
    const s = formaterMontant(1234.5, 'EUR');
    expect(s).toMatch(/1\s?234,50/);
    expect(s).toMatch(/€/);
  });

  it('formaterMontant FCFA avec 0 décimale par défaut', () => {
    const s = formaterMontant(100, 'FCFA');
    expect(s).toMatch(/65\s?596|65\s?595/);
  });
});
