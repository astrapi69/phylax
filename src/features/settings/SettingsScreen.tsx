import { ThemeSection } from './ThemeSection';
import { AISettingsSection } from '../ai-config';
import { DonationSettingsSection } from '../donation';

/**
 * Settings screen. Hosts the theme picker, the AI configuration, and
 * the donation link. Future settings (auto-lock timeout, language,
 * etc.) attach as more sections here.
 */
export function SettingsScreen() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Einstellungen</h1>
      <ThemeSection />
      <AISettingsSection />
      <DonationSettingsSection />
    </div>
  );
}
