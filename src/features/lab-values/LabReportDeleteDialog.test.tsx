import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { LabReportDeleteDialog } from './LabReportDeleteDialog';
import type { LabReportFormState, UseLabReportFormResult } from './useLabReportForm';
import { __resetScrollLockForTest } from '../../ui';
import { makeLabReport } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(overrides: Partial<UseLabReportFormResult> = {}): UseLabReportFormResult {
  const state: LabReportFormState = overrides.state ?? { kind: 'closed' };
  return {
    state,
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

function deleteState(
  report = makeLabReport({ reportDate: '2026-03-15', labName: 'Synlab' }),
  valueCount = 12,
  extras: { submitting?: boolean; error?: string | null } = {},
): LabReportFormState {
  return {
    kind: 'open',
    mode: { kind: 'delete', report, valueCount },
    fields: {
      reportDate: report.reportDate,
      labName: report.labName ?? '',
      doctorName: '',
      reportNumber: '',
      contextNote: '',
      overallAssessment: '',
      relevanceNotes: '',
    },
    submitting: extras.submitting ?? false,
    error: extras.error ?? null,
  };
}

describe('LabReportDeleteDialog', () => {
  it('renders nothing when state is closed', () => {
    const form = makeForm({ state: { kind: 'closed' } });
    render(<LabReportDeleteDialog form={form} />);
    expect(screen.queryByTestId('lab-report-delete-dialog')).toBeNull();
  });

  it('renders date + lab + count when both lab and values present', () => {
    const form = makeForm({
      state: deleteState(makeLabReport({ reportDate: '2026-03-15', labName: 'Synlab' }), 12),
    });
    render(<LabReportDeleteDialog form={form} />);
    const message = screen.getByTestId('lab-report-delete-message');
    expect(message).toHaveTextContent('15.03.2026');
    expect(message).toHaveTextContent('Synlab');
    expect(message).toHaveTextContent('12');
  });

  it('renders date + lab without count when no values', () => {
    const form = makeForm({
      state: deleteState(makeLabReport({ reportDate: '2026-03-15', labName: 'Synlab' }), 0),
    });
    render(<LabReportDeleteDialog form={form} />);
    expect(screen.getByTestId('lab-report-delete-message')).toHaveTextContent('Synlab');
  });

  it('renders date + count when no lab name', () => {
    const form = makeForm({
      state: deleteState(makeLabReport({ reportDate: '2026-03-15', labName: undefined }), 5),
    });
    render(<LabReportDeleteDialog form={form} />);
    const message = screen.getByTestId('lab-report-delete-message');
    expect(message).toHaveTextContent('15.03.2026');
    expect(message).toHaveTextContent('5');
  });

  it('renders date-only when no lab and no values', () => {
    const form = makeForm({
      state: deleteState(makeLabReport({ reportDate: '2026-03-15', labName: undefined }), 0),
    });
    render(<LabReportDeleteDialog form={form} />);
    expect(screen.getByTestId('lab-report-delete-message')).toHaveTextContent('15.03.2026');
  });

  it('renders count-unknown wording when valueCount lookup failed', () => {
    const form = makeForm({
      state: deleteState(makeLabReport({ reportDate: '2026-03-15', labName: 'Synlab' }), -1),
    });
    render(<LabReportDeleteDialog form={form} />);
    expect(screen.getByTestId('lab-report-delete-message')).toHaveTextContent('Synlab');
  });

  it('uses singular plural form when valueCount is 1', () => {
    const form = makeForm({
      state: deleteState(makeLabReport({ reportDate: '2026-03-15', labName: 'Synlab' }), 1),
    });
    render(<LabReportDeleteDialog form={form} />);
    expect(screen.getByTestId('lab-report-delete-message')).toHaveTextContent(/1 Wert($|[^e])/);
  });

  it('clicking confirm calls form.confirmDelete', async () => {
    const user = userEvent.setup();
    const confirmDelete = vi.fn(async () => {});
    const form = makeForm({ state: deleteState(), confirmDelete });
    render(<LabReportDeleteDialog form={form} />);
    await user.click(screen.getByTestId('lab-report-delete-confirm'));
    expect(confirmDelete).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const form = makeForm({ state: deleteState(), close });
    render(<LabReportDeleteDialog form={form} />);
    await user.click(screen.getByTestId('lab-report-delete-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows delete error inline when set', () => {
    const form = makeForm({
      state: deleteState(undefined, 0, { error: 'crypto failure' }),
    });
    render(<LabReportDeleteDialog form={form} />);
    expect(screen.getByTestId('lab-report-delete-error')).toBeInTheDocument();
  });

  it('shows busy label when submitting', () => {
    const form = makeForm({
      state: deleteState(undefined, 0, { submitting: true }),
    });
    render(<LabReportDeleteDialog form={form} />);
    expect(screen.getByTestId('lab-report-delete-confirm')).toBeDisabled();
    expect(screen.getByTestId('lab-report-delete-cancel')).toBeDisabled();
    expect(screen.getByTestId('lab-report-delete-confirm')).toHaveTextContent(/Wird gelöscht/);
  });
});
