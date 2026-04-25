import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StructureEmptyState } from '@/components/structures/structure-empty-state';

describe('StructureEmptyState', () => {
  it('variante base_vide + peutCreer : affiche le titre et le bouton de création', () => {
    render(<StructureEmptyState variante="base_vide" peutCreer />);
    expect(screen.getByText('Aucune structure pour le moment')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Créer une structure/i })).toHaveAttribute(
      'href',
      '/structures/nouveau',
    );
  });

  it('variante base_vide sans peutCreer : titre seul, pas de bouton', () => {
    render(<StructureEmptyState variante="base_vide" peutCreer={false} />);
    expect(screen.getByText('Aucune structure pour le moment')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/n[’']a encore été saisie/)).toBeInTheDocument();
  });

  it('variante aucun_resultat : message « ajustez les filtres »', () => {
    render(<StructureEmptyState variante="aucun_resultat" peutCreer />);
    expect(screen.getByText('Aucune structure correspondante')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('variante recherche_vide : message « vérifiez l’orthographe »', () => {
    render(<StructureEmptyState variante="recherche_vide" peutCreer />);
    expect(screen.getByText('Aucune structure trouvée')).toBeInTheDocument();
    expect(screen.getByText(/orthographe/)).toBeInTheDocument();
  });
});
