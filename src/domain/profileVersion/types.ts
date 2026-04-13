import type { DomainEntity } from '../../db/repositories/encryptedRepository';

/**
 * A version history entry for the profile.
 *
 * Tracks what changed and when, creating an audit trail of
 * profile evolution over time.
 */
export interface ProfileVersion extends DomainEntity {
  /** Semantic version string, e.g. "1.3.1" */
  version: string;
  /** Description of what changed in this version */
  changeDescription: string;
  /** ISO date when this version was created */
  changeDate: string;
}
