import { describe, it, expect } from 'vitest';
import {
  templateInvitationCompte,
  templateResetMotPasse,
  templateInvitationEnquete,
} from '@/lib/email/templates';

describe('templateInvitationCompte', () => {
  const tpl = templateInvitationCompte({
    prenom: 'Awa',
    roleLibelle: 'Coordonnateur de projet',
    lienActivation: 'https://app.example.org/activer/abc123',
  });

  it('a un sujet en français', () => {
    expect(tpl.subject).toMatch(/Activation/);
    expect(tpl.subject).toMatch(/OIF Emploi Jeunes/);
  });

  it('a un HTML wrapper complet (doctype + lang fr)', () => {
    expect(tpl.html).toMatch(/<!doctype html>/i);
    expect(tpl.html).toMatch(/<html lang="fr">/);
    expect(tpl.html).toContain('Awa');
    expect(tpl.html).toContain('Coordonnateur de projet');
    expect(tpl.html).toContain('https://app.example.org/activer/abc123');
  });

  it('a une version texte alternative non vide', () => {
    expect(tpl.text.length).toBeGreaterThan(50);
    expect(tpl.text).toContain('Awa');
    expect(tpl.text).toContain('https://app.example.org/activer/abc123');
  });

  it('échappe les caractères HTML dans les variables (anti-XSS)', () => {
    const malicieux = templateInvitationCompte({
      prenom: '<script>alert(1)</script>',
      roleLibelle: 'Hacker',
      lienActivation: 'https://x.example/a',
    });
    expect(malicieux.html).not.toContain('<script>alert');
    expect(malicieux.html).toContain('&lt;script&gt;');
  });

  it('inclut le footer RGPD', () => {
    expect(tpl.html).toMatch(/RGPD/);
    expect(tpl.text).toMatch(/RGPD/);
  });
});

describe('templateResetMotPasse', () => {
  it('accepte le prénom et l’inclut', () => {
    const tpl = templateResetMotPasse({
      prenom: 'Carlos',
      lienReset: 'https://app.example.org/reset/abc',
    });
    expect(tpl.html).toContain('Carlos');
    expect(tpl.text).toContain('Carlos');
  });

  it('accepte un prénom vide (fallback générique)', () => {
    const tpl = templateResetMotPasse({ lienReset: 'https://x.example/r' });
    expect(tpl.html).toContain('utilisateur');
    expect(tpl.text).toContain('utilisateur');
  });

  it('mentionne la durée 1 heure', () => {
    const tpl = templateResetMotPasse({ lienReset: 'https://x.example/r' });
    expect(tpl.html).toMatch(/1 heure/);
    expect(tpl.text).toMatch(/1 heure/);
  });
});

describe('templateInvitationEnquete', () => {
  const tpl = templateInvitationEnquete({
    cibleLibelle: 'COOP AGRI SAHEL',
    nomProjet: 'PROFEFA',
    questionnaire: 'B',
    url: 'https://app.example.org/enquetes/public/abc',
    expireAt: new Date('2026-05-26T00:00:00Z'),
  });

  it('inclut le libellé cible', () => {
    expect(tpl.html).toContain('COOP AGRI SAHEL');
    expect(tpl.text).toContain('COOP AGRI SAHEL');
  });

  it('inclut le nom du projet quand fourni', () => {
    expect(tpl.html).toContain('PROFEFA');
    expect(tpl.text).toContain('PROFEFA');
  });

  it('omet le projet quand non fourni', () => {
    const tplSansProjet = templateInvitationEnquete({
      cibleLibelle: 'X',
      nomProjet: null,
      questionnaire: 'A',
      url: 'https://x.example/q',
      expireAt: new Date('2026-05-26T00:00:00Z'),
    });
    expect(tplSansProjet.html).not.toContain('PROFEFA');
    expect(tplSansProjet.html).not.toContain('(projet null)');
  });

  it('annonce une durée plus courte pour le questionnaire B', () => {
    expect(tpl.html).toMatch(/5 à 8/);
  });

  it('annonce 5 à 10 min pour le questionnaire A', () => {
    const tplA = templateInvitationEnquete({
      cibleLibelle: 'Awa',
      nomProjet: null,
      questionnaire: 'A',
      url: 'https://x.example/q',
      expireAt: new Date('2026-05-26T00:00:00Z'),
    });
    expect(tplA.html).toMatch(/5 à 10/);
  });

  it('inclut la date d’expiration au format français', () => {
    expect(tpl.html).toMatch(/26 mai 2026/);
  });
});

describe('Invariants templates', () => {
  it('tous les templates ont subject + html + text non vides', () => {
    const t1 = templateInvitationCompte({
      prenom: 'a',
      roleLibelle: 'b',
      lienActivation: 'https://c.example',
    });
    const t2 = templateResetMotPasse({ lienReset: 'https://c.example' });
    const t3 = templateInvitationEnquete({
      cibleLibelle: 'a',
      nomProjet: null,
      questionnaire: 'A',
      url: 'https://c.example',
      expireAt: new Date(),
    });
    for (const t of [t1, t2, t3]) {
      expect(t.subject.length).toBeGreaterThan(5);
      expect(t.html.length).toBeGreaterThan(200);
      expect(t.text.length).toBeGreaterThan(50);
    }
  });
});
