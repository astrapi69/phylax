import { aiStream } from '../../ai/aiCall';
import type { ChatError } from '../../ai-chat/api/types';
import { readAIConfig } from '../../../db/aiConfig';
import { CLEANUP_SYSTEM_PROMPT, isImpossibleResponse } from './cleanupPrompt';

/**
 * Result of a cleanup round-trip. The import state machine switches on
 * `kind` to render the appropriate UI. No throws: all failure modes
 * surface as typed variants so the caller never needs try/catch.
 */
export type CleanupResult =
  | { kind: 'ok'; cleaned: string }
  | { kind: 'impossible' }
  | { kind: 'not-configured' }
  | { kind: 'error'; error: ChatError };

/**
 * Send the user's unparseable Markdown to Anthropic with the cleanup
 * system prompt. Awaits the full response via onComplete (no live
 * streaming UI); returns a typed Result.
 *
 * The function itself owns the Promise-adapter around streamCompletion
 * so UI callers stay free of stream lifecycle concerns.
 *
 * @param brokenMarkdown - the user's original paste that failed parsing
 * @param options.signal - optional AbortSignal to cancel in-flight calls
 */
export async function requestCleanup(
  brokenMarkdown: string,
  options: { signal?: AbortSignal } = {},
): Promise<CleanupResult> {
  const config = await readAIConfig();
  if (!config) return { kind: 'not-configured' };

  return new Promise<CleanupResult>((resolve) => {
    void aiStream({
      config,
      system: CLEANUP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: brokenMarkdown }],
      maxTokens: 4096,
      signal: options.signal,
      onToken: () => {
        // Collected via onComplete below; no incremental UI.
      },
      onComplete: (fullText) => {
        const trimmed = fullText.trim();
        if (isImpossibleResponse(trimmed)) {
          resolve({ kind: 'impossible' });
          return;
        }
        resolve({ kind: 'ok', cleaned: trimmed });
      },
      onError: (error) => {
        resolve({ kind: 'error', error });
      },
    });
  });
}
