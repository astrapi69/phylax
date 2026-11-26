/**
 * In-memory signal that profile rows changed (M-09).
 *
 * The header names the active profile on every authenticated route. It
 * reloads that name when the active profile id changes and on every
 * navigation, but a rename in the profile view happens without either.
 * The code that saves the rename calls `notifyProfilesChanged()`, and
 * the header's hook reloads.
 *
 * Deliberately not persisted and not cross-tab: another tab reloads on
 * its next navigation, and a profile switch is synced by the storage
 * event in `ActiveProfileProvider`.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** Tell every subscriber that a profile was created, renamed or removed. */
export function notifyProfilesChanged(): void {
  for (const listener of [...listeners]) listener();
}

/**
 * Subscribe to profile changes.
 *
 * @returns the function that removes the subscription
 */
export function subscribeProfilesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
