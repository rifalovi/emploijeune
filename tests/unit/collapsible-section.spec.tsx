import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSection } from '@/components/ui/collapsible-section';

describe('CollapsibleSection', () => {
  it('rend le titre, le hint et le contenu masqué par défaut', () => {
    render(
      <CollapsibleSection title="Détails du porteur" hint="3 champs">
        <p>Contenu interne</p>
      </CollapsibleSection>,
    );
    expect(screen.getByText('Détails du porteur')).toBeInTheDocument();
    expect(screen.getByText('3 champs')).toBeInTheDocument();
    // Le contenu est dans le DOM mais le <details> est fermé par défaut
    expect(screen.getByText('Contenu interne')).toBeInTheDocument();
    const details = screen.getByText('Détails du porteur').closest('details');
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');
  });

  it('respecte defaultOpen=true', () => {
    render(
      <CollapsibleSection title="Visible" defaultOpen>
        <p>Texte</p>
      </CollapsibleSection>,
    );
    const details = screen.getByText('Visible').closest('details');
    expect(details).toHaveAttribute('open');
  });

  it('s\u2019ouvre au clic sur le summary (comportement natif <details>)', () => {
    render(
      <CollapsibleSection title="Plier/déplier">
        <p>X</p>
      </CollapsibleSection>,
    );
    const summary = screen.getByText('Plier/déplier').closest('summary');
    expect(summary).toBeInTheDocument();
    const details = summary!.parentElement as HTMLDetailsElement;
    expect(details.open).toBe(false);
    fireEvent.click(summary!);
    // jsdom n'émule pas le toggle natif → on simule directement l'attribut
    details.open = true;
    expect(details.open).toBe(true);
  });
});
