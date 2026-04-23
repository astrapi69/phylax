import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Document, LabValue } from '../../domain';
import { DocumentRepository, ProfileRepository } from '../../db/repositories';

export interface AttachedDocumentsForLabReportProps {
  /** All lab values in the current report, across categories. */
  values: LabValue[];
}

/**
 * Aggregated attached-documents section for a lab report card.
 *
 * Loads all documents for the current profile once, filters to those
 * whose `linkedLabValueId` is one of the values in this report, and
 * groups the results by parameter name. Renders nothing when no
 * value in the report has any attached document — empty reports
 * stay clean.
 *
 * Layout decision: the lab-values table is dense (5 columns) and
 * squeezing per-row attachment links inside it would crowd it
 * further. A single section below the table, grouped by parameter,
 * keeps the table readable and still shows which value each doc is
 * linked to.
 */
export function AttachedDocumentsForLabReport({ values }: AttachedDocumentsForLabReportProps) {
  const { t } = useTranslation('documents');
  const [docsByValueId, setDocsByValueId] = useState<Map<string, Document[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await new ProfileRepository().getCurrentProfile();
      if (cancelled) return;
      if (!profile) {
        setDocsByValueId(new Map());
        return;
      }
      const all = await new DocumentRepository().listByProfile(profile.id);
      if (cancelled) return;
      const valueIds = new Set(values.map((v) => v.id));
      const grouped = new Map<string, Document[]>();
      for (const d of all) {
        if (d.linkedLabValueId && valueIds.has(d.linkedLabValueId)) {
          const list = grouped.get(d.linkedLabValueId) ?? [];
          list.push(d);
          grouped.set(d.linkedLabValueId, list);
        }
      }
      for (const list of grouped.values()) {
        list.sort((a, b) => b.createdAt - a.createdAt);
      }
      setDocsByValueId(grouped);
    })().catch(() => {
      if (!cancelled) setDocsByValueId(new Map());
    });
    return () => {
      cancelled = true;
    };
  }, [values]);

  if (!docsByValueId || docsByValueId.size === 0) return null;

  const rows = values.filter((v) => docsByValueId.has(v.id));

  return (
    <section
      className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
      data-testid="attached-docs-lab-report"
    >
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {t('attached-documents.heading')}
      </h3>
      <ul className="flex flex-col gap-1">
        {rows.map((v) => {
          const docs = docsByValueId.get(v.id) ?? [];
          return (
            <li
              key={v.id}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
              data-testid={`attached-docs-lab-value-${v.id}`}
            >
              <span className="font-medium text-gray-700 dark:text-gray-300">{v.parameter}:</span>
              {docs.map((d, i) => (
                <span key={d.id}>
                  <Link
                    to={`/documents/${d.id}`}
                    className="text-blue-700 hover:underline dark:text-blue-300"
                  >
                    {d.filename}
                  </Link>
                  {i < docs.length - 1 && <span className="text-gray-400">,</span>}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
