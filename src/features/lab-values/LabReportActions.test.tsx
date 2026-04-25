import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { LabReportActions } from './LabReportActions';
import type { UseLabReportFormResult } from './useLabReportForm';
import { makeLabReport } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function makeForm(overrides: Partial<UseLabReportFormResult> = {}): UseLabReportFormResult {
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

describe('LabReportActions', () => {
  it('renders edit and delete buttons with localized labels', () => {
    const report = makeLabReport();
    render(<LabReportActions report={report} form={makeForm()} />);
    expect(screen.getByTestId('lab-report-edit-btn')).toHaveAccessibleName('Bearbeiten');
    expect(screen.getByTestId('lab-report-delete-btn')).toHaveAccessibleName('Löschen');
  });

  it('clicking edit opens the form in edit mode for the given report', async () => {
    const user = userEvent.setup();
    const openEdit = vi.fn();
    const report = makeLabReport();
    render(<LabReportActions report={report} form={makeForm({ openEdit })} />);
    await user.click(screen.getByTestId('lab-report-edit-btn'));
    expect(openEdit).toHaveBeenCalledWith(report);
  });

  it('clicking delete opens the form in delete mode for the given report', async () => {
    const user = userEvent.setup();
    const openDelete = vi.fn(async () => {});
    const report = makeLabReport();
    render(<LabReportActions report={report} form={makeForm({ openDelete })} />);
    await user.click(screen.getByTestId('lab-report-delete-btn'));
    expect(openDelete).toHaveBeenCalledWith(report);
  });

  it('action buttons satisfy 44x44 touch target (WCAG 2.5.5)', () => {
    const report = makeLabReport();
    render(<LabReportActions report={report} form={makeForm()} />);
    const edit = screen.getByTestId('lab-report-edit-btn');
    const del = screen.getByTestId('lab-report-delete-btn');
    expect(edit.className).toMatch(/min-h-\[44px\]/);
    expect(edit.className).toMatch(/min-w-\[44px\]/);
    expect(del.className).toMatch(/min-h-\[44px\]/);
    expect(del.className).toMatch(/min-w-\[44px\]/);
  });
});
