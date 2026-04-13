import type { TimelineEntry } from '../../domain';
import { db } from '../schema';
import { EncryptedRepository } from './encryptedRepository';

/**
 * Repository for TimelineEntry entities (Verlaufsnotizen).
 *
 * Timeline entries are date-bounded, narrative, and retrospective.
 * They are distinct from Observations (C1 strategy, ADR-0007).
 *
 * Sort key is createdAt (import timestamp), not period. Period is
 * a free-text display label that does not sort reliably.
 */
export class TimelineEntryRepository extends EncryptedRepository<TimelineEntry> {
  constructor() {
    super(db.timelineEntries);
  }

  /**
   * List all timeline entries for a profile, sorted by createdAt ascending.
   * Uses the inherited listByProfileChronological from the base class.
   */
  async listChronological(profileId: string): Promise<TimelineEntry[]> {
    return this.listByProfileChronological(profileId);
  }
}
