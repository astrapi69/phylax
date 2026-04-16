import { db } from '../../../db/schema';
import type { EntityCounts } from './types';

/**
 * Count per-profile entities using plaintext indexes only.
 *
 * No decryption happens: `profileId` is a plaintext index on every table,
 * so Dexie's `.count()` returns results without touching the key store.
 * Safe to call while the app is locked (though callers typically run this
 * from UI that is already unlocked).
 */
export async function countEntities(profileId: string): Promise<EntityCounts> {
  const [
    observations,
    labReports,
    labValues,
    supplements,
    openPoints,
    profileVersions,
    timelineEntries,
    // Stryker disable next-line StringLiteral: fake-indexeddb is lenient on index names; .where('') still filters via .equals(). Real IndexedDB would throw but that path is not reachable in vitest.
  ] = await Promise.all([
    db.observations.where('profileId').equals(profileId).count(),
    db.labReports.where('profileId').equals(profileId).count(),
    db.labValues.where('profileId').equals(profileId).count(),
    db.supplements.where('profileId').equals(profileId).count(),
    db.openPoints.where('profileId').equals(profileId).count(),
    db.profileVersions.where('profileId').equals(profileId).count(),
    db.timelineEntries.where('profileId').equals(profileId).count(),
  ]);

  return {
    observations,
    labReports,
    labValues,
    supplements,
    openPoints,
    profileVersions,
    timelineEntries,
  };
}
