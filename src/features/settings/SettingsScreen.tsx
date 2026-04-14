import { ThemeSection } from './ThemeSection';

/**
 * Settings screen. Currently hosts only the theme picker. Future settings
 * (auto-lock timeout, language, API key management, etc.) attach as more
 * sections here.
 */
export function SettingsScreen() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Einstellungen</h1>
      <ThemeSection />
    </div>
  );
}
