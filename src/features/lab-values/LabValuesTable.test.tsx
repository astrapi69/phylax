import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LabValuesTable } from './LabValuesTable';
import { makeLabValue } from './test-helpers';

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
});
