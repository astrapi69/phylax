import { useEffect } from 'react';
import { useAutoLock, useSavedAutoLockMinutes } from './features/auto-lock';
import { setupServiceWorker } from './pwa/registerServiceWorker';
import { AppRoutes } from './router/routes';

function App() {
  // P-05: read the persisted auto-lock-minutes setting from the
  // encrypted MetaPayload after each unlock and feed it to
  // useAutoLock. While locked the hook returns the default (5min);
  // once the user unlocks, the saved value (if any) replaces it and
  // the timer restarts. AutoLockSection in Settings writes the value
  // via saveAppSettings; the change applies on the next unlock.
  const autoLockMinutes = useSavedAutoLockMinutes();
  useAutoLock(autoLockMinutes);

  // Register the service worker for silent background updates.
  // BUG-01 follow-up (no UI prompt): `registerType: 'prompt'` plus
  // workbox `skipWaiting: true` + `clientsClaim: false` means the
  // new SW installs and activates without ever taking over the
  // existing tab. The user gets the update on their next F5 /
  // navigation. We discard the returned `updateSW` because nothing
  // in the app calls it any more - calling it would re-introduce
  // the BUG-01 mid-session reload.
  useEffect(() => {
    setupServiceWorker(() => undefined);
  }, []);

  return <AppRoutes />;
}

export default App;
