/**
 * Persistence for the active-profile selection (M-04).
 *
 * Multi-profile installations need to remember which profile the user
 * was last viewing across reloads. This key holds the active
 * profile id; consumers read it through `useActiveProfile()` rather
 * than touching localStorage directly.
 *
 * Storage key follows the `phylax-` prefix convention from CLAUDE.md
 * so the full-data-reset path in `src/features/reset/useResetAllData.ts`
 * sweeps it alongside other UI preferences.
 *
 * The vault encryption is profile-agnostic - all profiles share the
 * same master key. Switching profiles is a pure scope change in the
 * UI; the in-memory crypto key is not affected.
 */
export const STORAGE_KEY = 'phylax-active-profile';

export function readStoredActiveProfileId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === null || value === '') return null;
    return value;
  } catch {
    return null;
  }
}

export function writeStoredActiveProfileId(id: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* quota or private-browsing; selection does not persist this session */
  }
}

export function clearStoredActiveProfileId(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
