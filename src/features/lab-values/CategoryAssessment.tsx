import { useTranslation } from 'react-i18next';
import { MarkdownContent } from '../profile-view';

interface CategoryAssessmentProps {
  category: string;
  assessment: string | undefined;
  /** P-22b: forwarded to MarkdownContent for in-text highlighting. */
  highlightQuery?: string;
  /**
   * P-22b/c/d-polish-2: 1-based global index of the first match
   * in this assessment field, looked up by the parent from the
   * view-level match plan. Threaded into MarkdownContent so each
   * `<mark>` carries a unique sequential `data-match-index`.
   */
  startMatchIndex?: number;
  /** Currently focused mark global index (1-based). */
  activeMatchIndex?: number | null;
}

/**
 * Per-category assessment block. Renders the assessment text as
 * Markdown below the values table for that category. Renders
 * nothing when the assessment is empty or undefined.
 */
export function CategoryAssessment({
  category,
  assessment,
  highlightQuery,
  startMatchIndex = 0,
  activeMatchIndex = null,
}: CategoryAssessmentProps) {
  const { t } = useTranslation('lab-values');
  if (!assessment || assessment.trim() === '') return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {t('report.category-assessment', { category })}
      </p>
      <MarkdownContent
        highlightQuery={highlightQuery}
        startMatchIndex={startMatchIndex}
        activeMatchIndex={activeMatchIndex}
      >
        {assessment}
      </MarkdownContent>
    </div>
  );
}
