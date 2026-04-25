import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LabReportCard } from './LabReportCard';
import type { UseLabReportFormResult } from './useLabReportForm';
import { makeLabReport, makeLabValue } from './test-helpers';

function makeFormStub(overrides: Partial<UseLabReportFormResult> = {}): UseLabReportFormResult {
  return {
    state: { kind: 'closed' },
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    openDelete: vi.fn(async () => {}),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    confirmDelete: vi.fn(async () => {}),
    close: vi.fn(),
    ...overrides,
  };
}

function makeValues(
  entries: Array<{ category: string; parameter: string }>,
): Map<string, import('../../domain').LabValue[]> {
  const map = new Map<string, import('../../domain').LabValue[]>();
  for (const e of entries) {
    const existing = map.get(e.category) ?? [];
    existing.push(
      makeLabValue({
        id: `lv-${e.parameter}`,
        category: e.category,
        parameter: e.parameter,
        result: '1.0',
      }),
    );
    map.set(e.category, existing);
  }
  return map;
}

describe('LabReportCard', () => {
  it('renders the report header with formatted date, lab, and doctor', () => {
    render(
      <LabReportCard
        report={makeLabReport({
          reportDate: '2026-02-27',
          labName: 'Synlab',
          doctorName: 'Dr. Beispiel',
        })}
        valuesByCategory={new Map()}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: /27\.02\.2026/ })).toBeInTheDocument();
    expect(screen.getByText('Synlab')).toBeInTheDocument();
    expect(screen.getByText('Dr. Beispiel')).toBeInTheDocument();
  });

  it('renders context note via MarkdownContent when present', () => {
    render(
      <LabReportCard
        report={makeLabReport({ contextNote: 'Routinekontrolle **wichtig**' })}
        valuesByCategory={new Map()}
      />,
    );
    expect(screen.getByText('wichtig')).toBeInTheDocument();
    expect(screen.getByText('wichtig').tagName.toLowerCase()).toBe('strong');
  });

  it('groups values by category with category headings', () => {
    const values = makeValues([
      { category: 'Blutbild', parameter: 'Hb' },
      { category: 'Nierenwerte', parameter: 'Kreatinin' },
    ]);
    render(<LabReportCard report={makeLabReport()} valuesByCategory={values} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Blutbild' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Nierenwerte' })).toBeInTheDocument();
  });

  it('renders category assessments via MarkdownContent', () => {
    const values = makeValues([{ category: 'Blutbild', parameter: 'Hb' }]);
    render(
      <LabReportCard
        report={makeLabReport({ categoryAssessments: { Blutbild: 'Alle Werte normal.' } })}
        valuesByCategory={values}
      />,
    );
    expect(screen.getByText('Alle Werte normal.')).toBeInTheDocument();
  });

  it('renders overall assessment', () => {
    render(
      <LabReportCard
        report={makeLabReport({ overallAssessment: 'Insgesamt unauffaellig.' })}
        valuesByCategory={new Map()}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Gesamteinschätzung' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Insgesamt unauffaellig.')).toBeInTheDocument();
  });

  it('omits action cluster when no form prop is supplied (read-only mode)', () => {
    render(<LabReportCard report={makeLabReport()} valuesByCategory={new Map()} />);
    expect(screen.queryByTestId('lab-report-actions')).toBeNull();
  });

  it('renders action cluster when form prop is supplied', () => {
    render(
      <LabReportCard report={makeLabReport()} valuesByCategory={new Map()} form={makeFormStub()} />,
    );
    expect(screen.getByTestId('lab-report-actions')).toBeInTheDocument();
  });

  it('clicking edit action opens form in edit mode for the report', async () => {
    const user = userEvent.setup();
    const openEdit = vi.fn();
    const report = makeLabReport({ id: 'lr-edit' });
    render(
      <LabReportCard
        report={report}
        valuesByCategory={new Map()}
        form={makeFormStub({ openEdit })}
      />,
    );
    await user.click(screen.getByTestId('lab-report-edit-btn'));
    expect(openEdit).toHaveBeenCalledWith(report);
  });

  it('renders no-values placeholder when valuesByCategory is empty', () => {
    const report = makeLabReport({ id: 'empty-report' });
    render(<LabReportCard report={report} valuesByCategory={new Map()} />);
    expect(screen.getByTestId('lab-report-empty-report-no-values')).toHaveTextContent(
      'Keine Werte erfasst.',
    );
  });

  it('omits no-values placeholder when values exist', () => {
    const values = makeValues([{ category: 'Blutbild', parameter: 'Hb' }]);
    const report = makeLabReport({ id: 'with-values' });
    render(<LabReportCard report={report} valuesByCategory={values} />);
    expect(screen.queryByTestId('lab-report-with-values-no-values')).toBeNull();
  });

  it('hides optional sections when not present', () => {
    render(
      <LabReportCard
        report={makeLabReport({
          contextNote: undefined,
          overallAssessment: undefined,
          relevanceNotes: undefined,
        })}
        valuesByCategory={new Map()}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Gesamteinschätzung' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Relevanz' })).toBeNull();
  });
});
