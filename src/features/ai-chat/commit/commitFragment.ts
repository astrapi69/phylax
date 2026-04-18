import { db } from '../../../db/schema';
import {
  ObservationRepository,
  OpenPointRepository,
  ProfileRepository,
  ProfileVersionRepository,
  SupplementRepository,
} from '../../../db/repositories';
import { generateId } from '../../../crypto';
import type { Observation, OpenPoint, Profile, ProfileVersion, Supplement } from '../../../domain';
import type { ProfileDiff } from './computeDiff';

export interface CommitOptions {
  diff: ProfileDiff;
  versionDescription: string;
  profileId: string;
}

export interface CommitResult {
  observationsCreated: number;
  observationsUpdated: number;
  supplementsCreated: number;
  supplementsUpdated: number;
  openPointsCreated: number;
  newVersion: string;
}

/**
 * Apply a ProfileDiff to the database atomically.
 *
 * Mirrors the pattern from importProfile (ADR around IM-03a): pre-encrypt
 * every row outside the transaction because Dexie commits the transaction
 * as soon as control yields on a non-Dexie promise, and `crypto.subtle`
 * is a non-Dexie promise. Once every row is serialized, a single
 * rw transaction over profiles, observations, supplements, open_points,
 * and profile_versions writes them all. On any failure Dexie rolls the
 * whole transaction back.
 *
 * Provenance:
 * - New observations are written with `source: 'ai'`.
 * - Updated observations keep their existing `source` (a user-entered
 *   observation that AI helps polish stays 'user'; the version entry
 *   captures the AI involvement).
 *
 * Versioning:
 * - The Profile.version field gets a patch bump (1.3.1 -> 1.3.2) on
 *   every commit.
 * - A ProfileVersion row is created with the bumped version, the
 *   caller-supplied changeDescription, and today's ISO date.
 */
export async function commitFragment(options: CommitOptions): Promise<CommitResult> {
  const { diff, versionDescription, profileId } = options;

  const profileRepo = new ProfileRepository();
  const observationRepo = new ObservationRepository();
  const supplementRepo = new SupplementRepository();
  const openPointRepo = new OpenPointRepository();
  const versionRepo = new ProfileVersionRepository();

  const existingProfile = await profileRepo.getById(profileId);
  if (!existingProfile) {
    throw new Error('Profil nicht gefunden.');
  }

  const now = Date.now();
  const today = formatIsoDate(now);
  const newVersion = bumpVersion(existingProfile.version);

  // Pre-encryption: every row is serialized before the transaction body
  // runs. If the key store is locked, encryptWithStoredKey throws here
  // and Dexie is never opened, so there is no partial write to roll back.
  const newObservationRows = await Promise.all(
    diff.observations.new.map((parsed) => {
      const entity: Observation = {
        ...parsed,
        id: generateId(),
        profileId,
        createdAt: now,
        updatedAt: now,
        source: 'ai',
      };
      return observationRepo.serialize(entity);
    }),
  );

  const changedObservationRows = await Promise.all(
    diff.observations.changed.map((change) => {
      const entity: Observation = {
        ...change.merged,
        updatedAt: now,
      };
      return observationRepo.serialize(entity);
    }),
  );

  const newSupplementRows = await Promise.all(
    diff.supplements.new.map((parsed) => {
      const entity: Supplement = {
        ...parsed,
        id: generateId(),
        profileId,
        createdAt: now,
        updatedAt: now,
      };
      return supplementRepo.serialize(entity);
    }),
  );

  const changedSupplementRows = await Promise.all(
    diff.supplements.changed.map((change) => {
      const entity: Supplement = {
        ...change.merged,
        updatedAt: now,
      };
      return supplementRepo.serialize(entity);
    }),
  );

  const newOpenPointRows = await Promise.all(
    diff.openPoints.new.map((parsed) => {
      const entity: OpenPoint = {
        ...parsed,
        id: generateId(),
        profileId,
        createdAt: now,
        updatedAt: now,
      };
      return openPointRepo.serialize(entity);
    }),
  );

  const versionEntity: ProfileVersion = {
    id: generateId(),
    profileId,
    createdAt: now,
    updatedAt: now,
    version: newVersion,
    changeDescription: versionDescription,
    changeDate: today,
  };
  const versionRow = await versionRepo.serialize(versionEntity);

  const updatedProfile: Profile = {
    ...existingProfile,
    version: newVersion,
    updatedAt: now,
  };
  const profileRow = await profileRepo.serialize(updatedProfile);

  await db.transaction(
    'rw',
    [db.profiles, db.observations, db.supplements, db.openPoints, db.profileVersions],
    async () => {
      await Promise.all([
        db.profiles.put(profileRow),
        ...newObservationRows.map((r) => db.observations.put(r)),
        ...changedObservationRows.map((r) => db.observations.put(r)),
        ...newSupplementRows.map((r) => db.supplements.put(r)),
        ...changedSupplementRows.map((r) => db.supplements.put(r)),
        ...newOpenPointRows.map((r) => db.openPoints.put(r)),
        db.profileVersions.put(versionRow),
      ]);
    },
  );

  return {
    observationsCreated: diff.observations.new.length,
    observationsUpdated: diff.observations.changed.length,
    supplementsCreated: diff.supplements.new.length,
    supplementsUpdated: diff.supplements.changed.length,
    openPointsCreated: diff.openPoints.new.length,
    newVersion,
  };
}

/**
 * Map a CommitResult into a German sentence for the chat transcript.
 * Empty counts are omitted so a "supplements-only" commit does not
 * announce "0 Beobachtungen".
 */
export function commitSummaryText(result: CommitResult): string {
  const parts: string[] = [];
  const obsTotal = result.observationsCreated + result.observationsUpdated;
  if (obsTotal > 0) {
    parts.push(`${obsTotal} ${obsTotal === 1 ? 'Beobachtung' : 'Beobachtungen'}`);
  }
  const suppTotal = result.supplementsCreated + result.supplementsUpdated;
  if (suppTotal > 0) {
    parts.push(`${suppTotal} ${suppTotal === 1 ? 'Supplement' : 'Supplemente'}`);
  }
  if (result.openPointsCreated > 0) {
    parts.push(
      `${result.openPointsCreated} ${result.openPointsCreated === 1 ? 'offener Punkt' : 'offene Punkte'}`,
    );
  }
  if (parts.length === 0) {
    return `Profil-Update gespeichert (Version ${result.newVersion}).`;
  }
  return `Profil-Update gespeichert: ${parts.join(', ')} uebernommen (Version ${result.newVersion}).`;
}

/**
 * Increment the last numeric component of a dotted version, e.g.
 * 1.3.1 -> 1.3.2 or 1.0 -> 1.1. For anything that is not a dotted
 * number sequence, append or increment a "-aiN" suffix so the version
 * stays monotonically increasing without corrupting the original.
 */
export function bumpVersion(version: string): string {
  const trimmed = version.trim();
  const dotted = /^(\d+(?:\.\d+)*)\.(\d+)$/.exec(trimmed);
  if (dotted) {
    return `${dotted[1]}.${Number(dotted[2]) + 1}`;
  }
  const aiSuffix = /^(.+)-ai(\d+)$/.exec(trimmed);
  if (aiSuffix) {
    return `${aiSuffix[1]}-ai${Number(aiSuffix[2]) + 1}`;
  }
  return `${trimmed || '0'}-ai1`;
}

function formatIsoDate(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
