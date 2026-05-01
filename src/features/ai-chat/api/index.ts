/**
 * Public surface of the Anthropic-specific structured-output API.
 * Streaming text was historically served by `streamCompletion` from
 * `./anthropicClient`; that module was deleted in AI Commit 4a and
 * replaced by the multi-provider `aiStream` helper at
 * `src/features/ai/aiCall.ts`. The remaining `requestCompletion`
 * is intentionally Anthropic-only because it carries `tool_use`,
 * multimodal content blocks, and `stop_reason` semantics that do
 * not have a clean cross-provider equivalent yet.
 */
export { requestCompletion } from './requestCompletion';
export type {
  AnthropicMessage,
  ChatError,
  ContentBlock,
  TextBlock,
  ImageBlock,
  ToolUseBlock,
  ToolResultBlock,
  ToolDefinition,
  RequestCompletionOptions,
  RequestCompletionResult,
} from './types';
