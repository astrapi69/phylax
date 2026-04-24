import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n/config';
import { DangerZoneSection } from './DangerZoneSection';

const ORIGINAL_LOCATION = window.location;
let originalDeleteDatabase: typeof indexedDB.deleteDatabase;

beforeEach(() => {
  originalDeleteDatabase = indexedDB.deleteDatabase;
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
  return () => {
    indexedDB.deleteDatabase = originalDeleteDatabase;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: ORIGINAL_LOCATION,
    });
  };
});

describe('DangerZoneSection', () => {
  it('renders heading + description + reset button by default', () => {
    render(<DangerZoneSection />);
    expect(screen.getByRole('heading', { level: 2, name: /Gefahrenzone/ })).toBeInTheDocument();
    expect(screen.getByTestId('danger-zone-reset-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('reset-dialog')).not.toBeInTheDocument();
  });

  it('clicking the reset button opens the ResetDialog and hides the trigger', async () => {
    const user = userEvent.setup();
    render(<DangerZoneSection />);

    await user.click(screen.getByTestId('danger-zone-reset-btn'));

    expect(screen.getByTestId('reset-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('danger-zone-reset-btn')).not.toBeInTheDocument();
  });

  it('cancelling the ResetDialog returns to the trigger state', async () => {
    const user = userEvent.setup();
    render(<DangerZoneSection />);

    await user.click(screen.getByTestId('danger-zone-reset-btn'));
    await user.click(screen.getByTestId('reset-cancel-btn'));

    expect(screen.queryByTestId('reset-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('danger-zone-reset-btn')).toBeInTheDocument();
  });
});

// Suppress unused-import warning when vi is not consumed directly.
void vi;
