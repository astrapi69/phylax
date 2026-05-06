import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import 'fake-indexeddb/auto';
import i18n from '../../i18n/config';
import { __resetScrollLockForTest } from '../../ui';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding, resetDatabase } from '../../db/test-helpers';
import { ProfileRepository, ObservationRepository } from '../../db/repositories';
import { DangerZoneSection } from './DangerZoneSection';

const TEST_PASSWORD = 'danger-zone-pw-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedProfileWithObservation(): Promise<void> {
  const profile = await new ProfileRepository().create({
    baseData: {
      name: 'Test',
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
  await new ObservationRepository().create({
    profileId: profile.id,
    theme: 'Knie',
    fact: 'fact',
    pattern: '',
    selfRegulation: '',
    status: 'Stabil',
    source: 'user',
    extraSections: {},
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
}

function renderWithRouter(initialEntries = ['/settings']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/settings" element={<DangerZoneSection />} />
        <Route path="/profile/create" element={<div data-testid="profile-create-stub" />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  __resetScrollLockForTest();
  lock();
  await resetDatabase();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
  if (i18n.language !== 'de') {
    await i18n.changeLanguage('de');
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DangerZoneSection', () => {
  it('renders heading + description + both reset buttons by default', () => {
    renderWithRouter();
    expect(screen.getByRole('heading', { level: 2, name: /Gefahrenzone/ })).toBeInTheDocument();
    expect(screen.getByTestId('danger-zone-soft-reset-btn')).toBeInTheDocument();
    expect(screen.getByTestId('danger-zone-reset-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('reset-dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('soft-reset-dialog')).not.toBeInTheDocument();
  });

  it('soft-reset button uses the t("settings:danger-zone.soft-reset-button") label', () => {
    renderWithRouter();
    expect(screen.getByTestId('danger-zone-soft-reset-btn')).toHaveTextContent(
      /Profildaten löschen/,
    );
  });

  it('hard-reset button uses the t("settings:danger-zone.reset-button") label', () => {
    renderWithRouter();
    expect(screen.getByTestId('danger-zone-reset-btn')).toHaveTextContent(/Alle Daten löschen/);
  });

  it('soft-reset button stacks above hard-reset button in the DOM', () => {
    renderWithRouter();
    const soft = screen.getByTestId('danger-zone-soft-reset-btn');
    const hard = screen.getByTestId('danger-zone-reset-btn');
    // Bitwise AND with DOCUMENT_POSITION_FOLLOWING (4) is non-zero when
    // `hard` follows `soft` in document order.
    expect(soft.compareDocumentPosition(hard) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('clicking the soft-reset button opens the SoftResetDialog and hides both triggers', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('danger-zone-soft-reset-btn'));

    expect(screen.getByTestId('soft-reset-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('danger-zone-soft-reset-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('danger-zone-reset-btn')).not.toBeInTheDocument();
  });

  it('cancelling the SoftResetDialog returns to the trigger state', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('danger-zone-soft-reset-btn'));
    await user.click(screen.getByTestId('soft-reset-cancel-btn'));

    expect(screen.queryByTestId('soft-reset-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('danger-zone-soft-reset-btn')).toBeInTheDocument();
    expect(screen.getByTestId('danger-zone-reset-btn')).toBeInTheDocument();
  });

  it('successful soft-reset navigates to /profile/create (replace)', async () => {
    await seedProfileWithObservation();
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('danger-zone-soft-reset-btn'));
    await user.type(screen.getByTestId('soft-reset-challenge-input'), 'LOESCHEN');
    await user.click(screen.getByTestId('soft-reset-confirm-btn'));

    await waitFor(
      () => expect(screen.getByTestId('current-path')).toHaveTextContent('/profile/create'),
      { timeout: 5000 },
    );
    expect(screen.getByTestId('profile-create-stub')).toBeInTheDocument();
  });

  it('partial-failure path keeps the dialog open and does NOT navigate', async () => {
    const { db } = await import('../../db/schema');
    const txnSpy = vi
      .spyOn(db, 'transaction')
      .mockRejectedValueOnce(new Error('synthetic txn failure') as never);

    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('danger-zone-soft-reset-btn'));
    await user.type(screen.getByTestId('soft-reset-challenge-input'), 'LOESCHEN');
    await user.click(screen.getByTestId('soft-reset-confirm-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('soft-reset-partial-failure')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('current-path')).toHaveTextContent('/settings');
    expect(screen.queryByTestId('profile-create-stub')).not.toBeInTheDocument();

    txnSpy.mockRestore();
  });

  // Hard-reset regression tests. Behavior must NOT change relative to
  // the pre-soft-reset implementation - the soft reset is purely
  // additive.

  it('clicking the hard-reset button opens the ResetDialog and hides both triggers', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('danger-zone-reset-btn'));

    expect(screen.getByTestId('reset-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('danger-zone-soft-reset-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('danger-zone-reset-btn')).not.toBeInTheDocument();
  });

  it('cancelling the hard-reset ResetDialog returns to the trigger state', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('danger-zone-reset-btn'));
    await user.click(screen.getByTestId('reset-cancel-btn'));

    expect(screen.queryByTestId('reset-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('danger-zone-soft-reset-btn')).toBeInTheDocument();
    expect(screen.getByTestId('danger-zone-reset-btn')).toBeInTheDocument();
  });
});
