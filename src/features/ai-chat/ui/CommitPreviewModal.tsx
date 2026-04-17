import { useEffect, useMemo, useRef } from 'react';
import type { DetectedFragment } from '../detection';
import { wrapFragmentForParser } from '../detection';
import { parseProfile } from '../../profile-import/parser';
import type { ParseResult } from '../../profile-import/parser/types';

interface CommitPreviewModalProps {
  fragment: DetectedFragment;
  onClose: () => void;
}

/**
 * Preview modal for an AI-produced profile fragment.
 *
 * The fragment is wrapped into a minimal profile skeleton and fed through
 * the existing IM-01 parser. What the modal renders is the real ParseResult
 * so the user sees exactly what would land in the database.
 *
 * AI-07 is preview-only: the "Uebernehmen" button is rendered disabled and
 * the commit path lands in AI-08.
 */
export function CommitPreviewModal({ fragment, onClose }: CommitPreviewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const wrapped = useMemo(() => wrapFragmentForParser(fragment), [fragment]);
  const parseResult = useMemo<ParseResult>(() => parseProfile(wrapped), [wrapped]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const hasAny =
    parseResult.observations.length > 0 ||
    parseResult.supplements.length > 0 ||
    parseResult.openPoints.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="commit-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        ref={dialogRef}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900 dark:shadow-black/60"
        role="document"
      >
        <header className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2
            id="commit-preview-title"
            className="text-lg font-bold text-gray-900 dark:text-gray-100"
          >
            Profil-Aenderungen Vorschau
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Die KI hat folgende Aenderungen strukturiert. Nichts davon ist bisher gespeichert.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!hasAny && (
            <p
              data-testid="commit-preview-empty"
              className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            >
              Die KI-Antwort enthaelt Profil-Format, konnte aber nicht gelesen werden.
            </p>
          )}

          <ObservationsPreview result={parseResult} />
          <SupplementsPreview result={parseResult} />
          <OpenPointsPreview result={parseResult} />
          <ParserNotes result={parseResult} />

          <details className="mt-6 text-sm">
            <summary
              data-testid="commit-preview-raw-toggle"
              className="cursor-pointer text-gray-700 dark:text-gray-300"
            >
              Roh-Markdown anzeigen
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-3 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {wrapped}
            </pre>
          </details>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Schliessen
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Wird in AI-08 aktiviert"
            className="cursor-not-allowed rounded bg-blue-600/60 px-4 py-2 text-sm font-medium text-white dark:bg-blue-700/50"
          >
            Uebernehmen
          </button>
        </footer>
      </div>
    </div>
  );
}

function ObservationsPreview({ result }: { result: ParseResult }) {
  if (result.observations.length === 0) return null;
  return (
    <section className="mb-5" data-testid="commit-preview-observations">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        Neue Beobachtungen
      </h3>
      <ul className="space-y-3">
        {result.observations.map((obs, idx) => (
          <li
            key={`${obs.theme}-${idx}`}
            className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <p className="font-medium text-gray-900 dark:text-gray-100">{obs.theme}</p>
            <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs text-gray-700 dark:text-gray-300">
              {obs.status && <Field label="Status" value={obs.status} />}
              {obs.fact && <Field label="Beobachtung" value={obs.fact} />}
              {obs.pattern && <Field label="Muster" value={obs.pattern} />}
              {obs.selfRegulation && <Field label="Selbstregulation" value={obs.selfRegulation} />}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SupplementsPreview({ result }: { result: ParseResult }) {
  if (result.supplements.length === 0) return null;
  const categoryLabel: Record<string, string> = {
    daily: 'taeglich',
    regular: 'regelmaessig',
    'on-demand': 'bei Bedarf',
    paused: 'pausiert',
  };
  return (
    <section className="mb-5" data-testid="commit-preview-supplements">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        Supplemente
      </h3>
      <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
        {result.supplements.map((s, idx) => (
          <li key={`${s.name}-${idx}`}>
            {s.name} ({categoryLabel[s.category] ?? s.category})
          </li>
        ))}
      </ul>
    </section>
  );
}

function OpenPointsPreview({ result }: { result: ParseResult }) {
  if (result.openPoints.length === 0) return null;
  const byContext = new Map<string, typeof result.openPoints>();
  for (const p of result.openPoints) {
    const list = byContext.get(p.context);
    if (list) list.push(p);
    else byContext.set(p.context, [p]);
  }
  return (
    <section className="mb-5" data-testid="commit-preview-open-points">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        Offene Punkte
      </h3>
      <div className="space-y-2">
        {Array.from(byContext.entries()).map(([context, list]) => (
          <div key={context}>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{context}</p>
            <ul className="list-disc pl-5 text-sm text-gray-800 dark:text-gray-200">
              {list.map((p, idx) => (
                <li key={`${p.text}-${idx}`}>
                  {p.priority ? <span className="font-medium">[{p.priority}] </span> : null}
                  {p.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ParserNotes({ result }: { result: ParseResult }) {
  const { warnings, unrecognized } = result.report;
  if (warnings.length === 0 && unrecognized.length === 0) return null;
  return (
    <section
      data-testid="commit-preview-parser-notes"
      className="mb-5 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="mb-1 font-semibold">Parser-Hinweise</p>
      {warnings.length > 0 && (
        <ul className="list-disc pl-5">
          {warnings.map((w, idx) => (
            <li key={`w-${idx}`}>
              {w.section}: {w.message}
            </li>
          ))}
        </ul>
      )}
      {unrecognized.length > 0 && (
        <ul className="list-disc pl-5">
          {unrecognized.map((u, idx) => (
            <li key={`u-${idx}`}>Unbekannter Abschnitt: {u.heading}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-gray-600 dark:text-gray-400">{label}:</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </>
  );
}
