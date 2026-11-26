import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import 'fake-indexeddb/auto';
import i18n from '../../i18n/config';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { db } from '../../db/schema';
import { ProfileRepository } from '../../db/repositories';
import {
  ActiveProfileProvider,
  ACTIVE_PROFILE_STORAGE_KEY,
  notifyProfilesChanged,
  useActiveProfile,
} from '../active-profile';
import { ThemeProvider } from '../theme';
import { SearchProvider } from '../search-trigger';
import { Header } from './Header';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession() {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function createProfile(name: string | undefined): Promise<string> {
  const profile = await new ProfileRepository().create({
    baseData: {
      name,
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  });
  return profile.id;
}

/** Test-only control that switches the active profile through the context. */
function SwitchTo({ id, label }: { id: string; label: string }) {
  const { setActiveProfileId } = useActiveProfile();
  return (
    <button type="button" onClick={() => setActiveProfileId(id)}>
      {label}
    </button>
  );
}

function renderHeader(extra: React.ReactNode = null) {
  return render(
    <ActiveProfileProvider>
      <MemoryRouter initialEntries={['/observations']}>
        <ThemeProvider>
          <SearchProvider>
            <Header onOpenNavDrawer={() => {}} />
            {extra}
            <Routes>
              <Route path="/observations" element={<Link to="/lab-values">to lab values</Link>} />
              <Route path="/lab-values" element={<div data-testid="lab-values" />} />
              <Route path="/profiles" element={<div data-testid="profiles-route" />} />
              <Route path="/profile" element={<div data-testid="profile-route" />} />
            </Routes>
          </SearchProvider>
        </ThemeProvider>
      </MemoryRouter>
    </ActiveProfileProvider>,
  );
}

async function expectName(name: string) {
  await waitFor(() =>
    expect(screen.getByTestId('header-active-profile-name')).toHaveTextContent(name),
  );
}

/** Give the asynchronous profile lookup time to finish and render. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

beforeEach(async () => {
  localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
  if (i18n.language !== 'de') await i18n.changeLanguage('de');
});

describe('active profile in the header (M-09)', () => {
  describe('with exactly one profile', () => {
    it('leaves the header as it was: no profile link', async () => {
      const id = await createProfile('Anna');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, id);
      renderHeader();
      await settle();

      expect(screen.queryByTestId('header-active-profile')).toBeNull();
      expect(screen.queryByText('Anna')).toBeNull();
      expect(screen.getByText('Befaro').closest('a')).toHaveAttribute('href', '/profile');
      expect(screen.getByTestId('header-hamburger')).toBeInTheDocument();
      expect(screen.getByLabelText('Befaro sperren')).toBeInTheDocument();
    });

    it('shows no link when no profile exists yet', async () => {
      renderHeader();
      await settle();
      expect(screen.queryByTestId('header-active-profile')).toBeNull();
    });
  });

  describe('with two profiles', () => {
    it('names the active profile next to the app name', async () => {
      const anna = await createProfile('Anna');
      await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
      renderHeader();

      await expectName('Anna');
      expect(screen.queryByText('Bernd')).toBeNull();
    });

    it('is a link to the profile list with the caption in its accessible name', async () => {
      const anna = await createProfile('Anna');
      await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
      renderHeader();
      await expectName('Anna');

      const link = screen.getByRole('link', { name: 'Aktives Profil: Anna' });
      expect(link).toHaveAttribute('href', '/profiles');
      expect(link).toHaveAttribute('title', 'Anna');
    });

    it('leads to the profile list on click', async () => {
      const user = userEvent.setup();
      const anna = await createProfile('Anna');
      await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
      renderHeader();
      await expectName('Anna');

      await user.click(screen.getByRole('link', { name: 'Aktives Profil: Anna' }));
      expect(screen.getByTestId('profiles-route')).toBeInTheDocument();
    });

    it('can be reached with the keyboard and carries the header focus ring', async () => {
      const user = userEvent.setup();
      const anna = await createProfile('Anna');
      await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
      renderHeader();
      await expectName('Anna');

      const link = screen.getByRole('link', { name: 'Aktives Profil: Anna' });
      const hamburger = screen.getByTestId('header-hamburger');
      for (let i = 0; i < 6 && document.activeElement !== link; i++) await user.tab();
      expect(link).toHaveFocus();
      for (const ring of [
        'focus-visible:outline',
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-blue-600',
      ]) {
        expect(hamburger).toHaveClass(ring);
        expect(link).toHaveClass(ring);
      }

      await user.keyboard('{Enter}');
      expect(screen.getByTestId('profiles-route')).toBeInTheDocument();
    });

    it('changes at once when the profile is switched', async () => {
      const user = userEvent.setup();
      const anna = await createProfile('Anna');
      const bernd = await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
      renderHeader(<SwitchTo id={bernd} label="switch to Bernd" />);
      await expectName('Anna');

      await user.click(screen.getByRole('button', { name: 'switch to Bernd' }));

      // Never the old name for the new profile: either nothing yet, or
      // the new name.
      expect(screen.queryByText('Anna')).toBeNull();
      await expectName('Bernd');
      expect(screen.getByRole('link', { name: 'Aktives Profil: Bernd' })).toBeInTheDocument();
    });

    it('follows a switch made in another tab (storage event)', async () => {
      const anna = await createProfile('Anna');
      const bernd = await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
      renderHeader();
      await expectName('Anna');

      act(() => {
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, bernd);
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: ACTIVE_PROFILE_STORAGE_KEY,
            oldValue: anna,
            newValue: bernd,
          }),
        );
      });

      await expectName('Bernd');
    });

    it('picks up a rename when the profiles-changed signal fires', async () => {
      const anna = await createProfile('Anna');
      await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
      renderHeader();
      await expectName('Anna');

      const repo = new ProfileRepository();
      const profile = (await repo.list()).find((p) => p.id === anna);
      if (!profile) throw new Error('profile missing');
      const row = await repo.serialize({
        ...profile,
        baseData: { ...profile.baseData, name: 'Anna Maria' },
      });
      await db.profiles.put(row);
      act(() => notifyProfilesChanged());

      await expectName('Anna Maria');
    });

    it('reloads on navigation, so a profile added elsewhere shows up', async () => {
      const user = userEvent.setup();
      const anna = await createProfile('Anna');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
      renderHeader();
      await settle();
      expect(screen.queryByTestId('header-active-profile')).toBeNull();

      await createProfile('Bernd');
      await user.click(screen.getByRole('link', { name: 'to lab values' }));

      await expectName('Anna');
    });

    it('shows the fallback name of a profile without a name', async () => {
      const unnamed = await createProfile(undefined);
      await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, unnamed);
      renderHeader();

      await waitFor(() => expect(screen.getByTestId('header-active-profile')).toBeInTheDocument());
      expect(screen.getByTestId('header-active-profile-name').textContent ?? '').not.toBe('');
    });

    it('shows nothing when the stored id names no existing profile', async () => {
      await createProfile('Anna');
      await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, 'no-such-profile');
      renderHeader();
      await settle();
      expect(screen.queryByTestId('header-active-profile')).toBeNull();
    });

    it('keeps a long name on one line and lets it truncate', async () => {
      const longName = 'Maximiliane Konstantinopoulou-Schwarzenberger';
      const id = await createProfile(longName);
      await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, id);
      renderHeader();
      await expectName(longName);

      expect(screen.getByTestId('header-active-profile-name')).toHaveClass('truncate');
      expect(screen.getByTestId('header-active-profile')).toHaveClass('min-w-0', 'max-w-full');
      expect(screen.getByTestId('header-active-profile')).toHaveAttribute('title', longName);
    });

    it('uses the English caption when the language is en', async () => {
      const anna = await createProfile('Anna');
      await createProfile('Bernd');
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
      await i18n.changeLanguage('en');
      renderHeader();

      await waitFor(() =>
        expect(screen.getByRole('link', { name: 'Active profile: Anna' })).toBeInTheDocument(),
      );
      await i18n.changeLanguage('de');
    });
  });

  it('shows nothing while the vault is locked', async () => {
    const anna = await createProfile('Anna');
    await createProfile('Bernd');
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, anna);
    lock();
    renderHeader();
    await settle();
    expect(screen.queryByTestId('header-active-profile')).toBeNull();
  });
});
