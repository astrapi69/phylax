import { describe, it, expect } from 'vitest';
import viteConfigSource from '../../vite.config.ts?raw';

/**
 * BUG-01 regression guard.
 *
 * `registerType: 'autoUpdate'` reloads the page mid-session whenever
 * a new SW activates via clientsClaim, wiping the in-memory keyStore
 * and redirecting the just-unlocked user back to /unlock. Phylax
 * runs in `'prompt'` mode (the existing UpdatePrompt toast surfaces
 * the new version; the user reloads at a safe time of their choosing).
 *
 * If a future refactor flips this back to 'autoUpdate' the bug
 * returns silently — manual smoke is the only way to catch it,
 * because it only reproduces when the SW updates while the user
 * is actively logging in. This test guards the constant directly
 * by reading vite.config.ts as raw text via Vite's `?raw` import.
 */
describe('BUG-01: PWA registerType', () => {
  it('uses prompt mode (not autoUpdate) so SW updates do not reload mid-session', () => {
    expect(viteConfigSource).toMatch(/registerType:\s*'prompt'/);
    expect(viteConfigSource).not.toMatch(/registerType:\s*'autoUpdate'/);
  });
});
