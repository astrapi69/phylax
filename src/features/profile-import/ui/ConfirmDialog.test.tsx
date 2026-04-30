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

  it('renders all six toggles when every entity type is non-empty (P-01 Q5: 360px fit)', () => {
    // P-01 mobile-first sweep: the IM-05 dialog can show up to 6 toggles
    // (observations, labData, supplements, openPoints, timelineEntries,
    // profileVersions). On a 360px viewport the dialog's `max-w-md`
    // (28rem = 448px) clamps to the parent's content box (360 - 32px
    // outer p-4 padding = 328px). This test asserts the full-stack
    // payload renders without breaking the layout's structural rules:
    // dialog uses `w-full max-w-md` (no fixed pixel width that would
    // overflow), and every toggle row is a flex row with an inline
    // checkbox + wrapping label (no `whitespace-nowrap` that would
    // force horizontal scroll). Real-pixel "fits" is verified by the
    // Tier 1 Playwright spec; this guards against accidental fixed
    // widths or nowrap labels at the React level.
    const ALL_TYPES_COUNTS = {
      observations: 99,
      labReports: 99,
      labValues: 999,
      supplements: 99,
      openPoints: 99,
      timelineEntries: 99,
      profileVersions: 99,
    };
    const { container } = render(
      <ConfirmDialog
        existingCounts={ALL_TYPES_COUNTS}
        targetProfileName="Sehr-langer-Profilname-der-nicht-umbrechen-soll"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    const dialogShell = container.querySelector('[role="document"]');
    if (!dialogShell) throw new Error('dialog shell not found');
    const cls = dialogShell.className;
    expect(cls).toContain('w-full');
    expect(cls).toContain('max-w-md');
    // No fixed pixel width override that would defeat max-w-md clamp.
    expect(cls).not.toMatch(/\bw-\[\d+px\]/);
    // No whitespace-nowrap on toggle labels: long German plurals must wrap.
    container.querySelectorAll('label').forEach((label) => {
      expect(label.className).not.toContain('whitespace-nowrap');
    });
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
