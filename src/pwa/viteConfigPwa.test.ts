import { describe, it, expect } from 'vitest';
import viteConfigSource from '../../vite.config.ts?raw';

/**
 * BUG-01 regression guard.
 *
 * Two SW-config decisions together preserve the BUG-01 fix:
 *
 *  - `registerType: 'prompt'` keeps `vite-plugin-pwa` from calling
 *    `updateSW(true)` automatically. That call sends a SKIP_WAITING
 *    postMessage AND reloads the page; running mid-session it wipes
 *    the in-memory keyStore and bounces the just-unlocked user back
 *    to `/unlock`. `'autoUpdate'` triggers it on every update check.
 *
 *  - workbox `clientsClaim: false` keeps the new SW from taking
 *    over the running tab. Combined with `skipWaiting: true` the new
 *    SW activates the moment it finishes installing, but only for
 *    fresh navigations — the existing tab keeps running on the old
 *    SW until the user reloads. That is the silent-update UX:
 *    install in the background, apply on the user's next F5.
 *
 * `skipWaiting: true` alone is safe in this combination because the
 * mid-session reload that motivated BUG-01 came from
 * `updateSW(true)` (mechanism #2, the runtime postMessage), not
 * from workbox baking `self.skipWaiting()` into the install handler
 * (mechanism #1). With `'prompt'` mode the runtime call never
 * fires.
 *
 * A future refactor that flips any of these three values without
 * adjusting the others can silently re-introduce BUG-01. Manual
 * smoke barely catches it (the bug only repros under fast login
 * right after a fresh build / deploy), so this test asserts all
 * three constants directly via Vite's `?raw` import.
 */
describe('BUG-01: PWA SW config', () => {
  it('keeps registerType prompt so the plugin does not auto-reload mid-session', () => {
    expect(viteConfigSource).toMatch(/registerType:\s*'prompt'/);
    expect(viteConfigSource).not.toMatch(/registerType:\s*'autoUpdate'/);
  });

  it('sets workbox skipWaiting: true so the new SW activates without a waiting state', () => {
    expect(viteConfigSource).toMatch(/skipWaiting:\s*true/);
  });

  it('sets workbox clientsClaim: false so the new SW does not take over existing tabs', () => {
    expect(viteConfigSource).toMatch(/clientsClaim:\s*false/);
  });
});
