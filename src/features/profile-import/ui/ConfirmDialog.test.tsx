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
  it('renders the heading and target name', () => {
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
  });

  it('renders one toggle per type with count > 0 and none for zeros', () => {
    render(
      <ConfirmDialog
        existingCounts={NON_EMPTY_COUNTS}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: /3 Beobachtungen ersetzen/i })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /1 Laborbefund \(12 Werte\) ersetzen/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /2 Supplemente ersetzen/i })).toBeInTheDocument();
    // No toggles for the zero-count types.
    expect(screen.queryByRole('checkbox', { name: /offen/i })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Verlaufsnotiz/i })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Profilversion/i })).toBeNull();
  });

  it('all visible toggles default to checked (legacy replace-all default)', () => {
    render(
      <ConfirmDialog
        existingCounts={NON_EMPTY_COUNTS}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: /Beobachtungen/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Laborbefund/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Supplemente/i })).toBeChecked();
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

  it('confirm button passes the default selection map to onConfirm', async () => {
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
    expect(onConfirm).toHaveBeenCalledWith({
      observations: true,
      labData: true,
      supplements: true,
      openPoints: false,
      timelineEntries: false,
      profileVersions: false,
    });
  });

  it('unchecking a toggle propagates to the onConfirm payload', async () => {
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
    await user.click(screen.getByRole('checkbox', { name: /Supplemente/i }));
    await user.click(screen.getByRole('button', { name: 'Ja, ersetzen' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        observations: true,
        labData: true,
        supplements: false,
      }),
    );
  });

  it('confirm button is disabled when every toggle is off', async () => {
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
    await user.click(screen.getByRole('checkbox', { name: /Beobachtungen/i }));
    await user.click(screen.getByRole('checkbox', { name: /Laborbefund/i }));
    await user.click(screen.getByRole('checkbox', { name: /Supplemente/i }));
    const confirmBtn = screen.getByRole('button', { name: 'Ja, ersetzen' });
    expect(confirmBtn).toBeDisabled();
    await user.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();
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
