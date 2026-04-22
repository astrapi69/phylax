import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LabReportCard } from './LabReportCard';
import { makeLabReport, makeLabValue } from './test-helpers';

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
