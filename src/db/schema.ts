import Dexie from 'dexie';
import type {
  ProfileRow,
  ObservationRow,
  LabValueRow,
  SupplementRow,
  OpenPointRow,
  ProfileVersionRow,
  DocumentRow,
  MetaRow,
} from './types';

/**
 * Phylax IndexedDB database.
 *
 * Schema v1: eight tables for the living health profile model.
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
  supplements!: Dexie.Table<SupplementRow, string>;
  openPoints!: Dexie.Table<OpenPointRow, string>;
  profileVersions!: Dexie.Table<ProfileVersionRow, string>;
  documents!: Dexie.Table<DocumentRow, string>;
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

    // Map camelCase properties to snake_case table names
    this.labValues = this.table('lab_values');
    this.openPoints = this.table('open_points');
    this.profileVersions = this.table('profile_versions');
  }
}

/** Singleton database instance. Import this from src/db/index.ts. */
export const db = new PhylaxDb();
