import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import i18n from '../../i18n/config';
import { __resetScrollLockForTest } from '../../ui';
import { lock, unlock } from '../../crypto';
import { db } from '../../db/schema';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding, resetDatabase } from '../../db/test-helpers';
import { ProfileRepository, ObservationRepository } from '../../db/repositories';
import { SoftResetDialog } from './SoftResetDialog';

const TEST_PASSWORD = 'soft-reset-pw-12';

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

describe('SoftResetDialog', () => {
  it('renders heading + warning lists + challenge prompt', () => {
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={vi.fn()} />);
    expect(screen.getByTestId('soft-reset-dialog-title')).toHaveTextContent(/Profildaten löschen/);
    expect(screen.getByTestId('soft-reset-wiped-list')).toBeInTheDocument();
    expect(screen.getByTestId('soft-reset-kept-list')).toBeInTheDocument();
    expect(screen.getByTestId('soft-reset-challenge-input')).toBeInTheDocument();
  });

  it('initial state: cancel-focused, confirm disabled', () => {
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={vi.fn()} />);
    expect(screen.getByTestId('soft-reset-cancel-btn')).toHaveFocus();
    expect(screen.getByTestId('soft-reset-confirm-btn')).toBeDisabled();
  });

  it('confirm stays disabled with invalid challenge input', async () => {
    const user = userEvent.setup();
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={vi.fn()} />);
    await user.type(screen.getByTestId('soft-reset-challenge-input'), 'wrong');
    expect(screen.getByTestId('soft-reset-confirm-btn')).toBeDisabled();
  });

  it('typing the locale-aware DE challenge LOESCHEN enables confirm', async () => {
    const user = userEvent.setup();
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={vi.fn()} />);
    await user.type(screen.getByTestId('soft-reset-challenge-input'), 'LOESCHEN');
    expect(screen.getByTestId('soft-reset-confirm-btn')).toBeEnabled();
  });

  it('typing the locale-aware EN challenge CLEAR enables confirm under en locale', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={vi.fn()} />);
    await user.type(screen.getByTestId('soft-reset-challenge-input'), 'CLEAR');
    expect(screen.getByTestId('soft-reset-confirm-btn')).toBeEnabled();
    await i18n.changeLanguage('de');
  });

  it('confirm click runs the reset and calls onSubmitted(true) on success', async () => {
    await seedProfileWithObservation();
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={onSubmitted} />);

    await user.type(screen.getByTestId('soft-reset-challenge-input'), 'LOESCHEN');
    await user.click(screen.getByTestId('soft-reset-confirm-btn'));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(true), { timeout: 5000 });
    expect(await db.profiles.count()).toBe(0);
    expect(await db.observations.count()).toBe(0);
  });

  it('partial-failure path renders the partial-failure alert + does NOT call onSubmitted(true)', async () => {
    const onSubmitted = vi.fn();
    const txnSpy = vi
      .spyOn(db, 'transaction')
      .mockRejectedValueOnce(new Error('synthetic txn failure') as never);

    const user = userEvent.setup();
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={onSubmitted} />);
    await user.type(screen.getByTestId('soft-reset-challenge-input'), 'LOESCHEN');
    await user.click(screen.getByTestId('soft-reset-confirm-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('soft-reset-partial-failure')).toBeInTheDocument(),
    );
    expect(onSubmitted).not.toHaveBeenCalled();
    txnSpy.mockRestore();
  });

  it('cancel click while idle calls onCancel without running the reset', async () => {
    await seedProfileWithObservation();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<SoftResetDialog onCancel={onCancel} onSubmitted={vi.fn()} />);
    await user.click(screen.getByTestId('soft-reset-cancel-btn'));
    expect(onCancel).toHaveBeenCalledOnce();
    // Vault unchanged.
    expect(await db.profiles.count()).toBe(1);
    expect(await db.observations.count()).toBe(1);
  });

  it('Escape key closes while idle (cancel path)', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<SoftResetDialog onCancel={onCancel} onSubmitted={vi.fn()} />);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders the wiped list with one item per locale array entry', () => {
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={vi.fn()} />);
    const list = screen.getByTestId('soft-reset-wiped-list');
    // DE locale has 8 wiped items.
    expect(list.querySelectorAll('li')).toHaveLength(8);
    expect(list).toHaveTextContent('Profile');
    expect(list).toHaveTextContent('Beobachtungen');
  });

  it('renders the kept list with one item per locale array entry', () => {
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={vi.fn()} />);
    const list = screen.getByTestId('soft-reset-kept-list');
    // DE locale has 4 kept items.
    expect(list.querySelectorAll('li')).toHaveLength(4);
    expect(list).toHaveTextContent('Master-Passwort');
    expect(list).toHaveTextContent('KI-Konfiguration');
  });

  it('retry path: after partial failure, Confirm re-enables and a second click succeeds without re-typing the challenge', async () => {
    await seedProfileWithObservation();
    const onSubmitted = vi.fn();

    // First attempt: spy makes the txn reject ONCE, then real impl
    // takes over for the retry.
    const txnSpy = vi
      .spyOn(db, 'transaction')
      .mockRejectedValueOnce(new Error('synthetic txn failure') as never);

    const user = userEvent.setup();
    render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={onSubmitted} />);
    await user.type(screen.getByTestId('soft-reset-challenge-input'), 'LOESCHEN');
    await user.click(screen.getByTestId('soft-reset-confirm-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('soft-reset-partial-failure')).toBeInTheDocument(),
    );
    // Challenge input still populated; user does NOT re-type.
    expect((screen.getByTestId('soft-reset-challenge-input') as HTMLInputElement).value).toBe(
      'LOESCHEN',
    );
    // Confirm button enabled again (no longer in-progress, not yet succeeded).
    expect(screen.getByTestId('soft-reset-confirm-btn')).toBeEnabled();

    // Click Confirm again -> the real implementation runs, succeeds.
    await user.click(screen.getByTestId('soft-reset-confirm-btn'));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(true), { timeout: 5000 });
    expect(await db.profiles.count()).toBe(0);

    txnSpy.mockRestore();
  });

  it('confirm calls onSubmitted exactly once even on re-render after success', async () => {
    await seedProfileWithObservation();
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SoftResetDialog onCancel={vi.fn()} onSubmitted={onSubmitted} />);
    await user.type(screen.getByTestId('soft-reset-challenge-input'), 'LOESCHEN');
    await user.click(screen.getByTestId('soft-reset-confirm-btn'));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(true));

    // Force re-render; notifiedRef guard prevents a duplicate call.
    rerender(<SoftResetDialog onCancel={vi.fn()} onSubmitted={onSubmitted} />);
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });
});
