import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupplementCard } from './SupplementCard';
import { makeSupplement } from './test-helpers';

describe('SupplementCard', () => {
  it('renders name and brand', () => {
    render(
      <SupplementCard
        supplement={makeSupplement({ name: 'Vitamin D3 2000 IE', brand: 'tetesept' })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Vitamin D3 2000 IE' })).toBeInTheDocument();
    expect(screen.getByText('tetesept')).toBeInTheDocument();
  });

  it('renders recommendation when present', () => {
    render(
      <SupplementCard supplement={makeSupplement({ recommendation: 'Morgens mit Fruehstueck' })} />,
    );
    expect(screen.getByText(/Morgens mit Fruehstueck/)).toBeInTheDocument();
    expect(screen.getByText(/Empfehlung:/)).toBeInTheDocument();
  });

  it('renders rationale when present', () => {
    render(
      <SupplementCard supplement={makeSupplement({ rationale: 'Empfohlen nach Bluttest' })} />,
    );
    expect(screen.getByText(/Empfohlen nach Bluttest/)).toBeInTheDocument();
    expect(screen.getByText(/Begründung:/)).toBeInTheDocument();
  });

  it('hides recommendation and rationale lines when absent', () => {
    render(<SupplementCard supplement={makeSupplement()} />);
    expect(screen.queryByText(/Empfehlung:/)).toBeNull();
    expect(screen.queryByText(/Begründung:/)).toBeNull();
  });

  it('applies muted styling and shows Pausiert badge when muted', () => {
    const { container } = render(
      <SupplementCard supplement={makeSupplement({ category: 'paused' })} muted />,
    );
    expect(screen.getByText('Pausiert')).toBeInTheDocument();
    const card = container.firstChild as HTMLElement;
    // Muted variant uses a gray background tint (not white)
    expect(card.className).toMatch(/bg-gray-50/);
  });
});
