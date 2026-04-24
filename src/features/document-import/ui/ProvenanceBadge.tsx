import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocumentRepository } from '../../../db/repositories';
import type { Document } from '../../../domain';

export interface ProvenanceBadgeProps {
  /**
   * Opaque id of the source `Document` (set via IMP-05's
   * `commitDrafts`). When `undefined` the badge renders nothing.
   */
  sourceDocumentId?: string;
  /** Repository override for tests. Production uses default. */
  repo?: DocumentRepository;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'found'; document: Document }
  | { kind: 'missing' }
  | { kind: 'locked' };

/**
 * Inline provenance indicator for AI-import-derived entities
 * (IMP-05). Renders `Aus Import: {filename}` as a clickable link
 * that navigates to the source Document's viewer.
 *
 * Distinct from D-07's `AttachedDocumentsForObservation` /
 * `AttachedDocumentsForLabReport`, which surface user-curated
 * attachments. `ProvenanceBadge` surfaces the import-time source,
 * a separate semantic channel — different color, different icon,
 * different tooltip to keep the two mental models apart.
 *
 * Gracefully handles stale references: if the referenced Document
 * was deleted (D-08 cascade clears `sourceDocumentId` on derived
 * entities, but a transient read during delete may hit a gap), the
 * badge renders a muted "Quelle entfernt" without erroring.
 */
export function ProvenanceBadge({ sourceDocumentId, repo }: ProvenanceBadgeProps) {
  const { t } = useTranslation('document-import');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    if (!sourceDocumentId) return;
    const id = sourceDocumentId;
    let cancelled = false;
    async function load() {
      try {
        const r = repo ?? new DocumentRepository();
        const doc = await r.getMetadata(id);
        if (cancelled) return;
        if (doc) {
          setState({ kind: 'found', document: doc });
        } else {
          setState({ kind: 'missing' });
        }
      } catch {
        if (cancelled) return;
        // Most commonly: key store locked mid-render. Treat as
        // recoverable, render a neutral pending state instead of
        // erroring.
        setState({ kind: 'locked' });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sourceDocumentId, repo]);

  if (!sourceDocumentId) return null;

  if (state.kind === 'loading' || state.kind === 'locked') {
    return (
      <span
        data-testid="provenance-badge-loading"
        className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500"
      >
        <SourceIcon />
        {t('import.provenance.loading')}
      </span>
    );
  }

  if (state.kind === 'missing') {
    return (
      <span
        data-testid="provenance-badge-missing"
        className="inline-flex items-center gap-1 text-xs text-gray-500 italic dark:text-gray-500"
      >
        <SourceIcon />
        {t('import.provenance.missing')}
      </span>
    );
  }

  return (
    <Link
      to={`/documents/${state.document.id}`}
      data-testid="provenance-badge"
      className="inline-flex items-center gap-1 rounded-sm bg-purple-100 px-1.5 py-0.5 text-xs text-purple-900 hover:bg-purple-200 hover:underline dark:bg-purple-950/50 dark:text-purple-200 dark:hover:bg-purple-900/60"
      title={t('import.provenance.tooltip', { filename: state.document.filename })}
    >
      <SourceIcon />
      {t('import.provenance.label', { filename: truncate(state.document.filename, 28) })}
    </Link>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

/**
 * Inline SVG for the provenance badge. Distinct from the D-07
 * link-chain icon — this one is an arrow-into-document motif to
 * signal "came from" rather than "linked to".
 */
function SourceIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      className="flex-shrink-0"
      fill="currentColor"
    >
      <path d="M4 2h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm5 1v2h2L9 3ZM4 3v11h7V6H8V3H4Z" />
      <path d="m6 10 1 1h3v-1H7.707L9 8.707 8.293 8 6 10.293V10Z" />
    </svg>
  );
}
