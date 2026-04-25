import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LabValuesTable } from './LabValuesTable';
import type { UseLabValueFormResult } from './useLabValueForm';
import { makeLabValue } from './test-helpers';

function makeValueFormStub(overrides: Partial<UseLabValueFormResult> = {}): UseLabValueFormResult {
  return {
    state: { kind: 'closed' },
    openCreate: vi.fn(async () => {}),
    openEdit: vi.fn(async () => {}),
    openDelete: vi.fn(),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    confirmDelete: vi.fn(async () => {}),
    close: vi.fn(),
    ...overrides,
  };
}

describe('LabValuesTable', () => {
  it('renders table with column headers', () => {
    render(<LabValuesTable category="Blutbild" values={[makeLabValue()]} />);
    expect(screen.getByRole('columnheader', { name: 'Parameter' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ergebnis' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Einheit' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Referenz' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bewertung' })).toBeInTheDocument();
  });

  it('renders one row per value', () => {
    const values = [
      makeLabValue({ id: '1', parameter: 'Hb', result: '14.2' }),
      makeLabValue({ id: '2', parameter: 'Leukozyten', result: '6,04' }),
      makeLabValue({ id: '3', parameter: 'Thrombozyten', result: '244' }),
    ];
    render(<LabValuesTable category="Blutbild" values={values} />);
    const rows = screen.getAllByRole('row');
    // 1 header row + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it('displays non-numeric results verbatim', () => {
    render(
      <LabValuesTable
        category="Serologie"
        values={[makeLabValue({ parameter: 'HIV', result: 'negativ' })]}
      />,
    );
    expect(screen.getByText('negativ')).toBeInTheDocument();
  });

  it('shows dash for missing optional fields', () => {
    render(
      <LabValuesTable
        category="Blutbild"
        values={[
          makeLabValue({ unit: undefined, referenceRange: undefined, assessment: undefined }),
        ]}
      />,
    );
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('applies default styling for "normal" assessment', () => {
    render(
      <LabValuesTable category="Blutbild" values={[makeLabValue({ assessment: 'normal' })]} />,
    );
    const cell = screen.getByText('normal');
    expect(cell.className).not.toMatch(/amber/);
  });

  it('applies accent styling for "erhoht" assessment', () => {
    render(
      <LabValuesTable
        category="Blutbild"
        values={[makeLabValue({ assessment: 'leicht erhoht' })]}
      />,
    );
    const cell = screen.getByText('leicht erhoht');
    expect(cell.className).toMatch(/amber/);
  });

  it('applies accent styling for "erhöht" (Unicode umlaut) assessment', () => {
    render(
      <LabValuesTable category="Blutbild" values={[makeLabValue({ assessment: 'erhöht' })]} />,
    );
    expect(screen.getByText('erhöht').className).toMatch(/amber/);
  });

  it('applies accent styling for "erniedrigt" assessment', () => {
    render(
      <LabValuesTable category="Blutbild" values={[makeLabValue({ assessment: 'erniedrigt' })]} />,
    );
    expect(screen.getByText('erniedrigt').className).toMatch(/amber/);
  });

  it('applies destructive red styling for "kritisch" assessment (O-13)', () => {
    render(
      <LabValuesTable category="Blutbild" values={[makeLabValue({ assessment: 'kritisch' })]} />,
    );
    const cell = screen.getByText('kritisch');
    expect(cell.className).toMatch(/text-red-700/);
    expect(cell.className).toMatch(/dark:text-red-300/);
    expect(cell.className).toMatch(/font-medium/);
    expect(cell.className).not.toMatch(/amber/);
  });

  it('kritisch wins over erhöht when both terms appear (severity precedence)', () => {
    render(
      <LabValuesTable
        category="Blutbild"
        values={[makeLabValue({ assessment: 'KRITISCH erhöht' })]}
      />,
    );
    expect(screen.getByText('KRITISCH erhöht').className).toMatch(/text-red-700/);
  });

  it('falls through to neutral styling for unrecognized assessment values', () => {
    render(
      <LabValuesTable category="Blutbild" values={[makeLabValue({ assessment: 'unklar' })]} />,
    );
    const cell = screen.getByText('unklar');
    expect(cell.className).not.toMatch(/amber/);
    expect(cell.className).not.toMatch(/red/);
    expect(cell.className).toMatch(/text-gray-600/);
  });

  it('omits action column when no valueForm prop is supplied (read-only mode)', () => {
    render(<LabValuesTable category="Blutbild" values={[makeLabValue()]} />);
    expect(screen.queryByTestId('lab-value-actions')).toBeNull();
    // Header row should still have only 5 columns.
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(5);
  });

  it('renders action column with edit + delete per row when valueForm supplied', () => {
    const values = [
      makeLabValue({ id: 'v1', parameter: 'Hb' }),
      makeLabValue({ id: 'v2', parameter: 'Leukozyten' }),
    ];
    render(<LabValuesTable category="Blutbild" values={values} valueForm={makeValueFormStub()} />);
    expect(screen.getByTestId('lab-value-edit-btn-v1')).toBeInTheDocument();
    expect(screen.getByTestId('lab-value-delete-btn-v1')).toBeInTheDocument();
    expect(screen.getByTestId('lab-value-edit-btn-v2')).toBeInTheDocument();
    expect(screen.getByTestId('lab-value-delete-btn-v2')).toBeInTheDocument();
    // Header row gets a sixth column for actions.
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(6);
  });
});
