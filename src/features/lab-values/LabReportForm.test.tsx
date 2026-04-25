import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { LabReportForm } from './LabReportForm';
import type { LabReportFormState, UseLabReportFormResult } from './useLabReportForm';
import { __resetScrollLockForTest } from '../../ui';
import { makeLabReport } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

function makeForm(overrides: Partial<UseLabReportFormResult> = {}): UseLabReportFormResult {
  const state: LabReportFormState = overrides.state ?? {
    kind: 'open',
    mode: { kind: 'create' },
    fields: {
      reportDate: '2026-04-15',
      labName: '',
      doctorName: '',
      reportNumber: '',
      contextNote: '',
      overallAssessment: '',
      relevanceNotes: '',
    },
    submitting: false,
    error: null,
  };
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

describe('LabReportForm', () => {
  it('renders nothing when state is closed', () => {
    const form = makeForm({ state: { kind: 'closed' } });
    const { container } = render(<LabReportForm form={form} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mode is delete (handled by LabReportDeleteDialog)', () => {
    const report = makeLabReport();
    const form = makeForm({
      state: {
        kind: 'open',
        mode: { kind: 'delete', report, valueCount: 0 },
        fields: {
          reportDate: '2026-02-15',
          labName: '',
          doctorName: '',
          reportNumber: '',
          contextNote: '',
          overallAssessment: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
      },
    });
    render(<LabReportForm form={form} />);
    expect(screen.queryByTestId('lab-report-form')).toBeNull();
  });

  it('renders create-mode title + prefilled today-ish reportDate', () => {
    const form = makeForm();
    render(<LabReportForm form={form} />);
    expect(screen.getByTestId('lab-report-form-title')).toHaveTextContent('Neuer Befund');
    expect(screen.getByTestId('lab-report-form-date')).toHaveValue('2026-04-15');
  });

  it('renders edit-mode title with prefilled fields', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: {
          kind: 'edit',
          report: makeLabReport({
            reportDate: '2026-03-15',
            labName: 'Synlab',
            doctorName: 'Dr. Mueller',
          }),
        },
        fields: {
          reportDate: '2026-03-15',
          labName: 'Synlab',
          doctorName: 'Dr. Mueller',
          reportNumber: '',
          contextNote: '',
          overallAssessment: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
      },
    });
    render(<LabReportForm form={form} />);
    expect(screen.getByTestId('lab-report-form-title')).toHaveTextContent('Befund bearbeiten');
    expect(screen.getByTestId('lab-report-form-date')).toHaveValue('2026-03-15');
    expect(screen.getByTestId('lab-report-form-lab')).toHaveValue('Synlab');
    expect(screen.getByTestId('lab-report-form-doctor')).toHaveValue('Dr. Mueller');
  });

  it('expands optional disclosure by default when editing report with optional data', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: {
          kind: 'edit',
          report: makeLabReport({
            reportDate: '2026-03-15',
            contextNote: 'Routinekontrolle',
          }),
        },
        fields: {
          reportDate: '2026-03-15',
          labName: '',
          doctorName: '',
          reportNumber: '',
          contextNote: 'Routinekontrolle',
          overallAssessment: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
      },
    });
    render(<LabReportForm form={form} />);
    expect(screen.getByTestId('lab-report-form-optional').hasAttribute('open')).toBe(true);
  });

  it('collapses optional disclosure by default in create mode', () => {
    const form = makeForm();
    render(<LabReportForm form={form} />);
    expect(screen.getByTestId('lab-report-form-optional').hasAttribute('open')).toBe(false);
  });

  it('disables submit when reportDate is empty', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: { kind: 'create' },
        fields: {
          reportDate: '',
          labName: '',
          doctorName: '',
          reportNumber: '',
          contextNote: '',
          overallAssessment: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
      },
    });
    render(<LabReportForm form={form} />);
    expect(screen.getByTestId('lab-report-form-submit')).toBeDisabled();
    expect(screen.getByTestId('lab-report-form-date-error')).toHaveTextContent(
      'Datum ist erforderlich',
    );
  });

  it('disables submit when reportDate is malformed', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: { kind: 'create' },
        fields: {
          reportDate: '15.02.2026',
          labName: '',
          doctorName: '',
          reportNumber: '',
          contextNote: '',
          overallAssessment: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: null,
      },
    });
    render(<LabReportForm form={form} />);
    expect(screen.getByTestId('lab-report-form-submit')).toBeDisabled();
  });

  it('enables submit when reportDate is valid ISO date', () => {
    const form = makeForm();
    render(<LabReportForm form={form} />);
    expect(screen.getByTestId('lab-report-form-submit')).not.toBeDisabled();
  });

  it('typing in lab field calls setField', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    const form = makeForm({ setField });
    render(<LabReportForm form={form} />);
    await user.type(screen.getByTestId('lab-report-form-lab'), 'X');
    expect(setField).toHaveBeenCalledWith('labName', 'X');
  });

  it('clicking submit calls form.submit', async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => {});
    const form = makeForm({ submit });
    render(<LabReportForm form={form} />);
    await user.click(screen.getByTestId('lab-report-form-submit'));
    expect(submit).toHaveBeenCalled();
  });

  it('clicking cancel calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const form = makeForm({ close });
    render(<LabReportForm form={form} />);
    await user.click(screen.getByTestId('lab-report-form-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows save-error banner when submit fails', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: { kind: 'create' },
        fields: {
          reportDate: '2026-04-15',
          labName: '',
          doctorName: '',
          reportNumber: '',
          contextNote: '',
          overallAssessment: '',
          relevanceNotes: '',
        },
        submitting: false,
        error: 'quota exceeded',
      },
    });
    render(<LabReportForm form={form} />);
    expect(screen.getByTestId('lab-report-form-error')).toHaveTextContent(/quota exceeded/);
  });

  it('shows busy label when submitting', () => {
    const form = makeForm({
      state: {
        kind: 'open',
        mode: { kind: 'create' },
        fields: {
          reportDate: '2026-04-15',
          labName: '',
          doctorName: '',
          reportNumber: '',
          contextNote: '',
          overallAssessment: '',
          relevanceNotes: '',
        },
        submitting: true,
        error: null,
      },
    });
    render(<LabReportForm form={form} />);
    expect(screen.getByTestId('lab-report-form-submit')).toHaveTextContent('Wird gespeichert...');
    expect(screen.getByTestId('lab-report-form-submit')).toBeDisabled();
    expect(screen.getByTestId('lab-report-form-cancel')).toBeDisabled();
  });
});
