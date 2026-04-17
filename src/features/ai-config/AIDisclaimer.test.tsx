import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIDisclaimer } from './AIDisclaimer';

describe('AIDisclaimer', () => {
  it('renders all three disclaimer points', () => {
    render(<AIDisclaimer onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'KI-Assistent aktivieren' })).toBeInTheDocument();
    expect(screen.getByText(/Keine medizinische Beratung/i)).toBeInTheDocument();
    expect(screen.getByText(/Daten verlassen dein Geraet/i)).toBeInTheDocument();
    expect(screen.getByText(/Du kontrollierst den Zugang/i)).toBeInTheDocument();
  });

  it('confirm button calls onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<AIDisclaimer onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Verstanden, KI aktivieren/ }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancel button calls onCancel without confirming', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<AIDisclaimer onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape key cancels', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<AIDisclaimer onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('exposes aria-modal dialog role and focuses cancel by default', () => {
    render(<AIDisclaimer onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'ai-disclaimer-title');
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
  });
});
