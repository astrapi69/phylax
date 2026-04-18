import { useEffect, useMemo, useRef, useState } from 'react';
import type { DetectedFragment } from '../detection';
import { wrapFragmentForParser } from '../detection';
import { parseProfile } from '../../profile-import/parser';
import type { Supplement } from '../../../domain';
import {
  ProfileRepository,
  ObservationRepository,
  SupplementRepository,
} from '../../../db/repositories';
import {
  computeDiff,
  commitFragment,
  commitSummaryText,
  diffItemCount,
  buildVersionDescription,
  type ProfileDiff,
  type ObservationChange,
  type SupplementChange,
} from '../commit';

interface CommitPreviewModalProps {
  fragment: DetectedFragment;
  onClose: () => void;
  /**
   * Called after a successful commit with the German summary sentence
   * and the result counts. Parent is expected to close the modal.
   */
  onCommitSuccess?: (summary: string) => void;
}

type ModalState =
  | { kind: 'loading' }
  | { kind: 'ready'; diff: ProfileDiff; wrapped: string; profileId: string }
  | { kind: 'error'; message: string };

type CommitState = { kind: 'idle' } | { kind: 'committing' } | { kind: 'error'; message: string };

const SUPPLEMENT_CATEGORY_LABEL: Record<Supplement['category'], string> = {
  daily: 'taeglich',
  regular: 'regelmaessig',
  'on-demand': 'bei Bedarf',
  paused: 'pausiert',
};

const OBSERVATION_FIELD_LABEL: Record<'status' | 'fact' | 'pattern' | 'selfRegulation', string> = {
  status: 'Status',
  fact: 'Beobachtung',
  pattern: 'Muster',
  selfRegulation: 'Selbstregulation',
};

const SUPPLEMENT_FIELD_LABEL: Record<
  'category' | 'brand' | 'recommendation' | 'rationale',
  string
> = {
  category: 'Kategorie',
  brand: 'Marke',
  recommendation: 'Empfehlung',
  rationale: 'Begruendung',
};

/**
 * Diff-aware preview of an AI-produced profile fragment.
 *
 * The modal loads the current profile's observations and supplements so
 * it can match the fragment against real data. Each entity is rendered
 * as new / changed / unchanged; changed fields show old->new inline.
 * Unchanged items are hidden by default behind a toggle.
 *
 * AI-08a is still preview-only. The Uebernehmen button is disabled and
 * the version description is editable but unused until AI-08b lands.
 */
export function CommitPreviewModal({
  fragment,
  onClose,
  onCommitSuccess,
}: CommitPreviewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<ModalState>({ kind: 'loading' });
  const [versionDescription, setVersionDescription] = useState('');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [commitState, setCommitState] = useState<CommitState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const profile = await new ProfileRepository().getCurrentProfile();
        if (!profile) {
          if (!cancelled) setState({ kind: 'error', message: 'Kein Profil gefunden.' });
          return;
        }
        const [observations, supplements] = await Promise.all([
          new ObservationRepository().listByProfile(profile.id),
          new SupplementRepository().listByProfile(profile.id),
        ]);
        const wrapped = wrapFragmentForParser(fragment);
        const parseResult = parseProfile(wrapped);
        const diff = computeDiff(parseResult, { observations, supplements });
        if (cancelled) return;
        setState({ kind: 'ready', diff, wrapped, profileId: profile.id });
        setVersionDescription(buildVersionDescription(diff));
      } catch {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: 'App ist gesperrt. Bitte entsperre sie und versuche erneut.',
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [fragment]);

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

  const canCommit = useMemo(() => {
    if (state.kind !== 'ready') return false;
    if (commitState.kind === 'committing') return false;
    return diffItemCount(state.diff) > 0 && versionDescription.trim().length > 0;
  }, [state, versionDescription, commitState]);

  const commitDisabledReason = useMemo(() => {
    if (state.kind !== 'ready') return '';
    if (diffItemCount(state.diff) === 0) {
      return 'Keine Aenderungen - die KI-Vorschlaege entsprechen dem aktuellen Profil.';
    }
    if (versionDescription.trim().length === 0) return 'Beschreibung erforderlich.';
    return '';
  }, [state, versionDescription]);

  async function handleCommit(): Promise<void> {
    if (state.kind !== 'ready' || !canCommit) return;
    setCommitState({ kind: 'committing' });
    try {
      const result = await commitFragment({
        diff: state.diff,
        versionDescription: versionDescription.trim(),
        profileId: state.profileId,
      });
      const summary = commitSummaryText(result);
      onCommitSuccess?.(summary);
      onClose();
    } catch (err) {
      setCommitState({
        kind: 'error',
        message: commitErrorMessage(err),
      });
    }
  }

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
          {state.kind === 'loading' && (
            <p
              data-testid="commit-preview-loading"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              Profil wird geladen...
            </p>
          )}

          {state.kind === 'error' && (
            <p
              data-testid="commit-preview-error"
              className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            >
              {state.message}
            </p>
          )}

          {state.kind === 'ready' && (
            <ReadyBody
              diff={state.diff}
              wrapped={state.wrapped}
              versionDescription={versionDescription}
              onVersionDescriptionChange={setVersionDescription}
              showUnchanged={showUnchanged}
              onShowUnchangedChange={setShowUnchanged}
              emptyHint={commitDisabledReason}
            />
          )}
        </div>

        {commitState.kind === 'error' && (
          <div
            data-testid="commit-error"
            className="border-t border-red-300 bg-red-50 px-6 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {commitState.message}
          </div>
        )}

        <footer className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={commitState.kind === 'committing'}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Schliessen
          </button>
          <button
            type="button"
            onClick={() => void handleCommit()}
            disabled={!canCommit}
            aria-disabled={!canCommit}
            title={canCommit ? undefined : commitDisabledReason || 'Profil wird geladen...'}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600/60 dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-blue-700/50"
          >
            {commitState.kind === 'committing' ? 'Wird uebernommen...' : 'Uebernehmen'}
          </button>
        </footer>
      </div>
    </div>
  );
}

interface ReadyBodyProps {
  diff: ProfileDiff;
  wrapped: string;
  versionDescription: string;
  onVersionDescriptionChange: (value: string) => void;
  showUnchanged: boolean;
  onShowUnchangedChange: (value: boolean) => void;
  emptyHint: string;
}

function ReadyBody({
  diff,
  wrapped,
  versionDescription,
  onVersionDescriptionChange,
  showUnchanged,
  onShowUnchangedChange,
  emptyHint,
}: ReadyBodyProps) {
  const isEmpty = diffItemCount(diff) === 0;

  return (
    <div>
      {diff.warnings.length > 0 && (
        <section
          data-testid="commit-preview-warnings"
          className="mb-5 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="mb-1 font-semibold">Hinweise</p>
          <ul className="list-disc pl-5">
            {diff.warnings.map((w, idx) => (
              <li key={idx}>{w.message}</li>
            ))}
          </ul>
        </section>
      )}

      {isEmpty && (
        <p
          data-testid="commit-preview-empty"
          className="mb-5 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {emptyHint || 'Keine Aenderungen vorhanden.'}
        </p>
      )}

      <label className="mb-5 flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={showUnchanged}
          onChange={(e) => onShowUnchangedChange(e.target.checked)}
          data-testid="commit-preview-unchanged-toggle"
        />
        Unveraenderte Felder und Eintraege anzeigen
      </label>

      <ObservationsSection diff={diff} showUnchanged={showUnchanged} />
      <SupplementsSection diff={diff} showUnchanged={showUnchanged} />
      <OpenPointsSection diff={diff} />

      <section className="mb-5" data-testid="commit-preview-version">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
          Versionseintrag
        </h3>
        <label htmlFor="commit-preview-version-input" className="sr-only">
          Beschreibung der Aenderung
        </label>
        <input
          id="commit-preview-version-input"
          type="text"
          value={versionDescription}
          onChange={(e) => onVersionDescriptionChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Erscheint in der Versionsgeschichte. Kann vor dem Uebernehmen angepasst werden.
        </p>
      </section>

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
  );
}

function ObservationsSection({
  diff,
  showUnchanged,
}: {
  diff: ProfileDiff;
  showUnchanged: boolean;
}) {
  const { new: newOnes, changed, unchanged } = diff.observations;
  if (newOnes.length === 0 && changed.length === 0 && (!showUnchanged || unchanged.length === 0)) {
    return null;
  }
  return (
    <section className="mb-5" data-testid="commit-preview-observations">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        Beobachtungen
      </h3>
      <ul className="space-y-3">
        {newOnes.map((o, idx) => (
          <li
            key={`new-${idx}`}
            data-testid="observation-new"
            className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm dark:border-green-800 dark:bg-green-950/30"
          >
            <Header badge="neu" badgeClass={NEW_BADGE} title={o.theme} />
            <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs text-gray-800 dark:text-gray-200">
              {o.status.trim().length > 0 && <Field label="Status" value={o.status} />}
              {o.fact.trim().length > 0 && <Field label="Beobachtung" value={o.fact} />}
              {o.pattern.trim().length > 0 && <Field label="Muster" value={o.pattern} />}
              {o.selfRegulation.trim().length > 0 && (
                <Field label="Selbstregulation" value={o.selfRegulation} />
              )}
            </dl>
          </li>
        ))}
        {changed.map((c, idx) => (
          <ObservationChangeRow key={`changed-${idx}`} change={c} showUnchanged={showUnchanged} />
        ))}
        {showUnchanged &&
          unchanged.map((o) => (
            <li
              key={`unchanged-${o.id}`}
              data-testid="observation-unchanged"
              className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            >
              <Header badge="unveraendert" badgeClass={UNCHANGED_BADGE} title={o.theme} />
            </li>
          ))}
      </ul>
    </section>
  );
}

function ObservationChangeRow({
  change,
  showUnchanged,
}: {
  change: ObservationChange;
  showUnchanged: boolean;
}) {
  const fields: Array<'status' | 'fact' | 'pattern' | 'selfRegulation'> = [
    'status',
    'fact',
    'pattern',
    'selfRegulation',
  ];
  return (
    <li
      data-testid="observation-changed"
      className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30"
    >
      <Header badge="aktualisiert" badgeClass={CHANGED_BADGE} title={change.existing.theme} />
      <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs">
        {fields.map((field) => {
          const isChanged = change.fieldsChanged.includes(field);
          if (!isChanged && !showUnchanged) return null;
          const label = OBSERVATION_FIELD_LABEL[field];
          if (isChanged) {
            return (
              <div key={field} className="contents">
                <dt className="font-medium text-gray-700 dark:text-gray-300">{label}:</dt>
                <dd className="text-gray-800 dark:text-gray-200">
                  <span className="text-gray-500 line-through dark:text-gray-500">
                    {change.existing[field] || '(leer)'}
                  </span>{' '}
                  <span aria-hidden className="mx-1 text-gray-500">
                    →
                  </span>{' '}
                  <span className="font-medium">{change.merged[field]}</span>
                </dd>
              </div>
            );
          }
          return (
            <div key={field} className="contents">
              <dt className="font-medium text-gray-500 dark:text-gray-500">{label}:</dt>
              <dd className="italic text-gray-500 dark:text-gray-500">(unveraendert)</dd>
            </div>
          );
        })}
      </dl>
    </li>
  );
}

function SupplementsSection({
  diff,
  showUnchanged,
}: {
  diff: ProfileDiff;
  showUnchanged: boolean;
}) {
  const { new: newOnes, changed, unchanged } = diff.supplements;
  if (newOnes.length === 0 && changed.length === 0 && (!showUnchanged || unchanged.length === 0)) {
    return null;
  }
  return (
    <section className="mb-5" data-testid="commit-preview-supplements">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        Supplemente
      </h3>
      <ul className="space-y-2">
        {newOnes.map((s, idx) => (
          <li
            key={`new-${idx}`}
            data-testid="supplement-new"
            className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-gray-800 dark:border-green-800 dark:bg-green-950/30 dark:text-gray-200"
          >
            <Header
              badge="neu"
              badgeClass={NEW_BADGE}
              title={`${s.name} (${SUPPLEMENT_CATEGORY_LABEL[s.category]})`}
            />
          </li>
        ))}
        {changed.map((c, idx) => (
          <SupplementChangeRow key={`changed-${idx}`} change={c} showUnchanged={showUnchanged} />
        ))}
        {showUnchanged &&
          unchanged.map((s) => (
            <li
              key={`unchanged-${s.id}`}
              data-testid="supplement-unchanged"
              className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            >
              <Header
                badge="unveraendert"
                badgeClass={UNCHANGED_BADGE}
                title={`${s.name} (${SUPPLEMENT_CATEGORY_LABEL[s.category]})`}
              />
            </li>
          ))}
      </ul>
    </section>
  );
}

function SupplementChangeRow({
  change,
  showUnchanged,
}: {
  change: SupplementChange;
  showUnchanged: boolean;
}) {
  const fields: Array<'category' | 'brand' | 'recommendation' | 'rationale'> = [
    'category',
    'brand',
    'recommendation',
    'rationale',
  ];
  return (
    <li
      data-testid="supplement-changed"
      className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30"
    >
      <Header badge="aktualisiert" badgeClass={CHANGED_BADGE} title={change.existing.name} />
      <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs">
        {fields.map((field) => {
          const isChanged = change.fieldsChanged.includes(field);
          if (!isChanged && !showUnchanged) return null;
          const label = SUPPLEMENT_FIELD_LABEL[field];
          if (isChanged) {
            const existingValue =
              field === 'category'
                ? SUPPLEMENT_CATEGORY_LABEL[change.existing.category]
                : change.existing[field] || '(leer)';
            const mergedValue =
              field === 'category'
                ? SUPPLEMENT_CATEGORY_LABEL[change.merged.category]
                : change.merged[field] || '(leer)';
            return (
              <div key={field} className="contents">
                <dt className="font-medium text-gray-700 dark:text-gray-300">{label}:</dt>
                <dd className="text-gray-800 dark:text-gray-200">
                  <span className="text-gray-500 line-through dark:text-gray-500">
                    {existingValue}
                  </span>{' '}
                  <span aria-hidden className="mx-1 text-gray-500">
                    →
                  </span>{' '}
                  <span className="font-medium">{mergedValue}</span>
                </dd>
              </div>
            );
          }
          return (
            <div key={field} className="contents">
              <dt className="font-medium text-gray-500 dark:text-gray-500">{label}:</dt>
              <dd className="italic text-gray-500 dark:text-gray-500">(unveraendert)</dd>
            </div>
          );
        })}
      </dl>
    </li>
  );
}

function OpenPointsSection({ diff }: { diff: ProfileDiff }) {
  if (diff.openPoints.new.length === 0) return null;
  const byContext = new Map<string, typeof diff.openPoints.new>();
  for (const p of diff.openPoints.new) {
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
          <div
            key={context}
            className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm dark:border-green-800 dark:bg-green-950/30"
          >
            <Header badge="neu" badgeClass={NEW_BADGE} title={context} />
            <ul className="mt-1 list-disc pl-5 text-gray-800 dark:text-gray-200">
              {list.map((p, idx) => (
                <li key={idx}>
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

const NEW_BADGE = 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100';
const CHANGED_BADGE = 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100';
const UNCHANGED_BADGE = 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

function Header({
  badge,
  badgeClass,
  title,
}: {
  badge: string;
  badgeClass: string;
  title: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}
      >
        {badge}
      </span>
      <span className="font-medium text-gray-900 dark:text-gray-100">{title}</span>
    </div>
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

/**
 * Map a commit error to a German sentence for the modal's inline banner.
 * Crypto errors (key store locked) surface as a lock hint; anything else
 * falls back to the original message prefixed with "Fehler:".
 */
function commitErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('no key') || msg.includes('locked') || msg.includes('unlock')) {
      return 'App wurde gesperrt. Bitte entsperre sie und versuche erneut.';
    }
    if (err.message) return `Fehler beim Speichern: ${err.message}`;
  }
  return 'Fehler beim Speichern: Unbekannter Fehler.';
}
