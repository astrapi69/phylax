/**
 * Pin the i18n test-environment default to German BEFORE any other
 * module (including `src/i18n/config`) is imported. After I18N-02-e,
 * `src/i18n/config.ts` calls `detectInitialLanguage()` at module load,
 * which reads `localStorage['phylax-language']` then falls through to
 * `navigator.language` (jsdom defaults to `en-US`). Without this pin,
 * the existing DE-centric test suite would flip to rendering English
 * strings.
 *
 * Listed first in `vite.config.ts` -> `test.setupFiles` to guarantee
 * it runs before any setup file that indirectly imports i18n. Tests
 * that need to exercise the detector or EN path clear this key
 * explicitly in their own `beforeEach`.
 */

try {
  window.localStorage.setItem('phylax-language', 'de');
} catch {
  /* ignore when localStorage is unavailable */
}
