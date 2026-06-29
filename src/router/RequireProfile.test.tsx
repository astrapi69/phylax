import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock } from '../crypto';
import { setupCompletedOnboarding } from '../db/test-helpers';
import { ProfileRepository } from '../db/repositories/profileRepository';
import { ActiveProfileProvider } from '../features/active-profile';
import { RequireProfile } from './RequireProfile';

const TEST_PASSWORD = 'test-password-12';

beforeEach(async () => {
  lock();
});

function renderWithRouter(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/profile/create" element={<p>Create Profile</p>} />
        <Route
          path="/profile"
          element={
            <RequireProfile>
              <p>Profile Content</p>
            </RequireProfile>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireProfile', () => {
  it('redirects to /profile/create when no profile exists', async () => {
    await setupCompletedOnboarding(TEST_PASSWORD);
    const { readMeta } = await import('../db/meta');
    const { unlock } = await import('../crypto');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

    renderWithRouter(['/profile']);

    await waitFor(() => {
      expect(screen.getByText('Create Profile')).toBeInTheDocument();
    });

    lock();
  });

  it('renders children when profile exists', async () => {
    await setupCompletedOnboarding(TEST_PASSWORD, { createDefaultProfile: true });
    const { readMeta } = await import('../db/meta');
    const { unlock } = await import('../crypto');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

    renderWithRouter(['/profile']);

    await waitFor(() => {
      expect(screen.getByText('Profile Content')).toBeInTheDocument();
    });

    lock();
  });

  it('shows loading state initially', async () => {
    await setupCompletedOnboarding(TEST_PASSWORD);
    const { readMeta } = await import('../db/meta');
    const { unlock } = await import('../crypto');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

    renderWithRouter(['/profile']);

    // Loading state shown before async check completes
    expect(screen.getByText('Laden...')).toBeInTheDocument();

    lock();
  });

  it('keeps the stored active profile when its id matches an existing one', async () => {
    await setupCompletedOnboarding(TEST_PASSWORD, { createDefaultProfile: true });
    const { readMeta } = await import('../db/meta');
    const { unlock } = await import('../crypto');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

    // Mark the existing profile active so the provider initialises with a
    // non-null activeProfileId, exercising the `activeProfileId ? find`
    // truthy branch (and the matched-existing path that skips the
    // first-profile fallback).
    const repo = new ProfileRepository();
    const [profile] = await repo.list();
    localStorage.setItem('phylax-active-profile', profile?.id ?? '');

    render(
      <ActiveProfileProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile/create" element={<p>Create Profile</p>} />
            <Route
              path="/profile"
              element={
                <RequireProfile>
                  <p>Profile Content</p>
                </RequireProfile>
              }
            />
          </Routes>
        </MemoryRouter>
      </ActiveProfileProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Profile Content')).toBeInTheDocument();
    });

    localStorage.removeItem('phylax-active-profile');
    lock();
  });

  it('redirects to /profile/create when listing profiles throws (lock race)', async () => {
    await setupCompletedOnboarding(TEST_PASSWORD, { createDefaultProfile: true });
    const { readMeta } = await import('../db/meta');
    const { unlock } = await import('../crypto');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

    // The keystore can be cleared mid-flight (auto-lock during route
    // unmount), making the decrypt inside list() reject. The guard
    // swallows it and routes to /profile/create.
    const listSpy = vi
      .spyOn(ProfileRepository.prototype, 'list')
      .mockRejectedValue(new Error('keystore locked mid-flight'));

    renderWithRouter(['/profile']);

    await waitFor(() => {
      expect(screen.getByText('Create Profile')).toBeInTheDocument();
    });

    listSpy.mockRestore();
    lock();
  });
});
