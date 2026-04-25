import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupplementCard } from './SupplementCard';
import type { UseSupplementFormResult } from './useSupplementForm';
import { makeSupplement } from './test-helpers';

function makeFormStub(overrides: Partial<UseSupplementFormResult> = {}): UseSupplementFormResult {
  return {
    state: { kind: 'closed' },
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    openDelete: vi.fn(),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    confirmDelete: vi.fn(async () => {}),
    close: vi.fn(),
    ...overrides,
  };
}

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

  it('omits action cluster when no form prop is supplied (read-only mode)', () => {
    render(<SupplementCard supplement={makeSupplement()} />);
    expect(screen.queryByTestId('supplement-actions')).toBeNull();
  });

  it('renders action cluster when form prop is supplied', () => {
    render(<SupplementCard supplement={makeSupplement()} form={makeFormStub()} />);
    expect(screen.getByTestId('supplement-actions')).toBeInTheDocument();
  });

  it('clicking edit action opens form in edit mode for the supplement', async () => {
    const user = userEvent.setup();
    const openEdit = vi.fn();
    const supplement = makeSupplement({ id: 's-edit' });
    render(<SupplementCard supplement={supplement} form={makeFormStub({ openEdit })} />);
    await user.click(screen.getByTestId('supplement-edit-btn-s-edit'));
    expect(openEdit).toHaveBeenCalledWith(supplement);
  });

  it('clicking delete action opens form in delete mode for the supplement', async () => {
    const user = userEvent.setup();
    const openDelete = vi.fn();
    const supplement = makeSupplement({ id: 's-del' });
    render(<SupplementCard supplement={supplement} form={makeFormStub({ openDelete })} />);
    await user.click(screen.getByTestId('supplement-delete-btn-s-del'));
    expect(openDelete).toHaveBeenCalledWith(supplement);
  });
});
