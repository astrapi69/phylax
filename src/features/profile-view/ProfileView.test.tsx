import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository } from '../../db/repositories';
import type { Profile } from '../../domain';
import { ProfileView } from './ProfileView';
import { makeProfile } from './test-helpers';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession() {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

beforeEach(async () => {
  window.localStorage.clear();
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderWithProfile(profile: Profile) {
  const spy = vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue(profile);
  const utils = render(
    <MemoryRouter>
      <ProfileView />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  return { ...utils, spy };
}

describe('ProfileView', () => {
  it('shows a loading indicator initially', () => {
    render(
      <MemoryRouter>
        <ProfileView />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the profile name, type badge and version', async () => {
    await renderWithProfile(
      makeProfile({
        baseData: {
          name: 'Asterios',
          weightHistory: [],
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
          profileType: 'self',
        },
        version: '1.3.1',
      }),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Asterios' })).toBeInTheDocument();
    expect(screen.getByText('Eigenes Profil')).toBeInTheDocument();
    expect(screen.getByText(/v1.3.1/)).toBeInTheDocument();
  });

  it('renders lastUpdateReason in header when set', async () => {
    await renderWithProfile(
      makeProfile({ lastUpdateReason: 'Import aus Markdown', version: '1.0' }),
    );
    expect(screen.getByText(/Import aus Markdown/)).toBeInTheDocument();
  });

  it('renders bullet sections for diagnoses, medications and limitations', async () => {
    await renderWithProfile(
      makeProfile({
        baseData: {
          name: 'X',
          weightHistory: [],
          knownDiagnoses: ['Schulterimpingement'],
          currentMedications: ['Ibuprofen'],
          relevantLimitations: ['Keine Sprünge'],
          profileType: 'self',
        },
      }),
    );
    expect(screen.getByRole('heading', { name: 'Bekannte Diagnosen' })).toBeInTheDocument();
    expect(screen.getByText('Schulterimpingement')).toBeInTheDocument();
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
    expect(screen.getByText('Keine Sprünge')).toBeInTheDocument();
  });

  it('hides empty sections entirely', async () => {
    await renderWithProfile(makeProfile({ version: '1.0' }));
    expect(screen.queryByRole('heading', { name: 'Bekannte Diagnosen' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Aktuelle Medikamente' })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Warnsignale/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Externe Referenzen' })).toBeNull();
  });

  it('renders warning signs with visual accent', async () => {
    await renderWithProfile(makeProfile({ warningSigns: ['Brustschmerz bei Belastung'] }));
    expect(screen.getByText('Brustschmerz bei Belastung')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: /Warnsignale/ });
    expect(heading.textContent).toMatch(/⚠/);
  });

  it('renders external references as links only when http(s)', async () => {
    await renderWithProfile(
      makeProfile({
        externalReferences: ['https://example.com/studie', 'Laborbefund Nr. 000000000'],
      }),
    );
    const link = screen.getByRole('link', { name: 'https://example.com/studie' });
    expect(link).toHaveAttribute('href', 'https://example.com/studie');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    // Non-URL reference is plain text, not a link.
    expect(screen.queryByRole('link', { name: /Laborbefund/ })).toBeNull();
    expect(screen.getByText('Laborbefund Nr. 000000000')).toBeInTheDocument();
  });

  it('renders the doctor card when primaryDoctor is set', async () => {
    await renderWithProfile(
      makeProfile({
        baseData: {
          name: 'X',
          weightHistory: [],
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
          profileType: 'self',
          primaryDoctor: { name: 'Dr. Beispiel' },
        },
      }),
    );
    expect(screen.getByRole('heading', { name: 'Hausarzt' })).toBeInTheDocument();
    expect(screen.getByText('Dr. Beispiel')).toBeInTheDocument();
  });

  it('renders contextNotes via MarkdownContent', async () => {
    await renderWithProfile(
      makeProfile({
        baseData: {
          name: 'X',
          weightHistory: [],
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
          profileType: 'self',
          contextNotes: 'Ein **wichtiger** Kontext',
        },
      }),
    );
    const strong = screen.getByText('wichtiger');
    expect(strong.tagName.toLowerCase()).toBe('strong');
  });

  it('shows error message when no profile exists', async () => {
    render(
      <MemoryRouter>
        <ProfileView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/Kein Profil/);
  });

  describe('donation onboarding card (S-02)', () => {
    it('renders the onboarding card when the user has never seen it', async () => {
      await renderWithProfile(makeProfile());
      expect(screen.getByTestId('donation-onboarding-card')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: 'Willkommen bei Phylax' }),
      ).toBeInTheDocument();
    });

    it('does NOT render the card when onboardingSeen is already true in storage', async () => {
      window.localStorage.setItem(
        'phylax-donation-state',
        JSON.stringify({
          onboardingSeen: true,
          lastReminderAction: null,
          lastReminderDate: null,
        }),
      );
      await renderWithProfile(makeProfile());
      expect(screen.queryByTestId('donation-onboarding-card')).not.toBeInTheDocument();
    });

    it('"Verstanden" click hides the card in the same render cycle', async () => {
      const user = (await import('@testing-library/user-event')).default.setup();
      await renderWithProfile(makeProfile());
      expect(screen.getByTestId('donation-onboarding-card')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Verstanden' }));
      expect(screen.queryByTestId('donation-onboarding-card')).not.toBeInTheDocument();
    });
  });

  describe('donation reminder banner (S-03)', () => {
    it('renders the reminder banner when onboardingSeen is true and there is a 100-day-old version', async () => {
      // Seed onboardingSeen=true so the S-02 card does not mount and the
      // S-03 gate can fire.
      window.localStorage.setItem(
        'phylax-donation-state',
        JSON.stringify({
          onboardingSeen: true,
          lastReminderAction: null,
          lastReminderDate: null,
        }),
      );
      const profile = makeProfile();
      // Seed a ProfileVersion with a changeDate 100 days in the past so
      // shouldShowReminder returns true.
      const { ProfileVersionRepository } = await import('../../db/repositories');
      const changeDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      await new ProfileVersionRepository().create({
        profileId: profile.id,
        version: '1.0',
        changeDescription: 'Erstprofil',
        changeDate,
      });

      await renderWithProfile(profile);
      await waitFor(() =>
        expect(screen.getByTestId('donation-reminder-banner')).toBeInTheDocument(),
      );
      expect(screen.queryByTestId('donation-onboarding-card')).not.toBeInTheDocument();
    });
  });
});
