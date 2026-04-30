import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional override for the reload action. The default reloads the
   * current page. Tests inject a stub to assert the click without a
   * real navigation.
   */
  onReload?: () => void;
  /**
   * Optional override for the go-home action. The default navigates to
   * `/`. Tests inject a stub.
   */
  onGoHome?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Top-level React error boundary (P-09).
 *
 * Catches render-phase errors from any descendant. Displays a
 * localized friendly fallback with two recovery actions (reload + go
 * home) and a collapsible `<details>` block carrying the raw error
 * message + stack so users can copy-paste the diagnostic into a bug
 * report. No telemetry, no error reporting service - per CLAUDE.md
 * Phylax does not call out to any third-party from runtime code.
 *
 * Single top-level boundary for v1.0; per-route boundaries are a
 * deferred refinement until a concrete failure mode justifies them.
 *
 * Mounted inside the i18n initialisation chain in `src/main.tsx`. If
 * i18next fails to initialise, `t()` returns the key string verbatim,
 * which is degraded but still a working fallback (better than a blank
 * white page).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Dev visibility only. No telemetry per CLAUDE.md.
    console.error('[ErrorBoundary] caught render-phase error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render(): ReactNode {
    const { error, errorInfo } = this.state;
    if (error) {
      return (
        <ErrorFallback
          error={error}
          errorInfo={errorInfo}
          onReload={this.props.onReload}
          onGoHome={this.props.onGoHome}
        />
      );
    }
    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  onReload?: () => void;
  onGoHome?: () => void;
}

function defaultReload(): void {
  window.location.reload();
}

function defaultGoHome(): void {
  window.location.assign('/');
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  // Modern path: navigator.clipboard. Available in HTTPS + localhost
  // contexts. Fall back to document.execCommand('copy') on older
  // browsers; that path is being deprecated but still works in
  // Firefox / Safari without secure-context concerns.
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy path.
    }
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function ErrorFallback({ error, errorInfo, onReload, onGoHome }: ErrorFallbackProps) {
  const { t } = useTranslation('app-shell');
  const reload = onReload ?? defaultReload;
  const goHome = onGoHome ?? defaultGoHome;
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // Concatenate message + componentStack for a single copy-target.
  // Stack is undefined in some browsers; guard with empty string.
  const detail = [error.message, error.stack ?? '', errorInfo?.componentStack ?? '']
    .filter((s) => s.trim().length > 0)
    .join('\n\n');

  async function handleCopy(): Promise<void> {
    const ok = await copyTextToClipboard(detail);
    setCopyState(ok ? 'copied' : 'failed');
    // Reset to idle after 2.5s so the user can retry without state lingering.
    setTimeout(() => setCopyState('idle'), 2500);
  }

  return (
    <div
      role="alert"
      className="flex min-h-screen items-start justify-center bg-gray-50 p-6 dark:bg-gray-950"
    >
      <div className="w-full max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-sm dark:border-red-900 dark:bg-gray-900">
        <h1
          className="mb-3 flex items-center gap-2 text-xl font-bold text-red-800 dark:text-red-300"
        >
          <span aria-hidden>⚠</span> {t('error-boundary.heading')}
        </h1>
        <p className="mb-4 text-sm text-gray-800 dark:text-gray-200">
          {t('error-boundary.body')}
        </p>
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reload}
            className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {t('error-boundary.action.reload')}
          </button>
          <button
            type="button"
            onClick={goHome}
            className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('error-boundary.action.home')}
          </button>
        </div>
        <details className="rounded-sm border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-950">
          <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
            {t('error-boundary.details-summary')}
          </summary>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void handleCopy()}
              data-testid="error-boundary-copy"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-sm border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copyState === 'copied'
                ? t('error-boundary.action.copied')
                : copyState === 'failed'
                  ? t('error-boundary.action.copy-failed')
                  : t('error-boundary.action.copy')}
            </button>
          </div>
          <pre
            data-testid="error-boundary-detail"
            className="mt-2 overflow-x-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200"
          >
            {detail}
          </pre>
        </details>
      </div>
    </div>
  );
}
