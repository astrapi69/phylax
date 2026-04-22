import { getLockState } from '../crypto';
import { metaExists } from '../db/meta';

/**
 * Coarse auth state observed from the vault + keystore. Consumed by the
 * router guards. Deliberately state-framed (not destination-framed): each
 * consumer owns its own policy for mapping state to an action.
 *
 * - `no-vault`: no meta row in IndexedDB. First-run user.
 * - `locked`:   meta row exists, keystore is locked.
 * - `unlocked`: meta row exists, keystore is unlocked (active session).
 */
export type AuthState = 'no-vault' | 'locked' | 'unlocked';

/**
 * Single source of truth for the auth-gate decision. Consumed by
 * EntryRouter, ProtectedRoute, and SetupFlowGuard. Pure: no React, no
 * navigation side effects, no error swallowing.
 *
 * `metaExists()` is async (IndexedDB read). `getLockState()` is sync
 * (in-memory key-store probe). The early-return on `no-vault` is
 * deliberate: the locked/unlocked distinction does not matter when
 * there is no vault to unlock.
 *
 * Rejection is propagated to the caller so each consumer can decide
 * its own fail policy: SetupFlowGuard fails open (allow setup flow);
 * EntryRouter and ProtectedRoute do not explicitly handle rejection
 * today (out of scope for TD-06).
 */
export async function resolveAuthState(): Promise<AuthState> {
  if (!(await metaExists())) return 'no-vault';
  return getLockState() === 'locked' ? 'locked' : 'unlocked';
}
