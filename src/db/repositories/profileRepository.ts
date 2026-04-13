import { generateId } from '../../crypto';
import type { Profile } from '../../domain';
import { db } from '../schema';
import { EncryptedRepository } from './encryptedRepository';

/**
 * Repository for Profile entities.
 *
 * Extends EncryptedRepository with Profile-specific behavior:
 * - create() sets profileId = id (self-reference) so every other entity's
 *   profileId FK points to a consistent namespace
 * - getCurrentProfile() returns the single profile in the MVP
 *
 * In the MVP there is exactly one profile per installation.
 * Multi-profile support (Phase 8) will add profile switching logic.
 */
export class ProfileRepository extends EncryptedRepository<Profile> {
  constructor() {
    super(db.profiles);
  }

  /**
   * Create a new profile. Sets profileId = id (self-reference).
   *
   * The caller does not pass id, profileId, createdAt, or updatedAt.
   * All are auto-generated.
   */
  async create(
    data: Omit<Profile, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Profile> {
    const id = generateId();
    const now = Date.now();
    const entity: Profile = {
      ...data,
      id,
      profileId: id,
      createdAt: now,
      updatedAt: now,
    };

    const row = await this.serialize(entity);
    await this.table.put(row);
    return entity;
  }

  /**
   * Get the current (single) profile. Returns null if no profile exists.
   *
   * In the MVP there is at most one profile. If multiple exist (future
   * multi-profile support), returns the first and logs a warning.
   */
  async getCurrentProfile(): Promise<Profile | null> {
    const rows = await this.table.toArray();
    if (rows.length === 0) return null;

    if (rows.length > 1) {
      console.warn(
        `Found ${rows.length} profiles; returning first. Multi-profile support is not yet implemented.`,
      );
    }

    // Safe: rows.length > 0 guaranteed by the check above
    return this.deserialize(rows[0] as (typeof rows)[number]);
  }
}
