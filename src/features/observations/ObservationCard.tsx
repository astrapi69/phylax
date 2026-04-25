import { useTranslation } from 'react-i18next';
import type { Observation } from '../../domain';
import { MarkdownContent } from '../profile-view';
import { SourceBadge } from './SourceBadge';
import { AttachedDocumentsForObservation } from '../documents/AttachedDocumentsList';
import { ProvenanceBadge } from '../document-import/ui/ProvenanceBadge';
import { ObservationActions } from './ObservationActions';
import type { UseObservationFormResult } from './useObservationForm';

interface ObservationCardProps {
  observation: Observation;
  /** When true, the disclosure renders open by default. */
  defaultOpen?: boolean;
  /**
   * When true, the card paints a transient green background for ~2s so
   * a freshly committed observation catches the user's eye when they
   * return from the chat. The caller controls when this flips false so
   * the fade-out animation can play.
   */
  highlighted?: boolean;
  /**
   * O-10: shared observation-form hook. When supplied, the card
   * renders edit + delete actions in the summary row. Optional so
   * read-only contexts (e.g., tests, future read-only views) can
   * opt out.
   */
  form?: UseObservationFormResult;
}

/**
 * Single observation as a native disclosure (details/summary).
 *
 * Native disclosure semantics give us keyboard handling, screen-reader
 * announcements, and aria-expanded for free, with no JS state.
 *
 * The summary shows status + source provenance plus a one-line excerpt
 * derived from the fact field (first non-empty line, truncated). The
 * expanded body renders the full triad (fact / pattern / selfRegulation)
 * via MarkdownContent, plus optional medicalFinding, relevanceNotes and
 * extraSections with their German keys preserved verbatim.
 */
export function ObservationCard({
  observation,
  defaultOpen = false,
  highlighted = false,
  form,
}: ObservationCardProps) {
  const { t } = useTranslation('observations');
  const {
    fact,
    pattern,
    selfRegulation,
    status,
    source,
    medicalFinding,
    relevanceNotes,
    extraSections,
  } = observation;
  const excerpt = oneLineExcerpt(fact);
  const accessibleLabel = buildAccessibleLabel(t, status, excerpt);

  return (
    <div className="relative">
      {/* Actions live as a sibling of <details>, not nested inside <summary>,
       *  to satisfy the WCAG nested-interactive rule (axe a11y). Absolute
       *  positioning keeps the always-visible affordance from Q5 without
       *  putting <button>s inside the disclosure trigger. */}
      {form && (
        <div className="absolute top-2 right-2 z-10">
          <ObservationActions observation={observation} form={form} />
        </div>
      )}
      <details
        open={defaultOpen || undefined}
        data-highlighted={highlighted || undefined}
        className={`group rounded border bg-white transition-colors duration-1500 open:shadow-xs motion-reduce:transition-none dark:bg-gray-800 ${
          highlighted
            ? 'border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/30'
            : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <summary
          aria-label={accessibleLabel}
          className="flex cursor-pointer list-none items-start gap-3 rounded-sm p-3 pr-24 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 focus-visible:outline-solid dark:hover:bg-gray-700/40"
        >
          <span
            aria-hidden
            className="mt-0.5 inline-block text-gray-500 transition-transform group-open:rotate-90 dark:text-gray-400"
          >
            ▶
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                {status}
              </span>
              <SourceBadge source={source} />
              <ProvenanceBadge sourceDocumentId={observation.sourceDocumentId} />
            </div>
            {excerpt && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{excerpt}</p>}
          </div>
        </summary>

        <div className="space-y-4 border-t border-gray-200 px-3 pt-3 pb-4 dark:border-gray-700">
          <Field label={t('card.field.fact')} content={fact} />
          <Field label={t('card.field.pattern')} content={pattern} />
          <Field label={t('card.field.self-regulation')} content={selfRegulation} />
          {medicalFinding && (
            <Field label={t('card.field.medical-finding')} content={medicalFinding} />
          )}
          {relevanceNotes && <Field label={t('card.field.relevance')} content={relevanceNotes} />}
          {Object.entries(extraSections).map(([key, value]) => (
            <Field key={key} label={key} content={value} />
          ))}
          <AttachedDocumentsForObservation observationId={observation.id} />
        </div>
      </details>
    </div>
  );
}

function Field({ label, content }: { label: string; content: string }) {
  if (!content || content.trim() === '') return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {label}
      </h4>
      <MarkdownContent>{content}</MarkdownContent>
    </div>
  );
}

function buildAccessibleLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  status: string,
  excerpt: string,
): string {
  const parts = [status.trim(), excerpt.trim()].filter((p) => p.length > 0);
  if (parts.length === 0) return t('card.aria.expand');
  return t('card.aria.summary', { parts: parts.join(' - ') });
}

function oneLineExcerpt(text: string): string {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return '';
  const stripped = firstLine.replace(/^[#>*\-+\s]+/, '').trim();
  if (stripped.length <= 120) return stripped;
  return `${stripped.slice(0, 117)}...`;
}
