import { registerSW } from 'virtual:pwa-register';

/**
 * Register the service worker and expose update callbacks.
 *
 * Paired with `registerType: 'prompt'` in vite.config.ts (BUG-01 fix).
 * In prompt mode the new SW installs in the background and the
 * `onNeedRefresh` callback fires as soon as it is waiting; the
 * caller surfaces the existing UpdatePrompt toast and the user
 * decides when to reload. The returned function calls
 * `updateSW(true)` which activates the waiting SW and reloads — do
 * not call it from outside an explicit user gesture, otherwise the
 * mid-session reload that motivated BUG-01 returns through the
 * back door.
 *
 * @param onNeedRefresh - called when a new version is ready to install
 * @returns updateServiceWorker - call to reload with the new version
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
