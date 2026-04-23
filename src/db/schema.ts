import Dexie from 'dexie';
import type {
  ProfileRow,
  ObservationRow,
  LabValueRow,
  LabReportRow,
  SupplementRow,
  OpenPointRow,
  ProfileVersionRow,
  DocumentRow,
  DocumentBlobRow,
  TimelineEntryRow,
  MetaRow,
} from './types';

/**
 * Phylax IndexedDB database.
 *
 * Schema v1: eight tables for the living health profile model.
 * Schema v2: adds lab_reports and timeline_entries (per ADR-0007).
 * Schema v3: adds document_blobs (Phase 4, D-01). The existing
 *   `documents` table keeps encrypted metadata; the new table carries
 *   the encrypted binary content keyed by the same `id`, so list-view
 *   metadata reads do not pull multi-MB blobs into memory.
 *
 * All entity tables store encrypted payloads with only structural
 * metadata (id, profileId, timestamps) as plaintext indexes.
 * Content fields are inside the encrypted payload and filtered
 * in-memory after decryption.
 *
 * The meta table stores app-level settings. Salt and schemaVersion
 * are plaintext because they are needed before decryption is possible.
 */
export class PhylaxDb extends Dexie {
  profiles!: Dexie.Table<ProfileRow, string>;
  observations!: Dexie.Table<ObservationRow, string>;
  labValues!: Dexie.Table<LabValueRow, string>;
  labReports!: Dexie.Table<LabReportRow, string>;
  supplements!: Dexie.Table<SupplementRow, string>;
  openPoints!: Dexie.Table<OpenPointRow, string>;
  profileVersions!: Dexie.Table<ProfileVersionRow, string>;
  documents!: Dexie.Table<DocumentRow, string>;
  documentBlobs!: Dexie.Table<DocumentBlobRow, string>;
  timelineEntries!: Dexie.Table<TimelineEntryRow, string>;
  meta!: Dexie.Table<MetaRow, string>;

  constructor() {
    super('phylax');

    this.version(1).stores({
      profiles: '&id, profileId',
      observations: '&id, profileId, [profileId+createdAt]',
      lab_values: '&id, profileId, [profileId+createdAt]',
      supplements: '&id, profileId',
      open_points: '&id, profileId',
      profile_versions: '&id, profileId, [profileId+createdAt]',
      documents: '&id, profileId',
      meta: '&id',
    });

    // v2: adds lab_reports and timeline_entries (per ADR-0007)
    this.version(2).stores({
      lab_reports: '&id, profileId, [profileId+createdAt]',
      timeline_entries: '&id, profileId, [profileId+createdAt]',
    });

    // v3: Phase 4 D-01 — split encrypted binary blobs off the
    // `documents` metadata row. `document_blobs` carries only `id`
    // (matching the owning document) + `payload`; no profileId index
    // because both rows are always created/deleted atomically under
    // the same transaction via DocumentRepository. Explicit no-op
    // upgrade hook: the `documents` table is currently empty (Phase 4
    // not yet shipped) so there are no existing rows to migrate; the
    // hook is spelled out anyway so future readers do not mistake the
    // absence for an oversight.
    this.version(3)
      .stores({
        document_blobs: '&id',
      })
      .upgrade(() => {
        /* no-op: `documents` table is empty at migration time, so
         * there is nothing to split into `document_blobs`. */
      });

    // Map camelCase properties to snake_case table names
    this.labValues = this.table('lab_values');
    this.labReports = this.table('lab_reports');
    this.openPoints = this.table('open_points');
    this.profileVersions = this.table('profile_versions');
    this.timelineEntries = this.table('timeline_entries');
    this.documentBlobs = this.table('document_blobs');
  }
}

/** Singleton database instance. Import this from src/db/index.ts. */
export const db = new PhylaxDb();
