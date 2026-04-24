import type { OpenPoint } from '../../domain';
import { db } from '../schema';
import { EncryptedRepository } from './encryptedRepository';

/**
 * Repository for OpenPoint entities.
 *
 * Open points are checklist items for follow-up actions,
 * grouped by context (e.g., "Beim naechsten Arztbesuch").
 * Resolution status and context are inside the encrypted payload.
 */
export class OpenPointRepository extends EncryptedRepository<OpenPoint> {
  constructor() {
    super(db.openPoints);
  }

  /**
   * List unresolved open points for a profile.
   */
  async listUnresolved(profileId: string): Promise<OpenPoint[]> {
    const all = await this.listByProfile(profileId);
    return all.filter((p) => !p.resolved);
  }

  /**
   * List open points by context.
   */
  async listByContext(profileId: string, context: string): Promise<OpenPoint[]> {
    const all = await this.listByProfile(profileId);
    return all.filter((p) => p.context === context);
  }

  /**
   * Get distinct contexts used in this profile's open points.
   */
  async listContexts(profileId: string): Promise<string[]> {
    const all = await this.listByProfile(profileId);
    return [...new Set(all.map((p) => p.context))];
  }

  /**
   * Mark an open point as resolved.
   * Convenience wrapper around update. Refreshes updatedAt.
   */
  async markResolved(id: string): Promise<OpenPoint> {
    return this.update(id, { resolved: true });
  }

  /**
   * List open points whose `sourceDocumentId` matches the given
   * document id. IMP-05 reverse lookup for provenance surfacing and
   * D-08 cascade cleanup.
   */
  async listBySourceDocument(documentId: string): Promise<OpenPoint[]> {
    const rows = await this.table.toArray();
    const decrypted = await Promise.all(rows.map((row) => this.deserialize(row)));
    return decrypted.filter((e) => e.sourceDocumentId === documentId);
  }
}
