import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../../i18n/config';
import { ClassificationConfirm } from './ClassificationConfirm';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

describe('ClassificationConfirm', () => {
  it('renders title plus interpolated confidence and type', () => {
    render(
      <ClassificationConfirm
        classification={{ type: 'doctor-letter', confidence: 0.62 }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('Dokumenttyp prüfen')).toBeInTheDocument();
    expect(screen.getByText(/0\.62/)).toBeInTheDocument();
    expect(screen.getByText(/doctor-letter/)).toBeInTheDocument();
  });

  it('falls back to ? when confidence is missing', () => {
    render(
      <ClassificationConfirm
        classification={{ type: 'lab-report' }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/\?/)).toBeInTheDocument();
  });

  it('focuses reject by default', () => {
    render(
      <ClassificationConfirm
        classification={{ type: 'lab-report', confidence: 0.5 }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nein, abbrechen' }));
  });

  it('calls onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ClassificationConfirm
        classification={{ type: 'lab-report', confidence: 0.5 }}
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Ja, fortfahren' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onReject', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    render(
      <ClassificationConfirm
        classification={{ type: 'lab-report', confidence: 0.5 }}
        onConfirm={vi.fn()}
        onReject={onReject}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Nein, abbrechen' }));
    expect(onReject).toHaveBeenCalledOnce();
  });
});
