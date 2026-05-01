import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';
import { EMPTY_COUNTS } from '../import';

const EXISTING = {
  ...EMPTY_COUNTS,
  observations: 3,
  labReports: 1,
  labValues: 12,
  supplements: 2,
};

const PARSED = {
  ...EMPTY_COUNTS,
  observations: 5,
  labReports: 2,
  labValues: 8,
  supplements: 1,
};

describe('ConfirmDialog (IM-05 Option B)', () => {
  it('renders heading + target name', () => {
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="Mein Profil"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /Import in bestehendes Profil/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/"Mein Profil"/)).toBeInTheDocument();
  });

  it('renders one row per type with non-zero existing or parsed; hides zero-zero types', () => {
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('confirm-row-observations')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-row-labData')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-row-supplements')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-row-openPoints')).toBeNull();
    expect(screen.queryByTestId('confirm-row-timelineEntries')).toBeNull();
    expect(screen.queryByTestId('confirm-row-profileVersions')).toBeNull();
  });

  it('renders three radios per row: replace, add, skip', () => {
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('confirm-row-observations-replace')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-row-observations-add')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-row-observations-skip')).toBeInTheDocument();
  });

  it('no default mode: confirm disabled until every visible row has a mode picked', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: /Übernehmen/i });
    expect(confirmBtn).toBeDisabled();

    await user.click(screen.getByTestId('confirm-row-observations-replace'));
    expect(confirmBtn).toBeDisabled();
    await user.click(screen.getByTestId('confirm-row-labData-replace'));
    expect(confirmBtn).toBeDisabled();
    await user.click(screen.getByTestId('confirm-row-supplements-replace'));
    expect(confirmBtn).toBeEnabled();
  });

  it('confirm passes the picked modes to onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="X"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('confirm-row-observations-add'));
    await user.click(screen.getByTestId('confirm-row-labData-replace'));
    await user.click(screen.getByTestId('confirm-row-supplements-skip'));
    await user.click(screen.getByRole('button', { name: /Übernehmen/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith({
      observations: 'add',
      labData: 'replace',
      supplements: 'skip',
    });
  });

  it('warning hint surfaces when any row is set to add; hidden otherwise', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('confirm-add-warning')).toBeNull();
    await user.click(screen.getByTestId('confirm-row-observations-replace'));
    expect(screen.queryByTestId('confirm-add-warning')).toBeNull();
    await user.click(screen.getByTestId('confirm-row-labData-add'));
    expect(screen.getByTestId('confirm-add-warning')).toBeInTheDocument();
    // Toggling labData away from add hides the warning again.
    await user.click(screen.getByTestId('confirm-row-labData-replace'));
    expect(screen.queryByTestId('confirm-add-warning')).toBeNull();
  });

  it('replace radio disabled when existing is zero (nothing to replace)', () => {
    render(
      <ConfirmDialog
        existingCounts={{ ...EMPTY_COUNTS, observations: 0 }}
        parsedCounts={{ ...EMPTY_COUNTS, observations: 4 }}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('confirm-row-observations-replace')).toBeDisabled();
    expect(screen.getByTestId('confirm-row-observations-add')).toBeEnabled();
    expect(screen.getByTestId('confirm-row-observations-skip')).toBeEnabled();
  });

  it('add radio disabled when parsed is zero (nothing to add)', () => {
    render(
      <ConfirmDialog
        existingCounts={{ ...EMPTY_COUNTS, observations: 4 }}
        parsedCounts={{ ...EMPTY_COUNTS }}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('confirm-row-observations-replace')).toBeEnabled();
    expect(screen.getByTestId('confirm-row-observations-add')).toBeDisabled();
    expect(screen.getByTestId('confirm-row-observations-skip')).toBeEnabled();
  });

  it('cancel button calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Escape key cancels', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('dialog has aria-modal + aria-labelledby (destructive variant via O-20 primitive)', () => {
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledby = dialog.getAttribute('aria-labelledby');
    if (!labelledby) throw new Error('aria-labelledby missing on dialog');
    const heading = document.getElementById(labelledby);
    expect(heading?.textContent).toMatch(/Import in bestehendes Profil/i);
  });

  it('renders all six rows when every type is non-empty (P-01 Q5: 360 px fit invariants)', () => {
    const ALL_EXISTING = {
      observations: 99,
      labReports: 99,
      labValues: 999,
      supplements: 99,
      openPoints: 99,
      timelineEntries: 99,
      profileVersions: 99,
    };
    const ALL_PARSED = {
      observations: 50,
      labReports: 50,
      labValues: 500,
      supplements: 50,
      openPoints: 50,
      timelineEntries: 50,
      profileVersions: 50,
    };
    const { container } = render(
      <ConfirmDialog
        existingCounts={ALL_EXISTING}
        parsedCounts={ALL_PARSED}
        targetProfileName="Sehr-langer-Profilname-der-nicht-umbrechen-soll"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('radiogroup')).toHaveLength(6);
    const dialogShell = screen.getByRole('alertdialog');
    const cls = dialogShell.className;
    expect(cls).toContain('w-full');
    expect(cls).toContain('max-w-md');
    expect(cls).not.toMatch(/\bw-\[\d+px\]/);
    container.querySelectorAll('label').forEach((label) => {
      expect(label.className).not.toContain('whitespace-nowrap');
    });
  });

  it('focuses the cancel button on mount', () => {
    render(
      <ConfirmDialog
        existingCounts={EXISTING}
        parsedCounts={PARSED}
        targetProfileName="X"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
  });
});
