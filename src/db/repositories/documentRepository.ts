import { db } from '../schema';
import { EncryptedRepository, type DomainEntity } from './encryptedRepository';

/**
 * Repository for document entities.
 *
 * The documents feature is scaffolded in the schema (table + index)
 * but not yet implemented as a user-facing feature. This repository
 * exists so that cross-cutting operations (backup export, backup
 * import) can round-trip the documents table without bypassing the
 * repository layer. Once the documents feature lands, this class
 * will host its domain-specific methods.
 */
export class DocumentRepository extends EncryptedRepository<DomainEntity> {
  constructor() {
    super(db.documents);
  }
}
