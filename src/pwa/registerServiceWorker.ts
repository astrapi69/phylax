import { registerSW } from 'virtual:pwa-register';

/**
 * Register the service worker and expose update callbacks.
 *
 * Uses vite-plugin-pwa's auto-update registration. When a new service
 * worker is installed and waiting, the onNeedRefresh callback fires.
 * Call the returned updateServiceWorker function to apply the update.
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
