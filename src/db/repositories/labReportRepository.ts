import type { LabReport } from '../../domain';
import { db } from '../schema';
import { EncryptedRepository } from './encryptedRepository';
import type { LabValueRepository } from './labValueRepository';

/**
 * Repository for LabReport entities.
 *
 * A LabReport is the parent entity for LabValues (D1 flat strategy).
 * Takes a LabValueRepository dependency for cascade-delete operations.
 *
 * Since reportDate is inside the encrypted payload (ADR-0005),
 * date-based sorting happens in memory after decryption.
 */
export class LabReportRepository extends EncryptedRepository<LabReport> {
  constructor(private readonly labValueRepo: LabValueRepository) {
    super(db.labReports);
  }

  /**
   * Delete a lab report AND all its associated lab values.
   * Cascade delete is mandatory for data integrity: orphaned lab values
   * with a dangling reportId would be invalid state.
   *
   * The inherited delete() does NOT cascade. Use this method for
   * normal deletion. The non-cascade delete() is available for
   * edge cases where the caller manages values separately.
   */
  async deleteWithValues(id: string): Promise<void> {
    const values = await this.labValueRepo.listByReport(id);
    await Promise.all(values.map((v) => this.labValueRepo.delete(v.id)));
    await this.delete(id);
  }

  /**
   * List reports for a profile, sorted by reportDate descending (newest first).
   * Since reportDate is in the encrypted payload, sorting happens after decryption.
   */
  async listByProfileDateDescending(profileId: string): Promise<LabReport[]> {
    const all = await this.listByProfile(profileId);
    return all.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  }
}
