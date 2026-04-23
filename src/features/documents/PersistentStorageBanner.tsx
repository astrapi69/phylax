import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfileRepository } from '../../db/repositories';
import { usePersistentStorage } from './usePersistentStorage';

export interface PersistentStorageBannerProps {
  /**
   * Caller-owned refetch trigger. Bump after an upload so the
   * underlying persistence probe picks up a state change if
   * `persist()` was just called.
   */
  versionKey?: number;
}

/**
 * localStorage key template for per-profile dismiss flag. Per-profile
 * (not global) because Phylax has a multi-profile phase on the
 * roadmap (Phase 8); one profile dismissing should not suppress the
 * banner on another profile that might benefit from seeing it.
 */
function dismissKey(profileId: string): string {
  return `phylax.persistence.dismissed.${profileId}`;
}

/**
 * Banner shown when the browser denied persistent-storage permission.
 * Amber (degraded-state) styling — data is still stored, just
 * evictable under storage pressure. Not a red alert; red is
 * reserved for hard failures (upload failed, decrypt failed).
 *
 * Dismiss is per-device + per-profile via localStorage. Once
 * dismissed, the banner stays hidden on that device across reloads.
 * The underlying denial is still a real state; the banner just
 * stops shouting about it.
 *
 * Renders nothing for any state other than `denied`, and nothing
 * when the user has previously dismissed the banner for the
 * current profile. No profile yet → nothing to dismiss against →
 * silent.
 */
export function PersistentStorageBanner({ versionKey }: PersistentStorageBannerProps) {
  const { t } = useTranslation('documents');
  const { state } = usePersistentStorage({ versionKey });
  const [profileId, setProfileId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await new ProfileRepository().getCurrentProfile();
        if (cancelled) return;
        if (!profile) return;
        setProfileId(profile.id);
        try {
          const stored = window.localStorage.getItem(dismissKey(profile.id));
          if (stored === '1') setDismissed(true);
        } catch {
          // localStorage unavailable (privacy modes, quota): treat
          // as not-dismissed. Banner may re-appear on every load;
          // that is acceptable degraded behavior.
        }
      } catch {
        // Profile lookup failed: surface nothing. Worst case the
        // banner does not render; the denial message is not
        // critical path.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (!profileId) return;
    try {
      window.localStorage.setItem(dismissKey(profileId), '1');
    } catch {
      // Write failed: state flag is still set for the current
      // session, just won't survive a reload. Acceptable.
    }
  }, [profileId]);

  if (state.kind !== 'denied') return null;
  if (dismissed) return null;

  return (
    <section
      role="alert"
      className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
      data-testid="persistent-storage-banner"
    >
      <p className="flex-1" data-testid="persistent-storage-banner-message">
        {t('persistence.denied')}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('persistence.dismiss')}
        className="shrink-0 rounded-md p-1 text-amber-800 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/40"
        data-testid="persistent-storage-dismiss-btn"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </section>
  );
}
