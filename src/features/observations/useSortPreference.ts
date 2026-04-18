import { useCallback, useState } from 'react';
import type { SortMode } from './sorting';

const VALID_MODES: SortMode[] = ['recent', 'alphabetical'];

function storageKey(viewKey: string): string {
  return `phylax-${viewKey}-sort`;
}

function readStored(viewKey: string, fallback: SortMode): SortMode {
  try {
    const raw = window.localStorage.getItem(storageKey(viewKey));
    if (raw && (VALID_MODES as string[]).includes(raw)) {
      return raw as SortMode;
    }
  } catch {
    // Private browsing / storage disabled. Fall through to default.
  }
  return fallback;
}

function writeStored(viewKey: string, mode: SortMode): void {
  try {
    window.localStorage.setItem(storageKey(viewKey), mode);
  } catch {
    // Quota exceeded or storage disabled; the in-memory state still
    // reflects the change for this session.
  }
}

/**
 * View-local sort preference backed by localStorage.
 *
 * Reads the stored mode on first render and persists future changes.
 * Safe on browsers with disabled storage: reads fall through to the
 * default, writes are swallowed, and the in-memory state remains the
 * source of truth for the current session.
 */
export function useSortPreference(
  viewKey: string,
  defaultMode: SortMode = 'recent',
): [SortMode, (mode: SortMode) => void] {
  const [mode, setMode] = useState<SortMode>(() => readStored(viewKey, defaultMode));

  const setAndPersist = useCallback(
    (next: SortMode) => {
      setMode(next);
      writeStored(viewKey, next);
    },
    [viewKey],
  );

  return [mode, setAndPersist];
}
