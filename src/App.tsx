import { useAutoLock } from './features/auto-lock';
import { UpdateProvider } from './features/pwa-update';
import { DEFAULT_SETTINGS } from './db/settings';
import { AppRoutes } from './router/routes';

function App() {
  // Auto-lock: hook only runs its timer when keyStore is unlocked
  useAutoLock(DEFAULT_SETTINGS.autoLockMinutes);

  return (
    <UpdateProvider>
      <AppRoutes />
    </UpdateProvider>
  );
}

export default App;
