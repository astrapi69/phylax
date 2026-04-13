/**
 * Row shapes for the Phylax IndexedDB schema.
 *
 * Every non-meta row stores its domain data inside a single `payload` field
 * (ArrayBuffer containing IV + ciphertext + auth tag, per F-07's wire format).
 * Only structural metadata (id, profileId, timestamps) is plaintext.
 * This minimizes metadata leakage to an observer of the encrypted store.
 */

/**
 * Base shape for all encrypted entity rows.
 * Content fields live inside `payload` as an encrypted blob.
 */
export interface EncryptedRow {
  /** UUID primary key */
  id: string;
  /** Profile this record belongs to. Present on every non-meta row. */
  profileId: string;
  /** Unix milliseconds when the record was created in Phylax */
  createdAt: number;
  /** Unix milliseconds when the record was last updated */
  updatedAt: number;
  /** IV + ciphertext + auth tag (AES-256-GCM, per F-07 wire format) */
  payload: ArrayBuffer;
}

/**
 * Per-table type aliases. Identical to EncryptedRow now but will diverge
 * if tables gain table-specific plaintext fields in future schema versions.
 */

/** Top-level profile record. Encrypted payload: name, age, diagnoses, medications, limitations, type. */
export type ProfileRow = EncryptedRow;

/** Observation with fact/pattern/self-regulation. Encrypted payload: theme, fact, pattern, selfRegulation, status. */
export type ObservationRow = EncryptedRow;

/** Lab value record. Encrypted payload: measuredAt, parameter, result, referenceRange, assessment. */
export type LabValueRow = EncryptedRow;

/** Supplement plan entry. Encrypted payload: timing, name, purpose. */
export type SupplementRow = EncryptedRow;

/** Checklist item for next doctor visit. Encrypted payload: text, status (open/closed), category. */
export type OpenPointRow = EncryptedRow;

/** Version history entry. Encrypted payload: version, changeDescription, source. */
export type ProfileVersionRow = EncryptedRow;

/** Encrypted document (PDF, image). Encrypted payload: file content, name, mimeType, linked observation IDs. */
export type DocumentRow = EncryptedRow;

/** Lab report (parent of LabValues). Encrypted payload: reportDate, labName, assessments, etc. */
export type LabReportRow = EncryptedRow;

/** Timeline entry (Verlaufsnotiz). Encrypted payload: period, title, content, source. */
export type TimelineEntryRow = EncryptedRow;

/**
 * App-level metadata. Single-row pattern (id is always 'singleton').
 * Salt and schemaVersion are plaintext because they are needed before
 * the master key is derived. Everything else is in the encrypted payload.
 */
export interface MetaRow {
  /** Always 'singleton' */
  id: string;
  /** 32-byte PBKDF2 salt, plaintext (needed for key derivation) */
  salt: ArrayBuffer;
  /** Schema version number, plaintext (needed for migration logic) */
  schemaVersion: number;
  /** IV + ciphertext + auth tag containing settings, API key, app preferences */
  payload: ArrayBuffer;
}
