import type { AIProviderConfig } from '../../db/aiConfig';

export type { AIProvider, AIProviderConfig } from '../../db/aiConfig';

/**
 * Lifecycle status of the AI configuration.
 * - loading: initial read from storage in progress
 * - unconfigured: no stored config; user may enter a key
 * - configured: a stored config is loaded into state
 * - error: storage read failed
 */
export type AIConfigStatus = 'loading' | 'unconfigured' | 'configured' | 'error';

export interface AIConfigState {
  status: AIConfigStatus;
  /** Present only when status === 'configured'. */
  config?: AIProviderConfig;
  disclaimerAccepted: boolean;
  /** Human-readable error message when status === 'error'. */
  errorMessage?: string;
}

/**
 * Classification of an API key's format. Purely heuristic: Phylax never
 * validates keys against the live API. A "suspicious" key is still saved.
 */
export type KeyFormatWarning = 'ok' | 'suspicious';
