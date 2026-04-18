import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository, ProfileVersionRepository } from '../../db/repositories';
import { DonationReminderBanner } from './DonationReminderBanner';
import { DONATION_URL, STORAGE_KEY } from './constants';
import { readDonationState } from './donationStorage';

const TEST_PASSWORD = 'test-password-12';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

/** Sets up onboarded + unlocked + one profile with an optional oldest version. */
async function seedSession(oldestVersionDaysAgo: number | null): Promise<string> {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
  const profile = await new ProfileRepository().create({
    baseData: {
      name: 'Tester',
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
  if (oldestVersionDaysAgo !== null) {
    const changeDate = new Date(Date.now() - oldestVersionDaysAgo * ONE_DAY_MS)
      .toISOString()
      .slice(0, 10);
    await new ProfileVersionRepository().create({
      profileId: profile.id,
      version: '1.0',
      changeDescription: 'Erstprofil',
      changeDate,
    });
  }
  return profile.id;
}

function markOnboardingSeen(): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      onboardingSeen: true,
      lastReminderAction: null,
      lastReminderDate: null,
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DonationReminderBanner', () => {
  it('renders nothing when onboardingSeen is false (mutual exclusion with S-02 card)', async () => {
    const profileId = await seedSession(120);
    // Intentionally do NOT set onboardingSeen.
    render(<DonationReminderBanner profileId={profileId} />);
    // Wait a tick for the load effect to settle.
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('donation-reminder-banner')).not.toBeInTheDocument();
  });

  it('renders the banner when the oldest version is 100 days old and onboardingSeen is true', async () => {
    markOnboardingSeen();
    const profileId = await seedSession(100);
    render(<DonationReminderBanner profileId={profileId} />);
    await waitFor(() => expect(screen.getByTestId('donation-reminder-banner')).toBeInTheDocument());
    expect(screen.getByText(/Du nutzt Phylax jetzt seit \d+ Monaten/)).toBeInTheDocument();
  });

  it('"Unterstuetzen" updates state to donated + today and hides the banner', async () => {
    markOnboardingSeen();
    const profileId = await seedSession(100);
    const user = userEvent.setup();
    render(<DonationReminderBanner profileId={profileId} />);
    await waitFor(() => expect(screen.getByTestId('donation-reminder-banner')).toBeInTheDocument());

    await user.click(screen.getByRole('link', { name: /Unterstuetzen/ }));

    const state = readDonationState();
    expect(state.lastReminderAction).toBe('donated');
    expect(state.lastReminderDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByTestId('donation-reminder-banner')).not.toBeInTheDocument();
  });

  it('"Nicht jetzt" updates state to dismissed + today and hides the banner', async () => {
    markOnboardingSeen();
    const profileId = await seedSession(100);
    const user = userEvent.setup();
    render(<DonationReminderBanner profileId={profileId} />);
    await waitFor(() => expect(screen.getByTestId('donation-reminder-banner')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Nicht jetzt' }));

    const state = readDonationState();
    expect(state.lastReminderAction).toBe('dismissed');
    expect(state.lastReminderDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByTestId('donation-reminder-banner')).not.toBeInTheDocument();
  });

  it('Close X (aria "Schliessen") behaves identically to "Nicht jetzt"', async () => {
    markOnboardingSeen();
    const profileId = await seedSession(100);
    const user = userEvent.setup();
    render(<DonationReminderBanner profileId={profileId} />);
    await waitFor(() => expect(screen.getByTestId('donation-reminder-banner')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Schliessen' }));

    const state = readDonationState();
    expect(state.lastReminderAction).toBe('dismissed');
    expect(screen.queryByTestId('donation-reminder-banner')).not.toBeInTheDocument();
  });

  it('DonateLink points at DONATION_URL with safe external-link attributes', async () => {
    markOnboardingSeen();
    const profileId = await seedSession(100);
    render(<DonationReminderBanner profileId={profileId} />);
    const link = await screen.findByRole('link', { name: /Unterstuetzen/ });
    expect(link).toHaveAttribute('href', DONATION_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('silently suppresses the banner when the repository throws (locked key store)', async () => {
    markOnboardingSeen();
    const profileId = await seedSession(100);
    vi.spyOn(ProfileVersionRepository.prototype, 'listByProfileNewestFirst').mockRejectedValue(
      new Error('locked'),
    );

    render(<DonationReminderBanner profileId={profileId} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('donation-reminder-banner')).not.toBeInTheDocument();
  });
});
