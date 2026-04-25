import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { ObservationDeleteDialog } from './ObservationDeleteDialog';
import type { UseObservationFormResult } from './useObservationForm';
import type { Observation } from '../../domain';
import { __resetScrollLockForTest } from '../../ui';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
});

const observation: Observation = {
  id: 'o1',
  profileId: 'p',
  createdAt: 0,
  updatedAt: 0,
  theme: 'Schulter',
  fact: 'Schmerz beim Heben',
  pattern: '',
  selfRegulation: '',
  status: '',
  source: 'user',
  extraSections: {},
};

function makeForm(
  observation?: Observation,
  opts: Partial<{ submitting: boolean; error: string | null }> = {},
): UseObservationFormResult {
  return {
    state: observation
      ? {
          kind: 'open',
          mode: { kind: 'delete', observation },
          fields: {
            theme: observation.theme,
            fact: observation.fact,
            pattern: observation.pattern,
            selfRegulation: observation.selfRegulation,
            status: observation.status,
            medicalFinding: '',
            relevanceNotes: '',
          },
          submitting: opts.submitting ?? false,
          error: opts.error ?? null,
          themes: [],
        }
      : { kind: 'closed' },
    openCreate: vi.fn(async () => {}),
    openEdit: vi.fn(async () => {}),
    openDelete: vi.fn(),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    confirmDelete: vi.fn(async () => {}),
    close: vi.fn(),
  };
}

describe('ObservationDeleteDialog', () => {
  it('renders nothing when state is closed', () => {
    render(<ObservationDeleteDialog form={makeForm()} />);
    expect(screen.queryByTestId('observation-delete-dialog')).toBeNull();
  });

  it('renders body-with-fact copy when fact is non-empty', () => {
    render(<ObservationDeleteDialog form={makeForm(observation)} />);
    const message = screen.getByTestId('observation-delete-message');
    expect(message.textContent).toMatch(/Schulter/);
    expect(message.textContent).toMatch(/Schmerz beim Heben/);
  });

  it('renders body (theme-only) copy when fact is empty', () => {
    render(<ObservationDeleteDialog form={makeForm({ ...observation, fact: '' })} />);
    const message = screen.getByTestId('observation-delete-message');
    expect(message.textContent).toMatch(/Schulter/);
    expect(message.textContent).not.toMatch(/Schmerz/);
  });

  it('strips Markdown formatting from fact preview', () => {
    render(
      <ObservationDeleteDialog
        form={makeForm({ ...observation, fact: '**bold** then `code` and [link](http://x)' })}
      />,
    );
    const message = screen.getByTestId('observation-delete-message');
    expect(message.textContent).not.toContain('**');
    expect(message.textContent).not.toContain('`');
    expect(message.textContent).toMatch(/bold then code and link/);
  });

  it('collapses newlines in fact preview to single spaces', () => {
    render(
      <ObservationDeleteDialog
        form={makeForm({ ...observation, fact: 'first line\n\nsecond line' })}
      />,
    );
    const message = screen.getByTestId('observation-delete-message');
    expect(message.textContent).toMatch(/first line second line/);
  });

  it('truncates long fact preview with ellipsis', () => {
    const longFact = 'a'.repeat(120);
    render(<ObservationDeleteDialog form={makeForm({ ...observation, fact: longFact })} />);
    const message = screen.getByTestId('observation-delete-message');
    expect(message.textContent).toContain('…');
    // Truncated text length within configured cap; the full long fact is not present.
    expect(message.textContent).not.toContain('a'.repeat(60));
  });

  it('confirm button calls form.confirmDelete', async () => {
    const user = userEvent.setup();
    const confirmDelete = vi.fn(async () => {});
    const form = { ...makeForm(observation), confirmDelete };
    render(<ObservationDeleteDialog form={form} />);
    await user.click(screen.getByTestId('observation-delete-confirm'));
    expect(confirmDelete).toHaveBeenCalled();
  });

  it('cancel button calls form.close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const form = { ...makeForm(observation), close };
    render(<ObservationDeleteDialog form={form} />);
    await user.click(screen.getByTestId('observation-delete-cancel'));
    expect(close).toHaveBeenCalled();
  });

  it('shows delete-error when error is set', () => {
    render(<ObservationDeleteDialog form={makeForm(observation, { error: 'crypto failure' })} />);
    expect(screen.getByTestId('observation-delete-error')).toBeInTheDocument();
  });

  it('busy disables both buttons + shows busy label', () => {
    render(<ObservationDeleteDialog form={makeForm(observation, { submitting: true })} />);
    expect(screen.getByTestId('observation-delete-cancel')).toBeDisabled();
    expect(screen.getByTestId('observation-delete-confirm')).toBeDisabled();
    expect(screen.getByTestId('observation-delete-confirm')).toHaveTextContent('Wird gelöscht...');
  });
});
