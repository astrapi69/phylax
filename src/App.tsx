import { useState, useEffect, useCallback } from 'react';
import { useAutoLock } from './features/auto-lock';
import { UpdatePrompt } from './features/pwa-update';
import { DEFAULT_SETTINGS } from './db/settings';
import { setupServiceWorker } from './pwa/registerServiceWorker';
import { AppRoutes } from './router/routes';

function App() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<(() => void) | null>(null);

  // Auto-lock: hook only runs its timer when keyStore is unlocked
  useAutoLock(DEFAULT_SETTINGS.autoLockMinutes);

  // Register service worker
  useEffect(() => {
    const doUpdate = setupServiceWorker(() => {
      setNeedRefresh(true);
    });
    setUpdateSW(() => doUpdate);
  }, []);

  const handleUpdate = useCallback(() => {
    if (updateSW) {
      updateSW();
    }
  }, [updateSW]);

  const handleDismiss = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  return (
    <>
      <AppRoutes />
      <UpdatePrompt needRefresh={needRefresh} onUpdate={handleUpdate} onDismiss={handleDismiss} />
    </>
  );
}

export default App;
