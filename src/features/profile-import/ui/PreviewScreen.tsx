import { useState } from 'react';
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
  const hasWarnings = parseResult.report.warnings.length > 0;
  const hasUnrecognized = parseResult.report.unrecognized.length > 0;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">Vorschau</h1>

      <dl className="mb-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="inline font-medium text-gray-700 dark:text-gray-200">Quelle:</dt>{' '}
          <dd className="inline text-gray-900 dark:text-gray-100">{sourceLabel}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-gray-700 dark:text-gray-200">Ziel:</dt>{' '}
          <dd className="inline text-gray-900 dark:text-gray-100">{targetProfileName}</dd>
        </div>
      </dl>

      <section className="mb-4 rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Inhalt</h2>
        <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
          <li>{counts.observations} Beobachtungen</li>
          <li>
            {counts.labReports} Laborbefund{counts.labReports === 1 ? '' : 'e'} ({counts.labValues}{' '}
            Werte)
          </li>
          <li>{counts.supplements} Supplemente</li>
          <li>{counts.openPoints} offene Punkte</li>
          <li>{counts.timelineEntries} Verlaufsnotizen</li>
          <li>{counts.profileVersions} Profilversionen</li>
          <li>{counts.warningSigns} Warnhinweise</li>
          <li>{counts.externalReferences} externe Referenzen</li>
        </ul>
      </section>

      <section className="mb-4">
        {hasWarnings ? (
          <Collapsible
            summary={`${parseResult.report.warnings.length} Warnungen beim Parsen`}
            icon="!"
            iconClass="bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
            testId="warnings-disclosure"
          >
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {parseResult.report.warnings.map((w, i) => (
                <li key={i}>
                  <span className="font-medium">[{w.section}]</span> {w.message}
                </li>
              ))}
            </ul>
          </Collapsible>
        ) : null}
        {hasUnrecognized ? (
          <Collapsible
            summary={`${parseResult.report.unrecognized.length} nicht erkannte Blöcke`}
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
        {!hasWarnings && !hasUnrecognized && (
          <p className="text-sm text-green-700 dark:text-green-400" data-testid="parse-clean">
            ✓ Keine Probleme beim Parsen festgestellt.
          </p>
        )}
      </section>

      <section className="space-y-2">
        {counts.observations > 0 && (
          <Collapsible summary={`Beobachtungen anzeigen (${counts.observations})`}>
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
          <Collapsible summary={`Laborwerte anzeigen (${counts.labValues})`}>
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
          <Collapsible summary={`Supplemente anzeigen (${counts.supplements})`}>
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
          <Collapsible summary={`Offene Punkte anzeigen (${counts.openPoints})`}>
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
          <Collapsible summary={`Verlaufsnotizen anzeigen (${counts.timelineEntries})`}>
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {parseResult.timelineEntries.map((t, i) => (
                <li key={i}>
                  <span className="font-medium">{t.period}:</span> {t.title}
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
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Zurück
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Import starten
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
      className="rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
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
