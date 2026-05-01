# ADR-0019: Multi-AI-Provider integration

**Date:** 2026-05-01
**Status:** Accepted

## Context

The foundation AI surface (AI-01 through AI-11) shipped against
Anthropic only. The `AIProvider` union was the literal `'anthropic'`,
the configured key was assumed to be `sk-ant-`, and every call site
(`useChat`, document-import `classify` / `extract`, profile-import
`requestCleanup`) hit `https://api.anthropic.com/v1/messages` directly
via the `streamCompletion` / `requestCompletion` helpers. The
foundation was a useful baseline but blocked broader user reach
(Google's Gemini, Mistral, OpenAI, local providers via LM Studio /
Ollama) and gave the user no path to switch providers without a
code change.

A donor module from the Bibliogon project carried a working
multi-provider client: provider presets, a two-adapter `LLMClient`
covering OpenAI-compatible and Anthropic-native endpoints, a
per-provider connection-test helper. The donor also carried a
parallel encryption pipeline and a separate passphrase prompt that
duplicated Phylax's master-password-derived AES-GCM-256 keystore
(ADR-0001 + ADR-0018). The integration question was which donor
artefacts to absorb and which to reject in favour of Phylax's
existing infrastructure.

This ADR records the architectural decisions taken across the
five-commit Multi-AI-Provider series (commits `ef49c65`, `bc3c24b`,
`3df95f6`, `c58129b`, `be4d312`).

## Decision

### 1. Adapter pattern via `LLMClient`

Provider variation is encapsulated in a single class
(`src/features/ai/llmClient.ts`) with two adapter paths:

- **OpenAI-compatible** (`/chat/completions` + Bearer auth):
  OpenAI, Google's Gemini OpenAI-compat endpoint, Mistral, LM
  Studio, Ollama, custom endpoints.
- **Anthropic native** (`/messages` + `x-api-key` +
  `anthropic-dangerous-direct-browser-access: true`).

`detectProvider(baseUrl)` selects the adapter from the configured
URL when no explicit `provider` is supplied; an explicit
`provider: 'anthropic'` override forces the native path even if
the user pointed at a private proxy URL.

Errors are status-mapped into a small vocabulary
(`auth_error`, `rate_limited`, `model_not_found`, `invalid_request`,
`server_error`, `offline`, `error`) and re-thrown as `LLMError`
instances. The streaming path translates these into the existing
`ChatError` shape so the four UI consumers continue to render
errors via the unchanged `errorMessageFor(t, error)` helper.

### 2. Phylax crypto reuse (donor crypto rejected)

The donor's `crypto.ts` (600 000 PBKDF2 iterations, separate
passphrase) was rejected. Phylax already runs 1.2M PBKDF2-SHA256
per ADR-0001 with the master-password-derived AES-GCM-256 key
held in the `keyStore` singleton, and ADR-0018's three-phase
re-encryption pipeline already covers the meta payload that the
AI configuration lives in.

The configured AI providers therefore ride on the existing
encrypted `meta.payload` blob (Q11 in the integration spec). No
new Dexie table was introduced; no `TABLES_TO_REENCRYPT` change
was needed. A user changing their master password automatically
re-encrypts their AI config alongside every other encrypted row;
a reencryption integration test in `db/reencrypt.test.ts` pins
this contract.

### 3. A2 split (streaming unified, structured-output Anthropic-only)

Pre-flight surfaced a capability mismatch between the donor's
`LLMClient` and the existing `requestCompletion`. `LLMClient`
covered streaming text on both adapters but did not implement
`tool_use`, multimodal `ContentBlock[]` (PDF page images), or
`stop_reason` inspection. `requestCompletion` was built around
exactly those features for the document-import classify / extract
flow.

The decision (Decision A2) was to split:

- **Streaming text** unifies via the new `aiCall.ts:aiStream`
  helper that wraps `LLMClient.stream()`. `useChat` and
  `requestCleanup` migrated to this. `streamCompletion` and
  `anthropicClient.ts` were deleted.
- **Structured output** stays Anthropic-only via
  `requestCompletion` + `tool_use`. `classify.ts` and
  `extract.ts` were left untouched. The Anthropic-specific
  types (`AnthropicMessage`, `ContentBlock`, `ToolDefinition`,
  `ToolUseBlock`, `RequestCompletionResult`) were preserved
  in `src/features/ai-chat/api/types.ts` and the file's
  docstring updated to document the post-4a scope.

The trigger for a future generic structured-output abstraction
is a second provider needing tool calling (OpenAI's function
calling, Google's function declarations); the shape differences
between Anthropic and OpenAI tool-call protocols make a premature
generic abstraction lossy. This is registered as a polish marker
in the ROADMAP follow-ups.

### 4. Seven presets shipped despite CORS limitations

The donor preset list classifies each provider's browser-CORS
reality:

| Provider  | corsHint         | Browser callable directly?                                                                                |
| --------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| Anthropic | `anthropic-flag` | Yes, with the dangerous-direct-browser-access opt-in (key visible in DevTools, accepted Phylax trade-off) |
| Google    | `ok`             | Yes, the Gemini OpenAI-compat endpoint allows browser CORS                                                |
| OpenAI    | `blocked`        | No, requires a proxy Phylax does not provide                                                              |
| Mistral   | `blocked`        | No, requires a proxy Phylax does not provide                                                              |
| LM Studio | `local`          | Yes if the user enables CORS in the local server                                                          |
| Ollama    | `local`          | Yes if the user sets `OLLAMA_ORIGINS`                                                                     |
| Custom    | `local`          | User's responsibility                                                                                     |

All seven are shipped as configurable presets despite OpenAI and
Mistral being unusable today: the wizard renders them with an
amber warning above the API-key field on step 2, the
configuration is allowed to save, `verifyKey` surfaces the failure
cleanly, and the user gets an educational signal about what's
possible once Phylax has a proxy infrastructure. Removing them
would force a code change later when proxies arrive; keeping them
behind a warning is no-cost and forward-compatible.

### 5. Single-shape to multi-shape migration on read

The pre-multi-provider `MetaPayload.aiConfig` carried a single
`AIProviderConfig` entry. The new shape is
`MultiProviderAIConfig = { providers: AIProviderConfig[];
activeProviderId: AIProvider }`. Migration is read-side and
idempotent:

- The new multi-shape branch in `parseAIConfig` is taken first.
- Legacy single-shape detected when the stored object lacks a
  `providers[]` array; wrapped in-memory into a one-element
  multi-shape with `activeProviderId = single.provider`. The
  next save persists the multi shape.
- Defence-in-depth on the multi-shape branch: malformed entries
  dropped, duplicate provider ids deduplicated last-wins, an
  `activeProviderId` that points outside `providers[*].provider`
  is repaired to `providers[0].provider` with a console warning,
  a fully-empty `providers[]` array returns `undefined` so the
  encoder omits the field entirely.

Re-running migration on already-migrated data is a no-op (the
multi-shape branch fires first). Existing users hit the legacy
branch on first load after upgrading; their next save normalises
the stored shape transparently.

### 6. Lazy-load wizard

`AiSetupWizard` is dynamically imported via `React.lazy` from
`AISettingsSection` and mounted under a `<Suspense fallback={null}>`
boundary scoped to the click trigger. The wizard chunk does not
ship in the main JS bundle; users who never open the wizard pay
zero cost beyond the small `AISettingsSection` summary surface.
First lazy boundary in the Phylax codebase; pattern is documented
inline.

### 7. Donor extraction lessons

Two donor bugs were caught and fixed during integration:

- `verifyKey.ts:verifyOpenAI` swallowed `DOMException
AbortError` from the local fetch catch and returned
  `{ status: 'offline' }` before the outer wrapper could
  classify it as `'timeout'`. Fix: re-throw `AbortError` so
  the outer `verifyKey` wrapper handles the abort path.
- `LLMClient.postJson` wrapped any thrown fetch error into
  `LLMError('offline')`, including `AbortError`, which broke
  the silent-abort contract that `aiStream` needs. Fix:
  re-throw `AbortError` unchanged.

Both bugs are donor inheritance: they were latent in Bibliogon
because the donor's call sites didn't depend on the abort path
the same way Phylax does. Lesson: integration testing against a
real consumer surfaces semantic gaps that donor unit tests alone
do not.

The donor's `i18n-keys.json` (8 languages) was the planned source
for archiving the 6 non-DE/EN translations to
`docs/extracted-modules/`. The donor `/tmp/ai-config-module/`
directory was cleaned before that archive task could complete; the
ports' DE+EN strings were re-derived from the donor wizard's
inline English fallbacks plus Phylax conventions. Future P-11
(ES/FR/EL translations) derives from the current DE+EN
`setup-wizard.*` keys, not from the donor source. The
`EXTRACTION-PATTERN.md` template recipe (donor's contribution to
`~/dev/templates/extraction-pattern.md`) is validated as a working
extraction pattern by this series.

## Consequences

- **Pattern reuse**: future feature integrations from external
  sources follow the same REJECT/PORT/COPY decision matrix.
  Phylax-existing infrastructure is reused, not duplicated.
- **Streaming abstraction available**: `aiStream` is the
  canonical multi-provider streaming entry point. New text-only
  streaming use cases (a future "summarise this document"
  button, a future ChatBot-in-the-import-flow surface) consume
  `aiStream` and get all seven providers for free.
- **Structured-output remains Anthropic-only**: `classify` and
  `extract` keep working unchanged. The future generic
  abstraction is a design exercise, not an immediate gap.
- **CORS-blocked providers are educational placeholders**: the
  OpenAI + Mistral configurations save and verify-fail cleanly.
  A future proxy-server feature unblocks them without a code
  change to the wizard or storage.
- **Forward-compatible with P-06**: the multi-provider AI
  config rides on `meta.payload` and re-encrypts under a new
  master password automatically; the integration test pins
  this.

## Alternatives rejected

- **Donor `crypto.ts`**: weaker iterations (600 000 vs Phylax's
  1.2M, ADR-0001), parallel keystore, separate passphrase
  prompt. Rejected; Phylax's existing encryption pipeline is
  used.
- **Donor `PassphrasePrompt`**: separate AI passphrase. Rejected;
  Phylax's `UnlockView` already covers authentication, AI
  config sits inside the same `meta.payload` blob, no second
  passphrase needed.
- **Donor `store.ts`**: parallel raw IndexedDB DB for AI config.
  Rejected; the Phylax Dexie `meta.payload` covers it, no new
  table introduced (Q3 from the integration spec; corrected
  during pre-flight).
- **Extending `LLMClient` with tool_use + multimodal for
  cross-provider structured output (A1)**: surface bloat with
  provider-specific branches that other providers stub or
  throw on; preserves a leaky abstraction. Rejected in favour
  of A2 (keep `requestCompletion` Anthropic-only).
- **Forcing `classify` / `extract` through `aiCall` with
  JSON-in-text parsing (A3)**: would lose `tool_use` schema
  enforcement, regression risk on Phase 4b document import.
  Rejected.
- **Single bundled commit instead of 5-commit split**: rejected
  after pre-flight; behaviour preservation in `useChat` +
  `requestCleanup` was flagged non-negotiable, isolating the
  aiCall refactor (Commit 4a) from the AISettingsSection
  rewrite (Commit 4b) keeps a regression in either trivially
  bisectable.

## Related ADRs

- ADR-0001: PBKDF2-SHA256 1 200 000 iterations (the foundation
  that this ADR's "crypto reuse" decision relies on).
- ADR-0003: Encrypted MetaPayload settings (the storage shape
  that the multi-provider AI config rides on).
- ADR-0018: Change master password three-phase pipeline (the
  re-encryption flow that this ADR confirms is forward-
  compatible without a `TABLES_TO_REENCRYPT` change).

## Manual smoke

`docs/manual-smoke/ai-multi-provider.md`: real-streaming
verification across providers, network-interruption behaviour,
backwards-compat with existing single-shape Anthropic users,
master-password-change preservation, lazy-load boundary, CORS
warning UX, dark-mode + 360 px fit.
