import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { generateId } from '../../crypto';
import { DEFAULT_ANTHROPIC_MODEL } from '../../db/aiConfig';
import {
  LabReportRepository,
  LabValueRepository,
  ObservationRepository,
  OpenPointRepository,
  ProfileRepository,
  SupplementRepository,
} from '../../db/repositories';
import { useAIConfig, generateSystemPrompt } from '../ai-config';
import { streamCompletion } from './api';
import type { AnthropicMessage, ChatError } from './api/types';
import { formatProfileShareSummary, type ProfileShareCounts } from './profileSummary';
import type { ProfileDiff } from './commit';
import {
  type GuidedSessionState,
  endGuidedSession as endGuidedSessionState,
  initGuidedSession,
  markSectionsFromDiff as markGuidedSectionsFromDiff,
  startGuidedSession as startGuidedSessionState,
} from './guided';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'context';
  content: string;
  timestamp: number;
  /** True while the assistant message is being streamed. */
  streaming?: boolean;
  /** Set on system messages that surface a structured error. */
  errorKind?: ChatError['kind'];
  /**
   * Counts for a `context` message so the UI can render a collapsed card
   * (observation / lab / supplement / open-point / warning-sign totals)
   * without parsing the Markdown body.
   */
  contextCounts?: ProfileShareCounts;
}

export interface UseChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  isSharingProfile: boolean;
  sendMessage: (content: string) => Promise<void>;
  cancelStream: () => void;
  clearChat: () => void;
  /**
   * Load the current profile plus its child entities, format a compact
   * Markdown summary, and append it to the chat as a `context` message.
   * Does NOT trigger an API call; the AI sees the summary on the next
   * sendMessage (which matches AI-10: no background network calls).
   */
  shareProfile: () => Promise<void>;
  /**
   * Message IDs that already had their profile fragment committed to the
   * database. Used by MessageBubble to hide the "In Profil uebernehmen"
   * button so the user cannot commit the same fragment twice.
   */
  committedMessageIds: ReadonlySet<string>;
  /** Mark an assistant message as committed. Idempotent. */
  markMessageCommitted: (id: string) => void;
  /** Append a locally-generated system message (commit summary, errors). */
  appendSystemMessage: (content: string, errorKind?: ChatError['kind']) => void;
  /** AI-06 guided-session state. Ephemeral, not persisted. */
  guidedSession: GuidedSessionState;
  /**
   * Start a guided session. Appends the hardcoded opening assistant message
   * and invalidates the cached system prompt so the next sendMessage rebuilds
   * it with the guided-session framing.
   */
  startGuidedSession: () => void;
  /**
   * End the active guided session. Appends a system message, clears guided
   * state, and invalidates the cached system prompt so subsequent turns use
   * the normal (non-guided) system prompt.
   */
  endGuidedSession: () => void;
  /**
   * Record a successful commit against the guided session. Marks any section
   * (observations / supplements / open-points) that received new or changed
   * content. No-op when the guided session is inactive.
   */
  markGuidedSessionCommit: (diff: ProfileDiff) => void;
}

/**
 * Chat state machine for the Anthropic-backed AI assistant.
 *
 * Messages are ephemeral by design: React state only, no IndexedDB, no
 * localStorage. Page reload or clearChat discards the transcript.
 *
 * The system prompt is generated once per session on the first sendMessage
 * (requires the current profile and its observations; pinned via ref to keep
 * context stable across the conversation). clearChat drops the cache so the
 * next message regenerates it against whatever profile state exists then.
 *
 * AI-10 constraint: no background network calls. streamCompletion is invoked
 * only from sendMessage; no polling, prefetch, or keepalive.
 */
export function useChat(): UseChatResult {
  const { t } = useTranslation('ai-chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSharingProfile, setIsSharingProfile] = useState(false);
  const [committedMessageIds, setCommittedMessageIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [guidedSession, setGuidedSession] = useState<GuidedSessionState>(() => initGuidedSession());
  const abortRef = useRef<AbortController | null>(null);
  const systemPromptRef = useRef<string | null>(null);
  // Kept in sync with guidedSession.active so sendMessage builds the prompt
  // with the correct `guided` flag when the cached prompt is rebuilt. State
  // updates are async; a ref captures the latest value synchronously.
  const guidedActiveRef = useRef<boolean>(false);
  const { state: configState } = useAIConfig();

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      const userMsg = makeMessage('user', trimmed);

      if (configState.status === 'loading') {
        setMessages((prev) => [...prev, userMsg, makeSystemMessage(t('system.config-loading'))]);
        return;
      }
      if (configState.status === 'unconfigured') {
        setMessages((prev) => [...prev, userMsg, makeSystemMessage(t('system.not-configured'))]);
        return;
      }
      if (configState.status === 'error' || !configState.config) {
        setMessages((prev) => [...prev, userMsg, makeSystemMessage(t('system.locked'))]);
        return;
      }
      const config = configState.config;

      // Generate the system prompt on the first message of the session.
      if (systemPromptRef.current === null) {
        try {
          const profile = await new ProfileRepository().getCurrentProfile();
          if (!profile) {
            setMessages((prev) => [
              ...prev,
              userMsg,
              makeSystemMessage(t('common:error.no-profile')),
            ]);
            return;
          }
          const observations = await new ObservationRepository().listByProfile(profile.id);
          systemPromptRef.current = generateSystemPrompt({
            profile,
            observations,
            guided: guidedActiveRef.current,
          });
        } catch {
          setMessages((prev) => [...prev, userMsg, makeSystemMessage(t('system.locked'))]);
          return;
        }
      }

      // Append user + empty streaming assistant placeholder atomically.
      const assistantMsg = makeMessage('assistant', '', { streaming: true });
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const apiMessages = toApiMessages([...messages, userMsg], t('system.context-framing'));

      await streamCompletion({
        apiKey: config.apiKey,
        model: config.model ?? DEFAULT_ANTHROPIC_MODEL,
        system: systemPromptRef.current,
        messages: apiMessages,
        signal: controller.signal,
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + token } : m)),
          );
        },
        onComplete: () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, streaming: false } : m)),
          );
          setIsStreaming(false);
          abortRef.current = null;
        },
        onError: (error) => {
          setMessages((prev) => {
            const withStreamingCleared = prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, streaming: false } : m,
            );
            return [
              ...withStreamingCleared,
              {
                id: generateId(),
                role: 'system' as const,
                content: errorMessageFor(t, error),
                timestamp: Date.now(),
                errorKind: error.kind,
              },
            ];
          });
          setIsStreaming(false);
          abortRef.current = null;
        },
      });
    },
    [configState, isStreaming, messages, t],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // streamCompletion is silent on AbortError, so finalize state here.
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
    setIsStreaming(false);
  }, []);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setIsStreaming(false);
    systemPromptRef.current = null;
    setCommittedMessageIds(new Set<string>());
    // clearChat ends any active guided session; progress is tied to the
    // transcript it lived in.
    guidedActiveRef.current = false;
    setGuidedSession(initGuidedSession());
  }, []);

  const shareProfile = useCallback(async () => {
    if (isSharingProfile || isStreaming) return;
    setIsSharingProfile(true);
    try {
      const profile = await new ProfileRepository().getCurrentProfile();
      if (!profile) {
        setMessages((prev) => [...prev, makeSystemMessage(t('common:error.no-profile'))]);
        return;
      }
      const profileId = profile.id;
      const labValueRepo = new LabValueRepository();
      const [observations, reports, supplements, openPoints] = await Promise.all([
        new ObservationRepository().listByProfile(profileId),
        new LabReportRepository(labValueRepo).listByProfileDateDescending(profileId),
        new SupplementRepository().listByProfile(profileId),
        new OpenPointRepository().listUnresolved(profileId),
      ]);
      const latestReport = reports[0] ?? null;
      const latestReportValues = latestReport
        ? await labValueRepo.listByReport(latestReport.id)
        : [];

      const { markdown, counts } = formatProfileShareSummary(t, {
        profile,
        observations,
        latestReport,
        latestReportValues,
        supplements,
        unresolvedOpenPoints: openPoints,
      });

      const contextMsg: ChatMessage = {
        id: generateId(),
        role: 'context',
        content: markdown,
        timestamp: Date.now(),
        contextCounts: counts,
      };
      setMessages((prev) => [...prev, contextMsg]);
    } catch {
      setMessages((prev) => [...prev, makeSystemMessage(t('system.locked'))]);
    } finally {
      setIsSharingProfile(false);
    }
  }, [isSharingProfile, isStreaming, t]);

  const markMessageCommitted = useCallback((id: string) => {
    setCommittedMessageIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const startGuidedSession = useCallback(() => {
    guidedActiveRef.current = true;
    // Invalidate the cached prompt so the next sendMessage rebuilds it with
    // the guided framing appended.
    systemPromptRef.current = null;
    setGuidedSession(startGuidedSessionState());
    const openingMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: t('guided.opening-message'),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, openingMsg]);
  }, [t]);

  const endGuidedSession = useCallback(() => {
    guidedActiveRef.current = false;
    systemPromptRef.current = null;
    setGuidedSession(endGuidedSessionState());
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'system',
        content: t('guided.end-message'),
        timestamp: Date.now(),
      },
    ]);
  }, [t]);

  const markGuidedSessionCommit = useCallback((diff: ProfileDiff) => {
    setGuidedSession((prev) => (prev.active ? markGuidedSectionsFromDiff(prev, diff) : prev));
  }, []);

  const appendSystemMessage = useCallback((content: string, errorKind?: ChatError['kind']) => {
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'system',
        content,
        timestamp: Date.now(),
        ...(errorKind ? { errorKind } : {}),
      },
    ]);
  }, []);

  return {
    messages,
    isStreaming,
    isSharingProfile,
    sendMessage,
    cancelStream,
    clearChat,
    shareProfile,
    committedMessageIds,
    markMessageCommitted,
    appendSystemMessage,
    guidedSession,
    startGuidedSession,
    endGuidedSession,
    markGuidedSessionCommit,
  };
}

function makeMessage(
  role: 'user' | 'assistant',
  content: string,
  extras: { streaming?: boolean } = {},
): ChatMessage {
  return {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
    ...extras,
  };
}

function makeSystemMessage(content: string): ChatMessage {
  return {
    id: generateId(),
    role: 'system',
    content,
    timestamp: Date.now(),
  };
}

/**
 * Project the chat transcript into the shape Anthropic's API expects.
 *
 * - System messages (local-only errors/warnings) are stripped.
 * - The currently streaming assistant placeholder is stripped.
 * - Context messages (shared profile summaries) are projected to the user
 *   role with the supplied framing prefix so the model understands it is
 *   receiving context, not a question.
 * - Consecutive same-role messages are merged because Anthropic rejects
 *   repeated roles in a single request; this merge naturally combines a
 *   context message with the next user message.
 */
function toApiMessages(chatMessages: ChatMessage[], framing: string): AnthropicMessage[] {
  const projected: AnthropicMessage[] = [];
  for (const m of chatMessages) {
    if (m.streaming) continue;
    if (m.content.length === 0) continue;
    if (m.role === 'system') continue;
    if (m.role === 'context') {
      projected.push({ role: 'user', content: `${framing}\n\n${m.content}` });
    } else {
      projected.push({ role: m.role, content: m.content });
    }
  }

  const merged: AnthropicMessage[] = [];
  for (const m of projected) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      merged.push(m);
    }
  }
  return merged;
}

/** Map a structured ChatError into the German UI string. */
export function errorMessageFor(t: TFunction<'ai-chat'>, error: ChatError): string {
  if (error.kind === 'unknown') {
    return t('error.chat-error.unknown-with-detail', { detail: error.message });
  }
  return t(`error.chat-error.${error.kind}`);
}
