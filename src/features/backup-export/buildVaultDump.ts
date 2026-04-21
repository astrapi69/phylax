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
  return entities as unknown as DomainRow[];
}

export async function buildVaultDump(): Promise<BuildDumpResult> {
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

    const dump: VaultDump = {
      schemaVersion: SUPPORTED_INNER_SCHEMA_VERSION,
      rows: {
        profiles: toDomainRows(profiles),
        observations: toDomainRows(observations),
        lab_values: toDomainRows(labValues),
        lab_reports: toDomainRows(labReports),
        supplements: toDomainRows(supplements),
        open_points: toDomainRows(openPoints),
        profile_versions: toDomainRows(profileVersions),
        documents: toDomainRows(documents),
        timeline_entries: toDomainRows(timelineEntries),
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
