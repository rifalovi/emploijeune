import { describe, it, expect } from 'vitest';
import {
  anonymiserBeneficiaire,
  anonymiserTexte,
  SYSTEM_PROMPT_INSTITUTIONNEL,
} from '@/lib/ia/anonymisation';

describe('anonymisation IA — V2.0.0', () => {
  describe('anonymiserBeneficiaire', () => {
    it('remplace prénom et nom par un token déterministe', () => {
      const out = anonymiserBeneficiaire(
        { prenom: 'Aïssatou', nom: 'Diop', courriel: 'aissatou@example.com' },
        4,
      );
      expect(out.prenom).toBe('Bénéficiaire #5');
      expect(out.nom).toBe('');
      expect(out.courriel).toBe('anonyme5@oif.local');
    });

    it('masque le téléphone si présent', () => {
      const out = anonymiserBeneficiaire(
        { prenom: 'X', nom: 'Y', telephone: '+221 77 123 4567' },
        0,
      );
      expect(out.telephone).toBe('+XX XX XX XX XX');
    });

    it('laisse les champs absents tels quels', () => {
      const out = anonymiserBeneficiaire({ prenom: 'X', nom: 'Y' }, 0);
      expect(out.courriel).toBeUndefined();
      expect(out.telephone).toBeUndefined();
    });
  });

  describe('anonymiserTexte', () => {
    it('remplace les emails', () => {
      const t = anonymiserTexte('Contact : carlos.h@example.com pour en savoir plus.');
      expect(t).not.toContain('carlos.h@example.com');
      expect(t).toContain('anonyme@oif.local');
    });

    it('masque les téléphones avec préfixe explicite', () => {
      const t = anonymiserTexte('Tél: +221 77 123 4567');
      expect(t).toContain('[masqué]');
    });

    it('tronque les UUID', () => {
      const t = anonymiserTexte("L'utilisateur d615b97c-ab2b-45eb-a2a9-3f377de906c8 est admin.");
      expect(t).toContain('d615b97c…');
      expect(t).not.toContain('d615b97c-ab2b-45eb-a2a9-3f377de906c8');
    });

    it('préserve les chiffres agrégats', () => {
      const t = anonymiserTexte('La cohorte 2025 compte 5 512 bénéficiaires (91 % de femmes).');
      expect(t).toContain('5 512');
      expect(t).toContain('91');
      expect(t).toContain('2025');
    });

    it('préserve les codes pays et projets', () => {
      const t = anonymiserTexte('PROJ_A14 au Sénégal (SN) — focus 2025.');
      expect(t).toContain('PROJ_A14');
      expect(t).toContain('Sénégal');
      expect(t).toContain('SN');
    });
  });

  describe('SYSTEM_PROMPT_INSTITUTIONNEL', () => {
    it('mentionne explicitement les 5 indicateurs OIF', () => {
      for (const code of ['A1', 'A4', 'B1', 'B4', 'F1']) {
        expect(SYSTEM_PROMPT_INSTITUTIONNEL).toContain(code);
      }
    });

    it('rappelle que les données ont été anonymisées', () => {
      expect(SYSTEM_PROMPT_INSTITUTIONNEL.toLowerCase()).toContain('anonymis');
    });

    it("interdit conseils personnels et jugements individuels", () => {
      expect(SYSTEM_PROMPT_INSTITUTIONNEL).toContain('aucun conseil personnel');
    });
  });
});
