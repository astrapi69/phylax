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
   * List all profiles in the database.
   *
   * Order is insertion order. Callers that need a specific order
   * should sort by `createdAt` on the returned array.
   *
   * Intended for the import flow's profile selection UI. The MVP still
   * enforces single-profile semantics elsewhere; this method does not
   * change that constraint, it only surfaces what already exists.
   */
  async list(): Promise<Profile[]> {
    const rows = await this.table.toArray();
    return Promise.all(rows.map((row) => this.deserialize(row)));
  }

  /**
   * Get the active profile. Returns null if no profile exists.
   *
   * Resolution order (M-04):
   *   1. If `phylax-active-profile` localStorage holds an id that
   *      matches an existing profile, return that profile.
   *   2. Otherwise, return the first profile in insertion order.
   *   3. If the database is empty, return null.
   *
   * Step 1 keeps the repository layer compatible with the React-side
   * `ActiveProfileContext` (which is the canonical source for the UI)
   * without forcing the repository to depend on React. Both readers
   * consult the same storage key. Step 2 keeps single-profile
   * installations working without any UI activation step.
   *
   * Renamed from the MVP-era single-profile semantic; callers that
   * specifically want "the only profile" should grep the codebase and
   * decide whether their context still applies under multi-profile.
   */
  async getCurrentProfile(): Promise<Profile | null> {
    const rows = await this.table.toArray();
    if (rows.length === 0) return null;

    const storedId = readStoredActiveProfileId();
    if (storedId !== null) {
      const match = rows.find((r) => r.id === storedId);
      if (match) return this.deserialize(match);
    }
    return this.deserialize(rows[0] as (typeof rows)[number]);
  }
}

function readStoredActiveProfileId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem('phylax-active-profile');
    return v === null || v === '' ? null : v;
  } catch {
    return null;
  }
}
