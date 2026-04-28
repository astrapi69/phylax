import type { Document, LabReport, LabValue, Observation } from '../../domain';

/**
 * Shared helpers for the X-05 "linked documents" appendix.
 *
 * markdownExport hardcodes its strings in German (the file format
 * is German-anchored - the parser matches on German keywords).
 * pdfExport translates per the user's i18next locale. To support
 * both without coupling, the helpers here return data-shaped values
 * (formatted bytes, an enum for mime kind, a discriminated link
 * descriptor); each format wraps with its own string strategy.
 *
 * Independence contract: the appendix is NOT filtered by the
 * `dateRange` or `themes` options. User opting into the appendix
 * wants their linked documents listed regardless of which
 * observations / lab values are visible in the body. Keeping the
 * appendix independent of the other filters avoids the surprising
 * "my document disappeared because the linked observation was
 * date-filtered" scenario. Documented here, in helper text under
 * the dialog checkbox, and exercised in tests.
 */

/** Filter to documents that have at least one of the link fields set. */
export function pickLinkedDocuments(documents: readonly Document[]): readonly Document[] {
  return documents.filter(
    (d) => d.linkedObservationId !== undefined || d.linkedLabValueId !== undefined,
  );
}

/** Format bytes as KB/MB with one decimal place; prefers larger unit when crossing 1024. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type MimeKind = 'pdf' | 'image' | 'other';

export function classifyMime(mimeType: string): MimeKind {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return 'other';
}

export type LinkTarget =
  | { kind: 'observation'; theme: string }
  | { kind: 'lab-value'; parameter: string; date: string }
  | { kind: 'unknown' };

/**
 * Resolve a document's link fields to a list of `LinkTarget`
 * descriptors. A document with both `linkedObservationId` and
 * `linkedLabValueId` set yields two entries (unusual but supported);
 * each link is independent. A link pointing at a missing entity
 * yields `{ kind: 'unknown' }` so the caller can render a fallback
 * label without crashing.
 */
export function resolveLinkTargets(
  doc: Document,
  observations: readonly Observation[],
  labValues: readonly LabValue[],
  labReports: readonly LabReport[],
): LinkTarget[] {
  const targets: LinkTarget[] = [];

  if (doc.linkedObservationId) {
    const obs = observations.find((o) => o.id === doc.linkedObservationId);
    if (obs) targets.push({ kind: 'observation', theme: obs.theme });
    else targets.push({ kind: 'unknown' });
  }

  if (doc.linkedLabValueId) {
    const value = labValues.find((v) => v.id === doc.linkedLabValueId);
    if (value) {
      const report = labReports.find((r) => r.id === value.reportId);
      targets.push({
        kind: 'lab-value',
        parameter: value.parameter,
        date: report?.reportDate ?? '',
      });
    } else {
      targets.push({ kind: 'unknown' });
    }
  }

  return targets;
}
