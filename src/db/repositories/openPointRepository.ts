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
}
