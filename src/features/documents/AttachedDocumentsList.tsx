import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAttachedDocuments } from './useAttachedDocuments';

export interface AttachedDocumentsForObservationProps {
  observationId: string;
}

/**
 * Attached-documents list for a single observation. Renders a
 * heading + list of filenames linked to the viewer route, or nothing
 * if no documents are attached. Silently empty when nothing matches
 * so the parent card stays clean for freshly imported observations
 * with no attachments.
 */
export function AttachedDocumentsForObservation({
  observationId,
}: AttachedDocumentsForObservationProps) {
  const { t } = useTranslation('documents');
  const state = useAttachedDocuments({ observationId });

  if (state.kind !== 'loaded' || state.documents.length === 0) return null;

  return (
    <section
      aria-labelledby={`attached-docs-obs-${observationId}`}
      className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
      data-testid={`attached-docs-observation-${observationId}`}
    >
      <h3
        id={`attached-docs-obs-${observationId}`}
        className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
      >
        {t('attached-documents.heading')}
      </h3>
      <ul className="flex flex-col gap-1">
        {state.documents.map((d) => (
          <li key={d.id}>
            <Link
              to={`/documents/${d.id}`}
              className="text-blue-700 hover:underline dark:text-blue-300"
            >
              {d.filename}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
