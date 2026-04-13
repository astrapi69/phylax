import type { LabValue } from '../../domain';
import { db } from '../schema';
import { EncryptedRepository } from './encryptedRepository';

/**
 * Repository for LabValue entities.
 *
 * LabValues are individual measurements within a LabReport.
 * They have a reportId FK pointing to their parent LabReport.
 *
 * Since reportId and parameter are inside the encrypted payload
 * (ADR-0005), all filtering happens in memory after decryption.
 */
export class LabValueRepository extends EncryptedRepository<LabValue> {
  constructor() {
    super(db.labValues);
  }

  /**
   * List all values for a given lab report.
   * Loads all values for the profile, decrypts, filters by reportId.
   */
  async listByReport(reportId: string): Promise<LabValue[]> {
    const rows = await this.table.toArray();
    const decrypted = await Promise.all(rows.map((row) => this.deserialize(row)));
    return decrypted.filter((v) => v.reportId === reportId);
  }

  /**
   * List all values for a parameter across all reports in a profile.
   * Enables "show me all Kreatinin values over time" queries.
   * Results sorted by createdAt ascending (chronological).
   */
  async listByParameter(profileId: string, parameter: string): Promise<LabValue[]> {
    const all = await this.listByProfile(profileId);
    return all.filter((v) => v.parameter === parameter).sort((a, b) => a.createdAt - b.createdAt);
  }
}
