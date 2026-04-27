import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { EditBaseDataButton } from './EditBaseDataButton';
import type { UseProfileBaseDataFormResult } from './useProfileBaseDataForm';
import { makeProfile } from './test-helpers';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function makeForm(
  overrides: Partial<UseProfileBaseDataFormResult> = {},
): UseProfileBaseDataFormResult {
  return {
    state: { kind: 'closed' },
    openEdit: vi.fn(),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    close: vi.fn(),
    ...overrides,
  };
}

describe('EditBaseDataButton', () => {
  it('renders the localized label', () => {
    render(<EditBaseDataButton profile={makeProfile()} form={makeForm()} />);
    expect(screen.getByTestId('edit-base-data-btn')).toHaveTextContent('Bearbeiten');
  });

  it('clicking opens the form in edit mode for the given profile', async () => {
    const user = userEvent.setup();
    const openEdit = vi.fn();
    const profile = makeProfile();
    render(<EditBaseDataButton profile={profile} form={makeForm({ openEdit })} />);
    await user.click(screen.getByTestId('edit-base-data-btn'));
    expect(openEdit).toHaveBeenCalledWith(profile);
  });

  it('button satisfies 44px touch height', () => {
    render(<EditBaseDataButton profile={makeProfile()} form={makeForm()} />);
    expect(screen.getByTestId('edit-base-data-btn').className).toMatch(/min-h-\[44px\]/);
  });
});
