import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import i18n from '../../../i18n/config';
import { ReviewPanel } from './ReviewPanel';
import type {
  ExtractedDrafts,
  LabValueDraft,
  ObservationDraft,
  OpenPointDraft,
  SupplementDraft,
} from '../drafts';
import type { DraftSelection } from '../commit';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function fullDrafts(): ExtractedDrafts {
  return {
    observations: [
      {
        theme: 'Schulter',
        fact: 'Schmerz beim Heben',
        pattern: 'Bei Belastung',
        selfRegulation: 'Krafttraining',
        status: 'in Besserung',
        source: 'ai',
        extraSections: {},
      },
    ],
    labValues: [
      {
        category: 'Blutbild',
        parameter: 'Haemoglobin',
        result: '14.2',
        unit: 'g/dl',
        referenceRange: '13.5-17.5',
        assessment: 'normal',
      },
    ],
    supplements: [
      {
        name: 'Vitamin D3 2000 IE',
        category: 'daily',
      },
    ],
    openPoints: [
      {
        text: 'Wiederholungs-Blutabnahme',
        context: 'In 3 Monaten',
        resolved: false,
      },
    ],
    labReportMeta: { reportDate: '2026-04-14', labName: 'Synlab MVZ' },
  };
}

interface HarnessProps {
  initialSelection: DraftSelection;
  onSelectionChange?: (s: DraftSelection) => void;
  onEditObservation?: (index: number, patch: Partial<ObservationDraft>) => void;
  onEditLabValue?: (index: number, patch: Partial<LabValueDraft>) => void;
  onEditSupplement?: (index: number, patch: Partial<SupplementDraft>) => void;
  onEditOpenPoint?: (index: number, patch: Partial<OpenPointDraft>) => void;
  drafts?: ExtractedDrafts;
}

function Harness({
  initialSelection,
  onSelectionChange,
  onEditObservation,
  onEditLabValue,
  onEditSupplement,
  onEditOpenPoint,
  drafts,
}: HarnessProps) {
  const [selection, setSelection] = useState<DraftSelection>(initialSelection);
  const [draftState, setDraftState] = useState<ExtractedDrafts>(() => drafts ?? fullDrafts());
  const noop = () => {};
  return (
    <ReviewPanel
      drafts={draftState}
      selection={selection}
      onSelectionChange={(s) => {
        setSelection(s);
        onSelectionChange?.(s);
      }}
      onEditObservation={(idx, patch) => {
        setDraftState((d) => ({
          ...d,
          observations: d.observations.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
        }));
        (onEditObservation ?? noop)(idx, patch);
      }}
      onEditLabValue={(idx, patch) => {
        setDraftState((d) => ({
          ...d,
          labValues: d.labValues.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
        }));
        (onEditLabValue ?? noop)(idx, patch);
      }}
      onEditSupplement={(idx, patch) => {
        setDraftState((d) => ({
          ...d,
          supplements: d.supplements.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
        }));
        (onEditSupplement ?? noop)(idx, patch);
      }}
      onEditOpenPoint={(idx, patch) => {
        setDraftState((d) => ({
          ...d,
          openPoints: d.openPoints.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
        }));
        (onEditOpenPoint ?? noop)(idx, patch);
      }}
    />
  );
}

const ALL_SELECTED: DraftSelection = {
  observations: [0],
  labValues: [0],
  supplements: [0],
  openPoints: [0],
};

describe('ReviewPanel', () => {
  it('renders one row per draft type with section count badge', () => {
    render(<Harness initialSelection={ALL_SELECTED} />);
    expect(screen.getByText('Beobachtungen')).toBeInTheDocument();
    expect(screen.getByText('Laborwerte')).toBeInTheDocument();
    expect(screen.getByText('Ergänzungen / Supplemente')).toBeInTheDocument();
    expect(screen.getByText('Offene Punkte')).toBeInTheDocument();
    expect(screen.getAllByTestId('observation-row')).toHaveLength(1);
    expect(screen.getAllByTestId('lab-value-row')).toHaveLength(1);
    expect(screen.getAllByTestId('supplement-row')).toHaveLength(1);
    expect(screen.getAllByTestId('open-point-row')).toHaveLength(1);
  });

  it('shows the lab-meta hint with extracted reportDate and labName', () => {
    render(<Harness initialSelection={ALL_SELECTED} />);
    const hint = screen.getByTestId('lab-meta-hint');
    expect(hint).toHaveTextContent('Synlab MVZ');
    expect(hint).toHaveTextContent('2026-04-14');
  });

  it('shows lab-meta hint without lab name when not extracted', () => {
    const drafts = fullDrafts();
    drafts.labReportMeta = { reportDate: '2026-04-14' };
    render(<Harness initialSelection={ALL_SELECTED} drafts={drafts} />);
    const hint = screen.getByTestId('lab-meta-hint');
    expect(hint).toHaveTextContent('2026-04-14');
    expect(hint.textContent).not.toContain('Synlab');
  });

  it('hides lab-meta hint when no lab values', () => {
    const drafts = fullDrafts();
    drafts.labValues = [];
    render(<Harness initialSelection={{ ...ALL_SELECTED, labValues: [] }} drafts={drafts} />);
    expect(screen.queryByTestId('lab-meta-hint')).toBeNull();
  });

  it('falls back to today ISO date in hint when meta has no reportDate', () => {
    const drafts = fullDrafts();
    drafts.labReportMeta = {};
    render(<Harness initialSelection={ALL_SELECTED} drafts={drafts} />);
    const hint = screen.getByTestId('lab-meta-hint');
    // Match YYYY-MM-DD format.
    expect(hint.textContent).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('toggles selection when checkbox clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialSelection={ALL_SELECTED} onSelectionChange={onChange} />);
    const obsRow = screen.getByTestId('observation-row');
    const checkbox = within(obsRow).getByRole('checkbox');
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({
      ...ALL_SELECTED,
      observations: [],
    });
  });

  it('reveals editor on Bearbeiten and hides on Fertig', async () => {
    const user = userEvent.setup();
    render(<Harness initialSelection={ALL_SELECTED} />);
    const obsRow = screen.getByTestId('observation-row');
    expect(within(obsRow).queryByText('Thema')).toBeNull();

    await user.click(within(obsRow).getByRole('button', { name: 'Bearbeiten' }));
    expect(within(obsRow).getByText('Thema')).toBeInTheDocument();

    await user.click(within(obsRow).getByRole('button', { name: 'Fertig' }));
    expect(within(obsRow).queryByText('Thema')).toBeNull();
  });

  it('forwards observation field edits', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Harness initialSelection={ALL_SELECTED} onEditObservation={onEdit} />);
    const obsRow = screen.getByTestId('observation-row');
    await user.click(within(obsRow).getByRole('button', { name: 'Bearbeiten' }));
    const themeInput = within(obsRow).getByDisplayValue('Schulter');
    await user.clear(themeInput);
    await user.type(themeInput, 'Knie');
    expect(onEdit).toHaveBeenLastCalledWith(0, expect.objectContaining({ theme: 'Knie' }));
  });

  it('renders supplement category as a select with all four options', async () => {
    const user = userEvent.setup();
    render(<Harness initialSelection={ALL_SELECTED} />);
    const suppRow = screen.getByTestId('supplement-row');
    await user.click(within(suppRow).getByRole('button', { name: 'Bearbeiten' }));
    const select = within(suppRow).getByRole('combobox');
    expect(within(select).getAllByRole('option')).toHaveLength(4);
  });

  it('forwards supplement category change as enum value', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Harness initialSelection={ALL_SELECTED} onEditSupplement={onEdit} />);
    const suppRow = screen.getByTestId('supplement-row');
    await user.click(within(suppRow).getByRole('button', { name: 'Bearbeiten' }));
    const select = within(suppRow).getByRole('combobox');
    await user.selectOptions(select, 'paused');
    expect(onEdit).toHaveBeenCalledWith(0, { category: 'paused' });
  });

  it('renders empty state per section when no drafts', () => {
    const drafts: ExtractedDrafts = {
      observations: [],
      labValues: [],
      supplements: [],
      openPoints: [],
      labReportMeta: {},
    };
    render(
      <Harness
        drafts={drafts}
        initialSelection={{ observations: [], labValues: [], supplements: [], openPoints: [] }}
      />,
    );
    const empties = screen.getAllByText('Keine Einträge dieses Typs gefunden.');
    expect(empties).toHaveLength(4);
  });
});
