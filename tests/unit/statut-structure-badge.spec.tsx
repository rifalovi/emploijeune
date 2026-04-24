import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatutStructureBadge } from '@/components/structures/statut-structure-badge';

describe('StatutStructureBadge', () => {
  it('affiche le libellé « Création »', () => {
    render(<StatutStructureBadge code="creation" />);
    expect(screen.getByText('Création')).toBeInTheDocument();
  });

  it('affiche le libellé « Renforcement »', () => {
    render(<StatutStructureBadge code="renforcement" />);
    expect(screen.getByText('Renforcement')).toBeInTheDocument();
  });

  it('affiche le libellé « Relance »', () => {
    render(<StatutStructureBadge code="relance" />);
    expect(screen.getByText('Relance')).toBeInTheDocument();
  });

  it('porte un aria-label explicite', () => {
    render(<StatutStructureBadge code="creation" />);
    expect(screen.getByLabelText('Statut structure : Création')).toBeInTheDocument();
  });
});
