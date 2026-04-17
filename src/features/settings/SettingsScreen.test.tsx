import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { ThemeProvider } from '../theme';
import { SettingsScreen } from './SettingsScreen';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

beforeEach(async () => {
  window.localStorage.clear();
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

describe('SettingsScreen', () => {
  it('renders the Einstellungen heading, ThemeSection, and AISettingsSection', () => {
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Darstellung' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'KI-Assistent' })).toBeInTheDocument();
    // All three theme options are present.
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('exposes the current theme as the checked radio', () => {
    window.localStorage.setItem('phylax-theme', 'dark');
    render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>,
    );
    expect(screen.getByRole('radio', { name: /Dunkel/ })).toBeChecked();
  });
});
