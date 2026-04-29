import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
  it('renders the Einstellungen heading plus Theme, Language, AI-Config, Data-management, and Donation sections', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <SettingsScreen />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Darstellung' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Sprache' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Automatisch sperren' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'KI-Assistent' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Phylax unterstützen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Datenverwaltung' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Profil exportieren' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Verschlüsseltes Backup' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profil exportieren' })).toBeInTheDocument();
    // 3 theme radios + 3 language radios + 5 auto-lock preset buttons = 11.
    expect(screen.getAllByRole('radio')).toHaveLength(11);
  });

  it('exposes the current theme as the checked radio', () => {
    window.localStorage.setItem('phylax-theme', 'dark');
    render(
      <MemoryRouter>
        <ThemeProvider>
          <SettingsScreen />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('radio', { name: /Dunkel/ })).toBeChecked();
  });
});
