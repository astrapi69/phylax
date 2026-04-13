import type { ProfileVersion } from '../../domain';
import { db } from '../schema';
import { EncryptedRepository } from './encryptedRepository';

/**
 * Repository for ProfileVersion entities.
 *
 * Tracks the version history of the profile. Sorting by changeDate
 * (ISO date string) works lexicographically for ISO format.
 */
export class ProfileVersionRepository extends EncryptedRepository<ProfileVersion> {
  constructor() {
    super(db.profileVersions);
  }

  /**
   * List all versions for a profile, newest first.
   */
  async listByProfileNewestFirst(profileId: string): Promise<ProfileVersion[]> {
    const all = await this.listByProfile(profileId);
    return all.sort((a, b) => b.changeDate.localeCompare(a.changeDate));
  }

  /**
   * Get the most recent version entry. Returns null if none exist.
   */
  async getLatest(profileId: string): Promise<ProfileVersion | null> {
    const sorted = await this.listByProfileNewestFirst(profileId);
    return sorted[0] ?? null;
  }
}
