import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseResult } from '../parser/types';

interface PreviewScreenProps {
  parseResult: ParseResult;
  sourceLabel: string;
  targetProfileName: string;
  onConfirm: () => void;
  onBack: () => void;
}

export function PreviewScreen({
  parseResult,
  sourceLabel,
  targetProfileName,
  onConfirm,
  onBack,
}: PreviewScreenProps) {
  const { t } = useTranslation('import');
  const counts = {
    observations: parseResult.observations.length,
    labReports: parseResult.labReports.length,
    labValues: parseResult.labValues.length,
    supplements: parseResult.supplements.length,
    openPoints: parseResult.openPoints.length,
    profileVersions: parseResult.profileVersions.length,
    timelineEntries: parseResult.timelineEntries.length,
    warningSigns: parseResult.profile?.warningSigns.length ?? 0,
    externalReferences: parseResult.profile?.externalReferences.length ?? 0,
  };
  const warningNotices = parseResult.report.warnings.filter((w) => w.severity === 'warning');
  const infoNotices = parseResult.report.warnings.filter((w) => w.severity === 'info');
  const hasWarnings = warningNotices.length > 0;
  const hasSkipped = infoNotices.length > 0;
  const hasUnrecognized = parseResult.report.unrecognized.length > 0;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
        {t('preview.heading')}
      </h1>

      <dl className="mb-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="inline font-medium text-gray-700 dark:text-gray-200">
            {t('preview.source-label')}
          </dt>{' '}
          <dd className="inline text-gray-900 dark:text-gray-100">{sourceLabel}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-gray-700 dark:text-gray-200">
            {t('preview.target-label')}
          </dt>{' '}
          <dd className="inline text-gray-900 dark:text-gray-100">{targetProfileName}</dd>
        </div>
      </dl>

      <section className="mb-4 rounded-sm border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('preview.content-heading')}
        </h2>
        <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
          <li>{t('common:counts.observations', { count: counts.observations })}</li>
          <li>
            {t('counts.lab-report-with-values', {
              count: counts.labReports,
              values: counts.labValues,
            })}
          </li>
          <li>{t('common:counts.supplements', { count: counts.supplements })}</li>
          <li>{t('counts.open-points', { count: counts.openPoints })}</li>
          <li>{t('counts.timeline-entries', { count: counts.timelineEntries })}</li>
          <li>{t('counts.profile-versions', { count: counts.profileVersions })}</li>
          <li>{t('counts.warnings', { count: counts.warningSigns })}</li>
          <li>{t('counts.external-references', { count: counts.externalReferences })}</li>
        </ul>
      </section>

      <section className="mb-4 space-y-2">
        {hasWarnings ? (
          <Collapsible
            summary={t('preview.warnings-summary', { count: warningNotices.length })}
            icon="!"
            iconClass="bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
            testId="warnings-disclosure"
          >
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {warningNotices.map((w, i) => (
                <li key={i}>
                  <span className="font-medium">[{w.section}]</span> {w.message}
                </li>
              ))}
            </ul>
          </Collapsible>
        ) : null}
        {hasSkipped ? (
          <Collapsible
            summary={t('preview.skipped-summary', { count: infoNotices.length })}
            icon="i"
            iconClass="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            testId="skipped-disclosure"
          >
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {infoNotices.map((w, i) => (
                <li key={i}>
                  <span className="font-medium">[{w.section}]</span> {w.message}
                </li>
              ))}
            </ul>
          </Collapsible>
        ) : null}
        {hasUnrecognized ? (
          <Collapsible
            summary={t('preview.unrecognized-summary', {
              count: parseResult.report.unrecognized.length,
            })}
            icon="i"
            iconClass="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
            testId="unrecognized-disclosure"
          >
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {parseResult.report.unrecognized.map((u, i) => (
                <li key={i}>{u.heading}</li>
              ))}
            </ul>
          </Collapsible>
        ) : null}
        {!hasWarnings && !hasSkipped && !hasUnrecognized && (
          <p className="text-sm text-green-700 dark:text-green-400" data-testid="parse-clean">
            {t('preview.clean')}
          </p>
        )}
      </section>

      <section className="space-y-2">
        {counts.observations > 0 && (
          <Collapsible summary={t('preview.view.observations', { count: counts.observations })}>
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {parseResult.observations.map((o, i) => (
                <li key={i}>
                  <span className="font-medium">{o.theme}:</span> {truncate(o.fact, 80)}
                </li>
              ))}
            </ul>
          </Collapsible>
        )}
        {counts.labValues > 0 && (
          <Collapsible summary={t('preview.view.lab-values', { count: counts.labValues })}>
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {parseResult.labValues.map((v, i) => (
                <li key={i}>
                  <span className="text-gray-500 dark:text-gray-400">[{v.category}]</span>{' '}
                  <span className="font-medium">{v.parameter}</span> {v.result}
                  {v.unit ? ` ${v.unit}` : ''}
                </li>
              ))}
            </ul>
          </Collapsible>
        )}
        {counts.supplements > 0 && (
          <Collapsible summary={t('preview.view.supplements', { count: counts.supplements })}>
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {parseResult.supplements.map((s, i) => (
                <li key={i}>
                  <span className="font-medium">{s.name}</span>{' '}
                  <span className="text-gray-500 dark:text-gray-400">({s.category})</span>
                </li>
              ))}
            </ul>
          </Collapsible>
        )}
        {counts.openPoints > 0 && (
          <Collapsible summary={t('preview.view.open-points', { count: counts.openPoints })}>
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {parseResult.openPoints.map((p, i) => (
                <li key={i}>
                  <span className="text-gray-500 dark:text-gray-400">[{p.context}]</span>{' '}
                  {truncate(p.text, 80)}
                </li>
              ))}
            </ul>
          </Collapsible>
        )}
        {counts.timelineEntries > 0 && (
          <Collapsible
            summary={t('preview.view.timeline-entries', { count: counts.timelineEntries })}
          >
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {parseResult.timelineEntries.map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.period}:</span> {e.title}
                </li>
              ))}
            </ul>
          </Collapsible>
        )}
      </section>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('action.back')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {t('preview.start')}
        </button>
      </div>
    </div>
  );
}

function Collapsible({
  summary,
  children,
  icon,
  iconClass,
  testId,
}: {
  summary: string;
  children: React.ReactNode;
  icon?: string;
  iconClass?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-sm border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {icon && (
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${iconClass ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <span className="flex-1">{summary}</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3 pb-3 dark:border-gray-700">{children}</div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}...`;
}
