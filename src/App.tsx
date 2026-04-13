import { useState, useEffect, useCallback } from 'react';
import { metaExists } from './db/meta';
import { getLockState, onLockStateChange } from './crypto';
import { OnboardingFlow } from './features/onboarding';
import { UnlockScreen } from './features/unlock';
import { useAutoLock } from './features/auto-lock';
import { UpdatePrompt } from './features/pwa-update';
import { DEFAULT_SETTINGS } from './db/settings';
import { setupServiceWorker } from './pwa/registerServiceWorker';

type AppScreen = 'loading' | 'onboarding' | 'locked' | 'main';

function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<(() => void) | null>(null);

  // Auto-lock: active when app is in any state (hook internally
  // only runs its timer when keyStore is unlocked)
  useAutoLock(DEFAULT_SETTINGS.autoLockMinutes);

  // Register service worker
  useEffect(() => {
    const doUpdate = setupServiceWorker(() => {
      setNeedRefresh(true);
    });
    setUpdateSW(() => doUpdate);
  }, []);

  useEffect(() => {
    metaExists().then((exists) => {
      if (!exists) {
        setScreen('onboarding');
      } else if (getLockState() === 'unlocked') {
        setScreen('main');
      } else {
        setScreen('locked');
      }
    });
  }, []);

  // Subscribe to lock state changes so auto-lock (or manual lock)
  // transitions the screen back to locked
  useEffect(() => {
    const unsubscribe = onLockStateChange((state) => {
      if (state === 'locked') {
        setScreen((current) => (current === 'main' ? 'locked' : current));
      }
    });
    return unsubscribe;
  }, []);

  const handleUpdate = useCallback(() => {
    if (updateSW) {
      updateSW();
    }
  }, [updateSW]);

  const handleDismiss = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  if (screen === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  if (screen === 'onboarding') {
    return (
      <>
        <OnboardingFlow onComplete={() => setScreen('main')} />
        <UpdatePrompt needRefresh={needRefresh} onUpdate={handleUpdate} onDismiss={handleDismiss} />
      </>
    );
  }

  if (screen === 'locked') {
    return (
      <>
        <UnlockScreen onUnlocked={() => setScreen('main')} />
        <UpdatePrompt needRefresh={needRefresh} onUpdate={handleUpdate} onDismiss={handleDismiss} />
      </>
    );
  }

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <h1 className="text-2xl font-bold text-gray-900">Phylax</h1>
      </div>
      <UpdatePrompt needRefresh={needRefresh} onUpdate={handleUpdate} onDismiss={handleDismiss} />
    </>
  );
}

export default App;
