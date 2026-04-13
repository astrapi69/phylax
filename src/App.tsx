import { useState, useEffect } from 'react';
import { metaExists } from './db/meta';
import { getLockState } from './crypto';
import { OnboardingFlow } from './features/onboarding';
import { UnlockScreen } from './features/unlock';

type AppScreen = 'loading' | 'onboarding' | 'locked' | 'main';

function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');

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

  if (screen === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  if (screen === 'onboarding') {
    return <OnboardingFlow onComplete={() => setScreen('main')} />;
  }

  if (screen === 'locked') {
    return <UnlockScreen onUnlocked={() => setScreen('main')} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-900">Phylax</h1>
    </div>
  );
}

export default App;
