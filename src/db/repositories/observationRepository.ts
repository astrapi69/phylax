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

  /**
   * List observations whose `sourceDocumentId` matches the given
   * document id. Used by the IMP-05 import-provenance reverse lookup
   * and by the D-08 cascade path that clears stale references when a
   * source Document is deleted.
   *
   * In-memory filter over `table.toArray()` since `sourceDocumentId`
   * lives inside the encrypted payload (no plaintext index, same
   * reasoning as the other repositories).
   */
  async listBySourceDocument(documentId: string): Promise<Observation[]> {
    const rows = await this.table.toArray();
    const decrypted = await Promise.all(rows.map((row) => this.deserialize(row)));
    return decrypted.filter((e) => e.sourceDocumentId === documentId);
  }
}
