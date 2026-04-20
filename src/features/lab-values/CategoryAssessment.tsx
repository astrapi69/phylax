import { useTranslation } from 'react-i18next';
import { MarkdownContent } from '../profile-view';

interface CategoryAssessmentProps {
  category: string;
  assessment: string | undefined;
}

/**
 * Per-category assessment block. Renders the assessment text as
 * Markdown below the values table for that category. Renders
 * nothing when the assessment is empty or undefined.
 */
export function CategoryAssessment({ category, assessment }: CategoryAssessmentProps) {
  const { t } = useTranslation('lab-values');
  if (!assessment || assessment.trim() === '') return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('report.category-assessment', { category })}
      </p>
      <MarkdownContent>{assessment}</MarkdownContent>
    </div>
  );
}
