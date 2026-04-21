import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';
import { EMPTY_COUNTS } from '../import';

const NON_EMPTY_COUNTS = {
  ...EMPTY_COUNTS,
  observations: 3,
  labReports: 1,
  labValues: 12,
  supplements: 2,
};

describe('ConfirmDialog', () => {
  it('renders the existing counts and target name', () => {
    render(
      <ConfirmDialog
        existingCounts={NON_EMPTY_COUNTS}
        targetProfileName="Mein Profil"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: /bestehende Daten ersetzen/i })).toBeInTheDocument();
    expect(screen.getByText(/"Mein Profil"/)).toBeInTheDocument();
    expect(screen.getByText(/3 Beobachtungen/)).toBeInTheDocument();
    expect(screen.getByText(/1 Laborbefund \(12 Werte\)/)).toBeInTheDocument();
  });

  it('cancel button calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        existingCounts={NON_EMPTY_COUNTS}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('confirm button calls onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        existingCounts={NON_EMPTY_COUNTS}
        targetProfileName="X"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Ja, ersetzen' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('Escape key cancels', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        existingCounts={NON_EMPTY_COUNTS}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('dialog has aria-modal and labelledby', () => {
    render(
      <ConfirmDialog
        existingCounts={NON_EMPTY_COUNTS}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-replace-title');
  });

  it('focuses the cancel button on mount', () => {
    render(
      <ConfirmDialog
        existingCounts={NON_EMPTY_COUNTS}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
  });
});
