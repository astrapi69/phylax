import type { Observation } from '../../domain';
import { db } from '../schema';
import { EncryptedRepository } from './encryptedRepository';

/**
 * Repository for Observation entities.
 *
 * Extends EncryptedRepository with theme-based querying.
 * Observations are the core unit of the living health profile:
 * each one has a fact/pattern/selfRegulation triad plus a flexible
 * extraSections map with German keys.
 *
 * Theme filtering and deduplication happen in-memory after decryption
 * because theme is inside the encrypted payload (ADR-0005).
 */
export class ObservationRepository extends EncryptedRepository<Observation> {
  constructor() {
    super(db.observations);
  }

  /**
   * List observations for a profile filtered by theme.
   * Loads all observations, decrypts, then filters in memory.
   */
  async listByTheme(profileId: string, theme: string): Promise<Observation[]> {
    const all = await this.listByProfile(profileId);
    return all.filter((obs) => obs.theme === theme);
  }

  /**
   * List distinct themes for a profile.
   * Loads all observations, decrypts, extracts themes, deduplicates.
   */
  async listThemes(profileId: string): Promise<string[]> {
    const all = await this.listByProfile(profileId);
    return [...new Set(all.map((obs) => obs.theme))];
  }
}
