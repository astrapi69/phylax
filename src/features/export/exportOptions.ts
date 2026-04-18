/**
 * Filter options accepted by every export function. Empty options mean
 * "export everything". X-01 defines the shape; the UI controls that feed
 * values into it land in X-03 (date range) and X-04 (theme filter).
 */
export interface ExportOptions {
  /**
   * Include only entities whose date falls within this range, inclusive.
   * Applies to lab reports (reportDate), timeline entries (period), and
   * observations (updatedAt). Entities without a comparable date are
   * always included.
   */
  dateRange?: {
    from: Date;
    to: Date;
  };
  /**
   * Whitelist of observation themes to include. Empty or undefined means
   * all themes. Theme matching is case-sensitive and strict to keep the
   * filter deterministic.
   */
  themes?: readonly string[];
  /**
   * Include linked documents as an appendix. X-05 adds the logic; X-01
   * accepts the option for forward compatibility.
   */
  includeLinkedDocuments?: boolean;
}
