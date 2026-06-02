/**
 * Assemble a `VaultDump` from the live encrypted vault.
 *
 * Reads every table via its repository so each row is returned
 * decrypted, validated by the existing deserialize path. Also reads
 * the meta row's payload (auto-lock settings) so the consumer-side
 * `populateVault` can restore those settings verbatim.
 *
 * This module does NOT talk to `crypto.subtle` directly - everything
 * goes through the repository layer. It also does NOT re-encrypt:
 * the VaultDump is plaintext domain objects that the backup-export
 * encryption step serializes and encrypts under a fresh key.
 *
 * The key store must be unlocked. Repository reads throw otherwise;
 * the caller surfaces that as `locked`.
 */

import { getLockState, decryptWithStoredKey } from '../../crypto';
import {
  ProfileRepository,
  ObservationRepository,
  LabValueRepository,
  LabReportRepository,
  SupplementRepository,
  OpenPointRepository,
  ProfileVersionRepository,
  DocumentRepository,
  TimelineEntryRepository,
} from '../../db/repositories';
import { readMeta } from '../../db/meta';
import { decodeMetaPayload } from '../../db/settings';
import type { VaultDump, DomainRow } from '../backup-import/decryptBackup';
import { SUPPORTED_INNER_SCHEMA_VERSION } from '../backup-import/decryptBackup';

export type BuildDumpError =
  | { kind: 'locked' }
  | { kind: 'no-meta' }
  | { kind: 'read-failed'; detail: string };

export type BuildDumpResult = { ok: true; dump: VaultDump } | { ok: false; error: BuildDumpError };

function toDomainRows<
  T extends { id: string; profileId: string; createdAt: number; updatedAt: number },
>(entities: T[]): DomainRow[] {
  // Reason: every entity table satisfies the DomainRow shape (id +
  // profileId + createdAt + updatedAt) by construction in the
  // repository layer. The double-cast acknowledges that TS cannot
  // see this structural equivalence across the heterogeneous T
  // generic without a runtime check we do not need.
  return entities as unknown as DomainRow[];
}

/**
 * Optional filter applied to every row's `profileId`. When passed, the
 * dump only includes rows whose `profileId` is in the set. When omitted
 * (the default), the dump contains every row in the vault. M-05 uses
 * this to back up just the active profile so multi-profile users can
 * share or restore one profile at a time.
 */
export interface BuildVaultDumpOptions {
  readonly profileIds?: readonly string[];
}

export async function buildVaultDump(options?: BuildVaultDumpOptions): Promise<BuildDumpResult> {
  if (getLockState() !== 'unlocked') {
    return { ok: false, error: { kind: 'locked' } };
  }

  try {
    const labValueRepo = new LabValueRepository();
    const [
      profiles,
      observations,
      labValues,
      labReports,
      supplements,
      openPoints,
      profileVersions,
      documents,
      timelineEntries,
    ] = await Promise.all([
      new ProfileRepository().listAll(),
      new ObservationRepository().listAll(),
      labValueRepo.listAll(),
      new LabReportRepository(labValueRepo).listAll(),
      new SupplementRepository().listAll(),
      new OpenPointRepository().listAll(),
      new ProfileVersionRepository().listAll(),
      new DocumentRepository().listAll(),
      new TimelineEntryRepository().listAll(),
    ]);

    const meta = await readMeta();
    if (!meta) {
      return { ok: false, error: { kind: 'no-meta' } };
    }

    const decryptedMeta = await decryptWithStoredKey(new Uint8Array(meta.payload));
    const metaPayload = decodeMetaPayload(decryptedMeta);

    const profileFilter = options?.profileIds;
    const allowed = profileFilter && profileFilter.length > 0 ? new Set(profileFilter) : null;
    const keep = <T extends { profileId: string; id: string }>(rows: T[]): T[] =>
      allowed === null ? rows : rows.filter((r) => allowed.has(r.profileId) || allowed.has(r.id));

    const dump: VaultDump = {
      schemaVersion: SUPPORTED_INNER_SCHEMA_VERSION,
      rows: {
        profiles: toDomainRows(keep(profiles)),
        observations: toDomainRows(keep(observations)),
        lab_values: toDomainRows(keep(labValues)),
        lab_reports: toDomainRows(keep(labReports)),
        supplements: toDomainRows(keep(supplements)),
        open_points: toDomainRows(keep(openPoints)),
        profile_versions: toDomainRows(keep(profileVersions)),
        documents: toDomainRows(keep(documents)),
        timeline_entries: toDomainRows(keep(timelineEntries)),
      },
      meta_settings: {
        verificationToken: metaPayload.verificationToken,
        settings: metaPayload.settings,
      },
    };

    return { ok: true, dump };
  } catch (err) {
    return { ok: false, error: { kind: 'read-failed', detail: String(err) } };
  }
}
