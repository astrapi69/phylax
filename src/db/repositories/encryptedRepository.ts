import type { Table } from 'dexie';
import { encryptWithStoredKey, decryptWithStoredKey, generateId } from '../../crypto';
import type { EncryptedRow } from '../types';

/**
 * Base interface for all domain entities stored via EncryptedRepository.
 * Concrete domain types extend this with their own fields.
 */
export interface DomainEntity {
  id: string;
  profileId: string;
  createdAt: number;
  updatedAt: number;
}

const IMMUTABLE_FIELDS = ['id', 'profileId', 'createdAt'] as const;

/**
 * Generic encrypted repository base class.
 *
 * Guarantees that plaintext domain data never reaches IndexedDB.
 * Every `put` encrypts via the key store, every `get` decrypts.
 * Concrete repositories extend this class with their domain type.
 *
 * Serialization: domain object -> JSON -> UTF-8 bytes -> AES-256-GCM encrypt -> payload
 * Deserialization: payload -> AES-256-GCM decrypt -> UTF-8 string -> JSON -> domain object
 *
 * JSON limitations (documented, not worked around):
 * - Date objects are serialized to ISO strings and deserialized as strings. Use number timestamps.
 * - undefined values are dropped by JSON.stringify. Use null for intentional absence.
 * - Uint8Array and other binary types do not survive JSON round-trip. Binary data goes
 *   in the documents table directly, not through this base class.
 */
export abstract class EncryptedRepository<T extends DomainEntity> {
  constructor(protected readonly table: Table<EncryptedRow, string>) {}

  /**
   * Create a new entity. ID, createdAt, and updatedAt are auto-generated.
   * Throws if the key store is locked.
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = Date.now();
    const entity = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    } as T;

    const row = await this.serialize(entity);
    await this.table.put(row);
    return entity;
  }

  /**
   * Get an entity by its ID. Returns null if not found.
   * Throws if the key store is locked.
   */
  async getById(id: string): Promise<T | null> {
    const row = await this.table.get(id);
    if (!row) {
      return null;
    }
    return this.deserialize(row);
  }

  /**
   * Update an entity by ID. Merges the patch into the existing entity.
   * updatedAt is refreshed automatically.
   *
   * Throws if the patch contains immutable fields (id, profileId, createdAt).
   * Throws if the entity does not exist.
   * Throws if the key store is locked.
   */
  async update(id: string, patch: Partial<Omit<T, 'id' | 'profileId' | 'createdAt'>>): Promise<T> {
    for (const field of IMMUTABLE_FIELDS) {
      if (field in (patch as Record<string, unknown>)) {
        throw new Error(
          'Cannot modify immutable fields (id, profileId, createdAt) via update. Strip these fields before calling update.',
        );
      }
    }

    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Entity with id "${id}" not found`);
    }

    const updated = {
      ...existing,
      ...patch,
      id: existing.id,
      profileId: existing.profileId,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    } as T;

    const row = await this.serialize(updated);
    await this.table.put(row);
    return updated;
  }

  /**
   * Delete an entity by ID. No-op if the entity does not exist.
   */
  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  /**
   * List all entities for a given profile. Order is not guaranteed.
   * Throws if the key store is locked.
   */
  async listByProfile(profileId: string): Promise<T[]> {
    const rows = await this.table.where('profileId').equals(profileId).toArray();
    return Promise.all(rows.map((row) => this.deserialize(row)));
  }

  /**
   * List all entities for a given profile, sorted by createdAt ascending.
   * Uses the [profileId+createdAt] compound index if available on the table.
   * Throws if the key store is locked.
   */
  async listByProfileChronological(profileId: string): Promise<T[]> {
    const rows = await this.table.where('profileId').equals(profileId).sortBy('createdAt');
    return Promise.all(rows.map((row) => this.deserialize(row)));
  }

  /**
   * Encrypt a fully-formed entity into a storable row without touching
   * the database. The caller is responsible for `id`, `profileId`,
   * `createdAt`, and `updatedAt`.
   *
   * Use this when pre-encrypting many entities outside a Dexie
   * transaction, so the transaction body can stay synchronous over
   * Dexie calls only (bulk imports, migrations, bulk exports). Dexie
   * commits a transaction as soon as it detects an await on a
   * non-Dexie promise, so crypto must not happen inside the
   * transaction body.
   */
  async serialize(entity: T): Promise<EncryptedRow> {
    const { id, profileId, createdAt, updatedAt, ...domainFields } = entity;
    const json = JSON.stringify(domainFields);
    const bytes = new TextEncoder().encode(json);
    const payload = await encryptWithStoredKey(bytes);

    return {
      id,
      profileId,
      createdAt,
      updatedAt,
      payload: new Uint8Array(payload).buffer,
    };
  }

  /**
   * Decrypt a raw EncryptedRow back into a domain entity. Exposed for
   * the same bulk-operation reasons as `serialize`.
   */
  async deserialize(row: EncryptedRow): Promise<T> {
    const payload = new Uint8Array(row.payload);
    const bytes = await decryptWithStoredKey(payload);
    const json = new TextDecoder().decode(bytes);
    const domainFields = JSON.parse(json) as Record<string, unknown>;

    return {
      ...domainFields,
      id: row.id,
      profileId: row.profileId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as T;
  }
}
