import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgeProjet } from '@/components/beneficiaires/badge-projet';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';

/**
 * Tests du composant BadgeProjet — validation visuelle et accessibilité.
 *
 * jsdom rend les couleurs en RGB : on teste donc la valeur RGB (126, 179, 1)
 * plutôt que le hex (#7EB301). L'important est que la couleur finale soit
 * bien celle du PS attendu — on teste la teinte exacte via RGB extraite.
 */

/**
 * Convertit #RRGGBB en "126, 179, 1" attendu dans les styles JSDOM.
 */
function hexToRgbTuple(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

describe('BadgeProjet', () => {
  describe('variant inline', () => {
    it('affiche le code projet et pas le libellé', () => {
      render(<BadgeProjet code="PROJ_A16a" libelle="D-CLIC" />);
      expect(screen.getByText('PROJ_A16a')).toBeInTheDocument();
      expect(screen.queryByText('D-CLIC')).not.toBeInTheDocument();
    });

    it('pose un aria-label incluant le libellé du PS pour PROJ_A16a', () => {
      render(<BadgeProjet code="PROJ_A16a" />);
      const badge = screen.getByLabelText(/Projet PROJ_A16a/);
      expect(badge).toBeInTheDocument();
      expect(badge.getAttribute('aria-label')).toContain(PROGRAMMES_STRATEGIQUES.PS3.libelle);
    });

    it('applique la couleur PS3 (vert #7EB301) pour PROJ_A16a', () => {
      const { container } = render(<BadgeProjet code="PROJ_A16a" />);
      const badge = container.querySelector('[aria-label]');
      expect(badge?.getAttribute('style')).toContain(
        hexToRgbTuple(PROGRAMMES_STRATEGIQUES.PS3.principale),
      );
    });

    it('applique la couleur PS1 (bleu cyan #0198E9) pour PROJ_A02', () => {
      const { container } = render(<BadgeProjet code="PROJ_A02" />);
      const badge = container.querySelector('[aria-label]');
      expect(badge?.getAttribute('style')).toContain(
        hexToRgbTuple(PROGRAMMES_STRATEGIQUES.PS1.principale),
      );
    });

    it('applique la couleur PS2 (violet #5D0073) pour PROJ_A10', () => {
      const { container } = render(<BadgeProjet code="PROJ_A10" />);
      const badge = container.querySelector('[aria-label]');
      expect(badge?.getAttribute('style')).toContain(
        hexToRgbTuple(PROGRAMMES_STRATEGIQUES.PS2.principale),
      );
    });

    it('fonctionne sans programme dérivable (code inconnu)', () => {
      render(<BadgeProjet code="PROJ_XX99" />);
      expect(screen.getByText('PROJ_XX99')).toBeInTheDocument();
    });
  });

  describe('variant full', () => {
    it('affiche code + libellé', () => {
      render(
        <BadgeProjet code="PROJ_A16a" libelle="D-CLIC : Formez-vous au numérique" variant="full" />,
      );
      expect(screen.getByText('PROJ_A16a')).toBeInTheDocument();
      expect(screen.getByText(/D-CLIC : Formez-vous au numérique/)).toBeInTheDocument();
    });

    it('omet le libellé si non fourni', () => {
      render(<BadgeProjet code="PROJ_A16a" variant="full" />);
      expect(screen.getByText('PROJ_A16a')).toBeInTheDocument();
    });
  });

  describe('prop programmeStrategique (source de vérité BDD)', () => {
    it('privilégie la prop explicite sur la déduction par code', () => {
      // On force PS2 même si le code est PROJ_A16a (qui serait PS3 par défaut)
      const { container } = render(<BadgeProjet code="PROJ_A16a" programmeStrategique="PS2" />);
      const badge = container.querySelector('[aria-label]');
      expect(badge?.getAttribute('style')).toContain(
        hexToRgbTuple(PROGRAMMES_STRATEGIQUES.PS2.principale),
      );
    });
  });
});
