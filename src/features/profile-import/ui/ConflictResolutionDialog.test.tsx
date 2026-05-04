import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../../i18n/config';
import { __resetScrollLockForTest } from '../../../ui';
import type { Observation, OpenPoint, Supplement } from '../../../domain';
import type { MergeConflictSet } from '../import/detectMergeConflicts';
import type { MergeMatch } from '../../../domain/import-merge';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';

beforeEach(async () => {
  __resetScrollLockForTest();
  if (i18n.language !== 'de') {
    await i18n.changeLanguage('de');
  }
});

const PROFILE_ID = 'p1';

function makeObservation(over: Partial<Observation> = {}): Observation {
  return {
    id: 'obs-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    theme: 'Linkes Knie',
    fact: 'mine fact',
    pattern: '',
    selfRegulation: '',
    status: 'Stabil',
    source: 'user',
    extraSections: {},
    ...over,
  };
}

function makeSupplement(over: Partial<Supplement> = {}): Supplement {
  return {
    id: 'sup-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    name: 'Vitamin D3',
    brand: 'Pure',
    category: 'daily',
    ...over,
  };
}

function makeOpenPoint(over: Partial<OpenPoint> = {}): OpenPoint {
  return {
    id: 'op-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    text: 'Wasser trinken',
    context: 'Blutabnahme',
    resolved: false,
    ...over,
  };
}

function makeObservationConflict(
  over: Partial<Observation> = {},
): Extract<MergeMatch<'observations'>, { outcome: 'conflict' }> {
  const existing = makeObservation(over);
  const parsed = makeObservation({ ...over, id: 'parsed-1', fact: 'theirs fact' });
  return {
    outcome: 'conflict',
    kind: 'observations',
    parsed,
    existing,
    diffs: [{ field: 'fact', mineValue: existing.fact, theirsValue: parsed.fact }],
  };
}

function makeSupplementConflict(): Extract<MergeMatch<'supplements'>, { outcome: 'conflict' }> {
  const existing = makeSupplement({ recommendation: '2000 IE/Tag' });
  const parsed = makeSupplement({
    id: 'sup-parsed-1',
    recommendation: '4000 IE/Tag',
  });
  return {
    outcome: 'conflict',
    kind: 'supplements',
    parsed,
    existing,
    diffs: [{ field: 'recommendation', mineValue: '2000 IE/Tag', theirsValue: '4000 IE/Tag' }],
  };
}

function makeOpenPointConflict(): Extract<MergeMatch<'openPoints'>, { outcome: 'conflict' }> {
  const existing = makeOpenPoint({ priority: 'Hoch' });
  const parsed = makeOpenPoint({ id: 'op-parsed-1', priority: 'Mittel' });
  return {
    outcome: 'conflict',
    kind: 'openPoints',
    parsed,
    existing,
    diffs: [{ field: 'priority', mineValue: 'Hoch', theirsValue: 'Mittel' }],
  };
}

function emptyConflictSet(over: Partial<MergeConflictSet> = {}): MergeConflictSet {
  return {
    observations: [],
    labReports: [],
    labValues: [],
    supplements: [],
    openPoints: [],
    profileVersions: [],
    timelineEntries: [],
    ...over,
  };
}

describe('ConflictResolutionDialog', () => {
  it('renders the heading + intro with target profile name + total conflict count', () => {
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [makeObservationConflict()] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('conflict-resolution-dialog-title')).toHaveTextContent(
      /Konflikte beim Zusammenführen/i,
    );
    expect(screen.getByText(/Mein Profil/)).toBeInTheDocument();
  });

  it('Q2 discipline: confirm disabled until every conflict has a pick', async () => {
    const user = userEvent.setup();
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({
          observations: [makeObservationConflict()],
          supplements: [makeSupplementConflict()],
        })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const confirm = screen.getByTestId('conflict-resolution-dialog-confirm');
    expect(confirm).toBeDisabled();

    // Pick mine on the first conflict (observations section is open
    // by default).
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-mine'));
    expect(confirm).toBeDisabled();

    // Expand supplements + pick theirs.
    await user.click(screen.getByTestId('conflict-resolution-section-toggle-supplements'));
    await user.click(screen.getByTestId('conflict-row-sup-existing-1-theirs'));
    expect(confirm).toBeEnabled();
  });

  it('Q2 discipline: no default radio preselection on any conflict', () => {
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [makeObservationConflict()] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const mine = screen.getByTestId('conflict-row-obs-existing-1-mine') as HTMLInputElement;
    const theirs = screen.getByTestId('conflict-row-obs-existing-1-theirs') as HTMLInputElement;
    expect(mine.checked).toBe(false);
    expect(theirs.checked).toBe(false);
  });

  it('field-by-field radio is enabled in Step 5b (functional, not disabled)', () => {
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [makeObservationConflict()] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const fbf = screen.getByTestId(
      'conflict-row-obs-existing-1-field-by-field',
    ) as HTMLInputElement;
    expect(fbf.disabled).toBe(false);
  });

  it('field-by-field opens the per-field expansion panel below the conflict', async () => {
    const user = userEvent.setup();
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [makeObservationConflict()] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('conflict-row-obs-existing-1-fbf-panel')).toBeNull();
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-by-field'));
    expect(screen.getByTestId('conflict-row-obs-existing-1-fbf-panel')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-row-obs-existing-1-fbf-fact')).toBeInTheDocument();
  });

  it('per-field gating: confirm disabled until every diff field has a per-field pick', async () => {
    const user = userEvent.setup();
    // Conflict with TWO differing fields so per-field gating is non-trivial.
    const existing = makeObservation({ fact: 'mine fact', status: 'mine-status' });
    const parsed = makeObservation({
      id: 'parsed-1',
      fact: 'theirs fact',
      status: 'theirs-status',
    });
    const conflict: Extract<MergeMatch<'observations'>, { outcome: 'conflict' }> = {
      outcome: 'conflict',
      kind: 'observations',
      parsed,
      existing,
      diffs: [
        { field: 'fact', mineValue: 'mine fact', theirsValue: 'theirs fact' },
        { field: 'status', mineValue: 'mine-status', theirsValue: 'theirs-status' },
      ],
    };
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [conflict] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const confirm = screen.getByTestId('conflict-resolution-dialog-confirm');
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-by-field'));
    expect(confirm).toBeDisabled();

    // Pick one of two fields -> still disabled.
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-fact-theirs'));
    expect(confirm).toBeDisabled();

    // Pick the second field -> resolved -> Confirm enables.
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-status-mine'));
    expect(confirm).toBeEnabled();
  });

  it('mode-switch from field-by-field to mine discards per-field picks (W1 lean)', async () => {
    const user = userEvent.setup();
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [makeObservationConflict()] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-by-field'));
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-fact-theirs'));
    // Switch to mine.
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-mine'));
    expect(screen.queryByTestId('conflict-row-obs-existing-1-fbf-panel')).toBeNull();
    // Re-enter field-by-field -> per-field map empty.
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-by-field'));
    const factTheirs = screen.getByTestId(
      'conflict-row-obs-existing-1-field-fact-theirs',
    ) as HTMLInputElement;
    expect(factTheirs.checked).toBe(false);
  });

  it('field-by-field submit produces ConflictResolution with fieldChoices in the payload', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const existing = makeObservation({ fact: 'mine fact', status: 'mine-status' });
    const parsed = makeObservation({
      id: 'parsed-1',
      fact: 'theirs fact',
      status: 'theirs-status',
    });
    const conflict: Extract<MergeMatch<'observations'>, { outcome: 'conflict' }> = {
      outcome: 'conflict',
      kind: 'observations',
      parsed,
      existing,
      diffs: [
        { field: 'fact', mineValue: 'mine fact', theirsValue: 'theirs fact' },
        { field: 'status', mineValue: 'mine-status', theirsValue: 'theirs-status' },
      ],
    };
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [conflict] })}
        targetProfileName="Mein Profil"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-by-field'));
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-fact-theirs'));
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-status-mine'));
    await user.click(screen.getByTestId('conflict-resolution-dialog-confirm'));

    expect(onSubmit).toHaveBeenCalledWith({
      observations: {
        'obs-existing-1': {
          kind: 'field-by-field',
          fieldChoices: { fact: 'theirs', status: 'mine' },
        },
      },
    });
  });

  it('value rendering: mine + theirs values shown in field-by-field expansion', async () => {
    const user = userEvent.setup();
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [makeObservationConflict()] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-by-field'));
    expect(
      screen.getByTestId('conflict-row-obs-existing-1-field-fact-mine-value'),
    ).toHaveTextContent('mine fact');
    expect(
      screen.getByTestId('conflict-row-obs-existing-1-field-fact-theirs-value'),
    ).toHaveTextContent('theirs fact');
  });

  it('long values truncate with click-to-expand toggle', async () => {
    const user = userEvent.setup();
    const existing = makeObservation({
      fact: 'A'.repeat(200),
    });
    const parsed = makeObservation({
      id: 'parsed-1',
      fact: 'B'.repeat(200),
    });
    const conflict: Extract<MergeMatch<'observations'>, { outcome: 'conflict' }> = {
      outcome: 'conflict',
      kind: 'observations',
      parsed,
      existing,
      diffs: [{ field: 'fact', mineValue: existing.fact, theirsValue: parsed.fact }],
    };
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [conflict] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-by-field'));
    const cell = screen.getByTestId('conflict-row-obs-existing-1-field-fact-mine-value');
    // Truncated (ellipsis present).
    expect(cell.textContent).toMatch(/…$/);
    // Toggle expands.
    await user.click(
      screen.getByTestId('conflict-row-obs-existing-1-field-fact-mine-value-toggle'),
    );
    expect(cell.textContent).not.toMatch(/…$/);
  });

  it('value rendering edge cases: undefined/null/empty render as em-dash, boolean as ✓/✗', async () => {
    const user = userEvent.setup();
    const existing = makeObservation({ fact: '', status: 'old-status' });
    const parsed = makeObservation({
      id: 'parsed-1',
      fact: 'theirs fact',
      status: '',
    });
    // The renderer is type-erased on field value (it accepts unknown).
    // Cast through unknown so the test can include boolean / undefined
    // values without manufacturing extra fields on Observation.
    const conflict = {
      outcome: 'conflict',
      kind: 'observations',
      parsed,
      existing,
      diffs: [
        { field: 'fact', mineValue: '', theirsValue: 'theirs fact' },
        { field: 'status', mineValue: 'old-status', theirsValue: '' },
        { field: 'undef', mineValue: undefined, theirsValue: 'present' },
        { field: 'bool', mineValue: true, theirsValue: false },
      ],
    } as unknown as Extract<MergeMatch<'observations'>, { outcome: 'conflict' }>;
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [conflict] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-field-by-field'));
    // Empty -> em-dash.
    expect(
      screen.getByTestId('conflict-row-obs-existing-1-field-fact-mine-value'),
    ).toHaveTextContent('—');
    expect(
      screen.getByTestId('conflict-row-obs-existing-1-field-status-theirs-value'),
    ).toHaveTextContent('—');
    // Undefined -> em-dash.
    expect(
      screen.getByTestId('conflict-row-obs-existing-1-field-undef-mine-value'),
    ).toHaveTextContent('—');
    // Boolean -> ✓ / ✗.
    expect(
      screen.getByTestId('conflict-row-obs-existing-1-field-bool-mine-value'),
    ).toHaveTextContent('✓');
    expect(
      screen.getByTestId('conflict-row-obs-existing-1-field-bool-theirs-value'),
    ).toHaveTextContent('✗');
  });

  it('progress counter reflects resolved-of-total picks', async () => {
    const user = userEvent.setup();
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({
          observations: [makeObservationConflict()],
          supplements: [makeSupplementConflict()],
        })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const progress = screen.getByTestId('conflict-resolution-dialog-progress');
    expect(progress.textContent).toMatch(/0 von 2/);
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-mine'));
    expect(progress.textContent).toMatch(/1 von 2/);
  });

  it('confirm submits the collected resolutions keyed by entity type + existing id', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({
          observations: [makeObservationConflict()],
          supplements: [makeSupplementConflict()],
        })}
        targetProfileName="Mein Profil"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('conflict-row-obs-existing-1-mine'));
    await user.click(screen.getByTestId('conflict-resolution-section-toggle-supplements'));
    await user.click(screen.getByTestId('conflict-row-sup-existing-1-theirs'));
    await user.click(screen.getByTestId('conflict-resolution-dialog-confirm'));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      observations: { 'obs-existing-1': { kind: 'mine' } },
      supplements: { 'sup-existing-1': { kind: 'theirs' } },
    });
  });

  it('cancel button calls onCancel', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [makeObservationConflict()] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByTestId('conflict-resolution-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('ESC key calls onCancel (closeOnEscape)', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [makeObservationConflict()] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders one section per entity type with non-zero conflicts; empty types are absent', () => {
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({
          observations: [makeObservationConflict()],
          openPoints: [makeOpenPointConflict()],
        })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('conflict-resolution-section-observations')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-resolution-section-openPoints')).toBeInTheDocument();
    expect(screen.queryByTestId('conflict-resolution-section-supplements')).toBeNull();
    expect(screen.queryByTestId('conflict-resolution-section-labReports')).toBeNull();
  });

  it('section toggle expands / collapses the row list', async () => {
    const user = userEvent.setup();
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({
          observations: [makeObservationConflict()],
          supplements: [makeSupplementConflict()],
        })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // observations expanded by default; supplements collapsed.
    expect(screen.getByTestId('conflict-resolution-section-toggle-observations')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByTestId('conflict-resolution-section-toggle-supplements')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByTestId('conflict-row-sup-existing-1-mine')).toBeNull();

    await user.click(screen.getByTestId('conflict-resolution-section-toggle-supplements'));
    expect(screen.getByTestId('conflict-resolution-section-toggle-supplements')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByTestId('conflict-row-sup-existing-1-mine')).toBeInTheDocument();
  });

  it('row label uses the natural-key extractor for the entity type (observations -> theme)', () => {
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({
          observations: [makeObservationConflict({ theme: 'Schulter' })],
        })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Identität:.*Schulter/)).toBeInTheDocument();
  });

  it('row diff-fields list mirrors the FieldDiff[] from the matcher', () => {
    render(
      <ConflictResolutionDialog
        conflicts={emptyConflictSet({ observations: [makeObservationConflict()] })}
        targetProfileName="Mein Profil"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Unterschiedliche Felder:.*fact/)).toBeInTheDocument();
  });
});
