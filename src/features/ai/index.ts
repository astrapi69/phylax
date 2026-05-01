/**
 * Public surface of the multi-AI-provider feature (Commit 1: Foundation).
 *
 * This commit ships the provider adapters + presets + connection-test
 * helper without touching any existing UI or storage. Subsequent
 * commits in the series wire these into Phylax's encrypted MetaPayload
 * (Commit 2), introduce the AiSetupWizard (Commit 3), and refactor
 * existing AI call sites to a single `aiCall()` helper that consumes
 * `LLMClient` (Commit 4).
 */

export {
  PROVIDER_PRESETS,
  PROVIDER_IDS,
  detectProvider,
  getProviderPreset,
  type ProviderPreset,
} from './providers';

export {
  LLMClient,
  LLMError,
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
  type LLMConfig,
  type StreamChunk,
} from './llmClient';

export { verifyKey, type AiVerifyConfig, type VerifyResult } from './verifyKey';

// AiSetupWizard is exported as a default for `React.lazy()` consumers
// (Commit 4 wires it via dynamic import). Named re-export retained
// for tests + non-lazy consumers.
export { default as AiSetupWizard } from './AiSetupWizard';
