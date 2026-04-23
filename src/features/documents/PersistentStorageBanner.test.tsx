import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import i18n from '../../i18n/config';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository } from '../../db/repositories';
import { PersistentStorageBanner } from './PersistentStorageBanner';
import { __resetPersistentStorageSession } from './usePersistentStorage';

const TEST_PASSWORD = 'test-password-12';

type StorageStub = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

let originalStorage: StorageStub | undefined;

function setStorage(stub: StorageStub | undefined): void {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: stub,
  });
}

async function unlockCurrent(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedProfile(): Promise<string> {
  const profile = await new ProfileRepository().create({
    baseData: {
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

beforeEach(async () => {
  __resetPersistentStorageSession();
  originalStorage = (navigator as unknown as { storage?: StorageStub }).storage;
  window.localStorage.clear();
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

afterEach(() => {
  setStorage(originalStorage);
});

describe('PersistentStorageBanner', () => {
  it('renders nothing when storage is already persisted', async () => {
    setStorage({
      persisted: async () => true,
      persist: async () => true,
    });
    await seedProfile();

    const { container } = render(<PersistentStorageBanner />);

    await new Promise((r) => setTimeout(r, 20));
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for the transient state (not yet asked)', async () => {
    setStorage({
      persisted: async () => false,
      persist: async () => true,
    });
    await seedProfile();

    const { container } = render(<PersistentStorageBanner />);

    await new Promise((r) => setTimeout(r, 20));
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the API is unavailable', async () => {
    setStorage(undefined);
    await seedProfile();

    const { container } = render(<PersistentStorageBanner />);

    await new Promise((r) => setTimeout(r, 20));
    expect(container.firstChild).toBeNull();
  });

  it('renders the denied banner with role=alert after a refused persist request', async () => {
    // Need to mount hook once, trigger request, then re-mount banner so
    // the persisted probe picks up the session state.
    const persistStub = vi.fn(async () => false);
    setStorage({
      persisted: async () => false,
      persist: persistStub,
    });
    await seedProfile();

    // First render captures transient + the upload-side would call
    // requestPersistence. We inline it here via the hook's export
    // and then re-probe via versionKey.
    const { rerender } = render(<PersistentStorageBanner versionKey={0} />);

    await new Promise((r) => setTimeout(r, 20));

    // Manually invoke the module-level session flag by calling
    // persist() directly, mirroring what the upload hook would do.
    await (navigator as unknown as { storage: StorageStub }).storage.persist?.();
    // Reset the session to re-enable, then flip denied via the hook's
    // session state: simplest path is to use __resetPersistentStorageSession()
    // then call requestPersistence through a fresh hook mount that we
    // trigger via rerender. However the banner component does not
    // expose requestPersistence — so tests that need the denied banner
    // exercise the state through the useDocumentUpload integration
    // test path. Here we verify via stubbing persisted() to always
    // return false AND manually setting the module session via a direct
    // import of the hook state.
    __resetPersistentStorageSession();
    // Use renderHook-like path: import and run the request via a
    // helper component.
    await act(async () => {
      const { usePersistentStorage } = await import('./usePersistentStorage');
      const helper = usePersistentStorage;
      // Call a throwaway hook inside act. We cannot call hooks
      // outside a React component, so use a side channel: render a
      // helper and let its effect run.
      function Helper() {
        const r = helper();
        // Trigger immediately; the effect probe resolves in the
        // background and flips lastRequestResult to 'denied'.
        r.requestPersistence();
        return null;
      }
      render(<Helper />);
      await new Promise((r) => setTimeout(r, 20));
    });

    // Now re-render the banner with a bumped versionKey so the
    // internal probe flips state to denied.
    rerender(<PersistentStorageBanner versionKey={1} />);

    await waitFor(() =>
      expect(screen.getByTestId('persistent-storage-banner')).toBeInTheDocument(),
    );
    const banner = screen.getByTestId('persistent-storage-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('persistent-storage-banner-message').textContent ?? '').toMatch(
      /Browser/,
    );
    expect(screen.getByTestId('persistent-storage-dismiss-btn')).toBeInTheDocument();
  });

  it('dismiss button hides the banner and writes a per-profile localStorage flag', async () => {
    setStorage({
      persisted: async () => false,
      persist: async () => false,
    });
    const profileId = await seedProfile();

    // Trigger denial via helper hook.
    await act(async () => {
      const { usePersistentStorage } = await import('./usePersistentStorage');
      function Helper() {
        const r = usePersistentStorage();
        r.requestPersistence();
        return null;
      }
      render(<Helper />);
      await new Promise((r) => setTimeout(r, 20));
    });

    render(<PersistentStorageBanner versionKey={1} />);

    await waitFor(() =>
      expect(screen.getByTestId('persistent-storage-banner')).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('persistent-storage-dismiss-btn'));
    });

    expect(screen.queryByTestId('persistent-storage-banner')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(`phylax.persistence.dismissed.${profileId}`)).toBe('1');
  });

  it('respects a pre-existing per-profile dismiss flag and renders nothing', async () => {
    setStorage({
      persisted: async () => false,
      persist: async () => false,
    });
    const profileId = await seedProfile();
    window.localStorage.setItem(`phylax.persistence.dismissed.${profileId}`, '1');

    // Trigger denial.
    await act(async () => {
      const { usePersistentStorage } = await import('./usePersistentStorage');
      function Helper() {
        const r = usePersistentStorage();
        r.requestPersistence();
        return null;
      }
      render(<Helper />);
      await new Promise((r) => setTimeout(r, 20));
    });

    render(<PersistentStorageBanner versionKey={1} />);

    await new Promise((r) => setTimeout(r, 40));
    expect(screen.queryByTestId('persistent-storage-banner')).not.toBeInTheDocument();
  });
});
