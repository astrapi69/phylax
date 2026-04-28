/**
 * Filter options accepted by every export function. Empty options mean
 * "export everything". X-01 defines the shape; the UI controls that feed
 * values into it land in X-03 (date range) and X-04 (theme filter).
 */
export interface ExportOptions {
  /**
   * Include only entities whose date falls within this range, inclusive
   * on both ends. Either bound is optional: omitting `from` means "no
   * lower bound", omitting `to` means "no upper bound". An empty range
   * object (both bounds missing) is equivalent to no filter.
   *
   * Applies to lab reports (reportDate), timeline entries (period), and
   * observations (updatedAt). Entities without a comparable date
   * (supplements, open points) are always included.
   *
   * Relaxed in X-03 from `{ from, to }` to `{ from?, to? }` so the
   * ExportDialog UI can accept partial bounds the same way the O-18
   * `<DateRangeFilter>` does.
   */
  dateRange?: {
    from?: Date;
    to?: Date;
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
