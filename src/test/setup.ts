import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Side-effect import: initialize i18next once per test process so every
// component that calls useTranslation() resolves German keys instead of
// rendering literal key strings. Matches main.tsx's runtime bootstrap.
// The DE default for the test environment is pinned in
// `pin-language.ts` (listed first in vite.config.ts setupFiles) so
// that the detector resolves to 'de' before this import runs.
import '../i18n/config';

// jsdom (current pinned version) does not implement
// `Blob.prototype.arrayBuffer` / `File.prototype.arrayBuffer`. The
// document upload flow (Phase 4 D-02) calls `file.arrayBuffer()` to
// pass raw bytes into the encryption pipeline; without this shim the
// upload-hook tests fail with "f.arrayBuffer is not a function".
// Implementation reads via FileReader, which jsdom does provide.
if (
  typeof Blob !== 'undefined' &&
  typeof (Blob.prototype as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer !==
    'function'
) {
  (Blob.prototype as Blob & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = function (
    this: Blob,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          reject(new Error('FileReader did not return ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsArrayBuffer(this);
    });
  };
}

// jsdom does not implement matchMedia. Install a minimal shim that tests can
// override per-test when they need to simulate a specific prefers-color-scheme.
// Default: "light" (not matching the dark media query).
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => {
    const listeners = new Set<(e: MediaQueryListEvent) => void>();
    const mql: MediaQueryList = {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: EventListenerOrEventListenerObject) => {
        listeners.add(cb as (e: MediaQueryListEvent) => void);
      },
      removeEventListener: (_: string, cb: EventListenerOrEventListenerObject) => {
        listeners.delete(cb as (e: MediaQueryListEvent) => void);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    };
    return mql;
  };
}

afterEach(() => {
  cleanup();
  // Reset theme-related side effects on <html> so tests stay isolated.
  try {
    document.documentElement.classList.remove('dark');
    window.localStorage.removeItem('phylax-theme');
    // Restore the default-DE pin. Tests that cleared it to exercise
    // EN detection have already asserted their path; resetting here
    // keeps subsequent tests on the DE baseline.
    window.localStorage.setItem('phylax-language', 'de');
  } catch {
    // ignore if localStorage is unavailable
  }
});
