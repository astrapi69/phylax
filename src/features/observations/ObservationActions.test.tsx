import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from '../../i18n/config';
import { ObservationActions } from './ObservationActions';
import type { UseObservationFormResult } from './useObservationForm';
import type { Observation } from '../../domain';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function makeForm(overrides: Partial<UseObservationFormResult> = {}): UseObservationFormResult {
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

const observation: Observation = {
  id: 'o1',
  profileId: 'p',
  createdAt: 0,
  updatedAt: 0,
  theme: 'Schulter',
  fact: 'Schmerz',
  pattern: '',
  selfRegulation: '',
  status: '',
  source: 'user',
  extraSections: {},
};

describe('ObservationActions', () => {
  it('renders edit + delete buttons', () => {
    render(<ObservationActions observation={observation} form={makeForm()} />);
    expect(screen.getByTestId('observation-edit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('observation-delete-btn')).toBeInTheDocument();
  });

  it('edit click calls form.openEdit with the observation', () => {
    const openEdit = vi.fn(async () => {});
    render(<ObservationActions observation={observation} form={makeForm({ openEdit })} />);
    fireEvent.click(screen.getByTestId('observation-edit-btn'));
    expect(openEdit).toHaveBeenCalledWith(observation);
  });

  it('delete click calls form.openDelete with the observation', () => {
    const openDelete = vi.fn();
    render(<ObservationActions observation={observation} form={makeForm({ openDelete })} />);
    fireEvent.click(screen.getByTestId('observation-delete-btn'));
    expect(openDelete).toHaveBeenCalledWith(observation);
  });

  it('button clicks stop propagation (do not toggle parent details)', () => {
    const openEdit = vi.fn(async () => {});
    const summaryClick = vi.fn();
    render(
      <details open>
        <summary onClick={summaryClick}>
          parent
          <ObservationActions observation={observation} form={makeForm({ openEdit })} />
        </summary>
      </details>,
    );
    fireEvent.click(screen.getByTestId('observation-edit-btn'));
    expect(openEdit).toHaveBeenCalled();
    expect(summaryClick).not.toHaveBeenCalled();
  });

  it('buttons have aria-labels for screen readers', () => {
    render(<ObservationActions observation={observation} form={makeForm()} />);
    expect(screen.getByTestId('observation-edit-btn').getAttribute('aria-label')).toBe(
      'Bearbeiten',
    );
    expect(screen.getByTestId('observation-delete-btn').getAttribute('aria-label')).toBe('Löschen');
  });
});
