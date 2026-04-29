import { useEffect } from 'react';
import { useAutoLock } from './features/auto-lock';
import { DEFAULT_SETTINGS } from './db/settings';
import { setupServiceWorker } from './pwa/registerServiceWorker';
import { AppRoutes } from './router/routes';

function App() {
  // Auto-lock: hook only runs its timer when keyStore is unlocked
  useAutoLock(DEFAULT_SETTINGS.autoLockMinutes);

  // Register the service worker for silent background updates.
  // BUG-01 follow-up (no UI prompt): `registerType: 'prompt'` plus
  // workbox `skipWaiting: true` + `clientsClaim: false` means the
  // new SW installs and activates without ever taking over the
  // existing tab. The user gets the update on their next F5 /
  // navigation. We discard the returned `updateSW` because nothing
  // in the app calls it any more — calling it would re-introduce
  // the BUG-01 mid-session reload.
  useEffect(() => {
    setupServiceWorker(() => undefined);
  }, []);

  return <AppRoutes />;
}

export default App;
