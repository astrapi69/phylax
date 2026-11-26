import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProfileRepository } from '../../db/repositories';
import { getDisplayName } from '../../domain';
import { useActiveProfile } from './ActiveProfileProvider';
import { subscribeProfilesChanged } from './profilesChanged';

interface LoadedLabel {
  /** The active profile id the name was loaded for. */
  forProfileId: string | null;
  name: string | null;
}

/**
 * Display name of the active profile, for showing in the app header
 * (M-09). Returns null when there is nothing to distinguish: fewer than
 * two profiles, no active profile, or the vault cannot be read.
 *
 * The id comes from the active-profile context; the name is read from
 * the repository because the context deliberately holds the selection
 * only. It reloads when the active profile changes (including a switch
 * in another tab, which the provider syncs), on every navigation, when
 * `notifyProfilesChanged()` is called and when the language changes,
 * since an unnamed profile shows a translated fallback.
 *
 * A name is only returned for the profile id it was loaded for, so a
 * switch never shows the previous profile's name while the new one
 * loads.
 */
export function useActiveProfileLabel(): string | null {
  const { activeProfileId } = useActiveProfile();
  const { key: locationKey } = useLocation();
  const { i18n } = useTranslation();
  const language = i18n.language;
  const [changeCount, setChangeCount] = useState(0);
  const [loaded, setLoaded] = useState<LoadedLabel>({ forProfileId: null, name: null });

  useEffect(() => subscribeProfilesChanged(() => setChangeCount((count) => count + 1)), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let name: string | null = null;
      try {
        const profiles = await new ProfileRepository().list();
        const active = profiles.find((profile) => profile.id === activeProfileId);
        if (profiles.length > 1 && active) name = getDisplayName(active);
      } catch {
        // Locked keystore or unreadable vault: show no name. The header
        // must never fail because of this lookup.
      }
      if (!cancelled) setLoaded({ forProfileId: activeProfileId, name });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, locationKey, changeCount, language]);

  return loaded.forProfileId === activeProfileId ? loaded.name : null;
}
