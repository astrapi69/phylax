import type { ChatError } from '../ai-chat/api';

/**
 * Discriminated error union for IMP-03 AI calls. Each kind maps to
 * a localized user-facing message in `document-import.error.ai.*`
 * and a retry policy in `withRetry`.
 *
 * Distinct from `ChatError` (the chat-path wire error) because:
 * - IMP-03 has classes that the chat path doesn't (content-policy,
 *   payload-too-large, response-truncated, malformed-tool-use,
 *   ai-config-missing).
 * - IMP-03 surfaces user-actionable guidance per class
 *   ("retry in 1 minute", "check your API key", etc.); the chat
 *   path's generic German error is enough for the streaming UX.
 */
export type AiCallErrorKind =
  | 'network'
  | 'rate-limit'
  | 'auth'
  | 'content-policy'
  | 'payload-too-large'
  | 'response-truncated'
  | 'malformed-response'
  | 'ai-config-missing'
  | 'server';

export class AiCallError extends Error {
  constructor(
    public readonly kind: AiCallErrorKind,
    /** Human-readable detail; not localized. For dev tooling, not user UI. */
    detail?: string,
  ) {
    super(detail ?? kind);
    this.name = 'AiCallError';
  }
}

/**
 * Map a `ChatError` (from `requestCompletion`) into the broader
 * `AiCallError` taxonomy. Some classes (content-policy,
 * payload-too-large, response-truncated, malformed-response) are
 * detected by IMP-03 logic above this mapper rather than by HTTP
 * status alone, so they get their own throw paths in `classify` /
 * `extract`.
 */
export function mapChatErrorToAiCallError(err: ChatError): AiCallError {
  switch (err.kind) {
    case 'network':
      return new AiCallError('network');
    case 'rate-limit':
      return new AiCallError('rate-limit');
    case 'auth':
      return new AiCallError('auth');
    case 'server':
      return new AiCallError('server');
    case 'unknown':
      return new AiCallError('malformed-response', err.message);
  }
}

/** True when the error class is safe to retry with backoff. */
export function isRetryableAiCallError(err: AiCallError): boolean {
  return err.kind === 'network' || err.kind === 'rate-limit';
}

/**
 * Retry helper with exponential backoff. Used by IMP-03 for
 * `requestCompletion` calls that hit transient errors (network,
 * rate-limit). Non-transient errors (auth, content-policy, etc.)
 * surface immediately.
 *
 * Backoff schedule: 1s → 2s → 4s. Total wait across 3 attempts:
 * up to 7s. Aborts honored throughout.
 */
export interface RetryOptions {
  signal?: AbortSignal;
  /** For tests: override delay function so tests don't wait real seconds. */
  delay?: (ms: number) => Promise<void>;
}

const RETRY_DELAYS_MS = [1000, 2000, 4000];

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const delay = options.delay ?? defaultDelay;
  let lastError: AiCallError | undefined;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (options.signal?.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    try {
      return await fn();
    } catch (err) {
      const aiErr = err instanceof AiCallError ? err : null;
      if (!aiErr) throw err;
      lastError = aiErr;
      if (!isRetryableAiCallError(aiErr) || attempt >= RETRY_DELAYS_MS.length) {
        throw aiErr;
      }
      await delay(RETRY_DELAYS_MS[attempt] ?? 1000);
    }
  }
  // Unreachable in practice (loop returns or throws), but TS needs it.
  /* v8 ignore next */
  throw lastError ?? new AiCallError('malformed-response', 'withRetry exhausted without error');
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
