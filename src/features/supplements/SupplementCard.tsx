import { useTranslation } from 'react-i18next';
import type { Supplement } from '../../domain';
import type { FieldMatch, MatchPlan } from '../../lib';
import { HighlightedText } from '../../ui';
import { ProvenanceBadge } from '../document-import/ui/ProvenanceBadge';
import { SupplementActions } from './SupplementActions';
import type { UseSupplementFormResult } from './useSupplementForm';

interface SupplementCardProps {
  supplement: Supplement;
  muted?: boolean;
  /**
   * Optional form-state hook result. When omitted, no edit/delete
   * actions render - keeps the card usable in read-only contexts
   * (e.g., profile-view summary panes, export previews).
   */
  form?: UseSupplementFormResult;
  /**
   * P-22b/c/d-polish-2: optional match plan keyed by
   * `sup:<supplementId>:<field>`. When supplied, plain-text fields
   * (name, brand, recommendation, rationale) wrap matching
   * substrings in `<mark>` with a sequential global
   * `data-match-index` so the view-level Up/Down nav can scroll
   * per mark. Read-only mounts that omit it render bare text.
   */
  matchPlan?: MatchPlan;
  /** Currently focused mark global index (1-based). */
  activeMatchIndex?: number | null;
}

/**
 * Single supplement card. When `muted` is true (paused supplements),
 * the card is visually de-emphasized but remains fully readable by
 * screen readers.
 *
 * O-14: when a `form` prop is supplied, the title row gets a trailing
 * edit + delete actions cluster.
 */
export function SupplementCard({
  supplement,
  muted = false,
  form,
  matchPlan,
  activeMatchIndex = null,
}: SupplementCardProps) {
  const { t } = useTranslation('supplements');
  const { id, name, brand, recommendation, rationale } = supplement;
  const lookup = (field: string): FieldMatch | undefined => matchPlan?.get(`sup:${id}:${field}`);
  // Muted variant uses a subtle gray background tint and shows a
  // "Pausiert" badge. We deliberately do NOT reduce opacity, because
  // that blends small text below WCAG AA contrast on the tinted
  // background. The badge and background tint are enough signal.
  const containerClass = muted
    ? 'rounded-sm border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50'
    : 'rounded-sm border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800';

  return (
    <div className={containerClass}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            <HighlightCell
              text={name}
              fieldMatch={lookup('name')}
              activeMatchIndex={activeMatchIndex}
            />
          </h3>
          {brand && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              <HighlightCell
                text={brand}
                fieldMatch={lookup('brand')}
                activeMatchIndex={activeMatchIndex}
              />
            </span>
          )}
          {muted && (
            <span className="rounded-sm bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {t('card.paused-badge')}
            </span>
          )}
          <ProvenanceBadge sourceDocumentId={supplement.sourceDocumentId} />
        </div>
        {form ? <SupplementActions supplement={supplement} form={form} /> : null}
      </div>
      {recommendation && (
        <FieldLine
          label={t('card.field.recommendation')}
          value={recommendation}
          fieldMatch={lookup('recommendation')}
          activeMatchIndex={activeMatchIndex}
        />
      )}
      {rationale && (
        <FieldLine
          label={t('card.field.rationale')}
          value={rationale}
          fieldMatch={lookup('rationale')}
          activeMatchIndex={activeMatchIndex}
        />
      )}
    </div>
  );
}

function FieldLine({
  label,
  value,
  fieldMatch,
  activeMatchIndex,
}: {
  label: string;
  value: string;
  fieldMatch: FieldMatch | undefined;
  activeMatchIndex: number | null;
}) {
  return (
    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
      <span className="font-medium text-gray-600 dark:text-gray-400">{label}:</span>{' '}
      <HighlightCell text={value} fieldMatch={fieldMatch} activeMatchIndex={activeMatchIndex} />
    </p>
  );
}

function HighlightCell({
  text,
  fieldMatch,
  activeMatchIndex,
}: {
  text: string;
  fieldMatch: FieldMatch | undefined;
  activeMatchIndex: number | null;
}) {
  if (!fieldMatch || fieldMatch.ranges.length === 0) return <>{text}</>;
  return (
    <HighlightedText
      text={text}
      ranges={fieldMatch.ranges}
      startMatchIndex={fieldMatch.startIndex}
      activeMatchIndex={activeMatchIndex}
    />
  );
}
