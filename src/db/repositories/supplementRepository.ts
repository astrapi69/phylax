import type { Supplement, SupplementCategory } from '../../domain';
import { db } from '../schema';
import { EncryptedRepository } from './encryptedRepository';

/**
 * Repository for Supplement entities.
 *
 * Category and name are inside the encrypted payload (ADR-0005),
 * so all filtering happens in memory after decryption.
 */
export class SupplementRepository extends EncryptedRepository<Supplement> {
  constructor() {
    super(db.supplements);
  }

  /**
   * List supplements by category (daily, regular, paused, on-demand).
   */
  async listByCategory(profileId: string, category: SupplementCategory): Promise<Supplement[]> {
    const all = await this.listByProfile(profileId);
    return all.filter((s) => s.category === category);
  }

  /**
   * List currently active supplements (everything except 'paused').
   */
  async listActive(profileId: string): Promise<Supplement[]> {
    const all = await this.listByProfile(profileId);
    return all.filter((s) => s.category !== 'paused');
  }

  /**
   * List supplements whose `sourceDocumentId` matches the given
   * document id. IMP-05 reverse lookup for provenance surfacing and
   * D-08 cascade cleanup.
   */
  async listBySourceDocument(documentId: string): Promise<Supplement[]> {
    const rows = await this.table.toArray();
    const decrypted = await Promise.all(rows.map((row) => this.deserialize(row)));
    return decrypted.filter((e) => e.sourceDocumentId === documentId);
  }
}
