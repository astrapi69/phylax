import { registerSW } from 'virtual:pwa-register';

/**
 * Register the service worker.
 *
 * Paired with `registerType: 'prompt'` + workbox `skipWaiting: true`
 * + `clientsClaim: false` in vite.config.ts. New SW installs and
 * activates silently in the background; the existing tab stays on
 * the old SW until the user navigates / reloads, at which point the
 * fresh navigation is served by the new active SW.
 *
 * The returned `updateSW(true)` is intentionally unused by the app:
 * calling it sends a SKIP_WAITING postMessage AND reloads the page
 * programmatically, which is the BUG-01 mid-session reload that
 * wipes the in-memory keyStore. Phylax has no UI that triggers it.
 * The hook is still surfaced in the type signature so a future
 * consumer (e.g. an explicit "Update jetzt anwenden" admin gesture)
 * can opt into the reload semantics deliberately.
 *
 * @param onNeedRefresh - called when a new SW is waiting; left as a
 *   no-op by the current caller, kept in the signature so prompt
 *   mode behaviour stays untouched if a future feature wants it
 * @returns updateServiceWorker - call to apply the new version
 *   (sends SKIP_WAITING + reloads). Do not invoke outside an
 *   explicit user gesture, otherwise BUG-01 returns through the
 *   back door.
 */
export function setupServiceWorker(onNeedRefresh: () => void): () => void {
  const updateSW = registerSW({
    onNeedRefresh() {
      onNeedRefresh();
    },
    onOfflineReady() {
      // Silently ready for offline use. No UI needed.
    },
  });

  return () => {
    updateSW(true);
  };
}
