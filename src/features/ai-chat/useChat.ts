import { useCallback, useRef, useState } from 'react';
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
}

/**
 * Framing line prepended to every projected context message when it is
 * sent to the API. Tells the model "this is context, not a question" so
 * it does not treat a 3000-token profile dump as a list of user queries.
 */
const CONTEXT_FRAMING =
  '[Aktuelles Gesundheitsprofil des Nutzers - bitte als Kontext fuer die folgende Konversation verwenden]';

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSharingProfile, setIsSharingProfile] = useState(false);
  const [committedMessageIds, setCommittedMessageIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const abortRef = useRef<AbortController | null>(null);
  const systemPromptRef = useRef<string | null>(null);
  const { state: configState } = useAIConfig();

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      const userMsg = makeMessage('user', trimmed);

      if (configState.status === 'loading') {
        setMessages((prev) => [
          ...prev,
          userMsg,
          makeSystemMessage('Einstellungen werden geladen, bitte kurz warten.'),
        ]);
        return;
      }
      if (configState.status === 'unconfigured') {
        setMessages((prev) => [
          ...prev,
          userMsg,
          makeSystemMessage(
            'KI-Assistent ist nicht konfiguriert. Bitte hinterlege einen API-Schluessel unter Einstellungen.',
          ),
        ]);
        return;
      }
      if (configState.status === 'error' || !configState.config) {
        setMessages((prev) => [
          ...prev,
          userMsg,
          makeSystemMessage('App ist gesperrt. Bitte entsperre sie erneut.'),
        ]);
        return;
      }
      const config = configState.config;

      // Generate the system prompt on the first message of the session.
      if (systemPromptRef.current === null) {
        try {
          const profile = await new ProfileRepository().getCurrentProfile();
          if (!profile) {
            setMessages((prev) => [...prev, userMsg, makeSystemMessage('Kein Profil gefunden.')]);
            return;
          }
          const observations = await new ObservationRepository().listByProfile(profile.id);
          systemPromptRef.current = generateSystemPrompt({ profile, observations });
        } catch {
          setMessages((prev) => [
            ...prev,
            userMsg,
            makeSystemMessage('App ist gesperrt. Bitte entsperre sie erneut.'),
          ]);
          return;
        }
      }

      // Append user + empty streaming assistant placeholder atomically.
      const assistantMsg = makeMessage('assistant', '', { streaming: true });
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const apiMessages = toApiMessages([...messages, userMsg]);

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
                content: errorMessageFor(error),
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
    [configState, isStreaming, messages],
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
  }, []);

  const shareProfile = useCallback(async () => {
    if (isSharingProfile || isStreaming) return;
    setIsSharingProfile(true);
    try {
      const profile = await new ProfileRepository().getCurrentProfile();
      if (!profile) {
        setMessages((prev) => [...prev, makeSystemMessage('Kein Profil gefunden.')]);
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

      const { markdown, counts } = formatProfileShareSummary({
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
      setMessages((prev) => [
        ...prev,
        makeSystemMessage('App ist gesperrt. Bitte entsperre sie erneut.'),
      ]);
    } finally {
      setIsSharingProfile(false);
    }
  }, [isSharingProfile, isStreaming]);

  const markMessageCommitted = useCallback((id: string) => {
    setCommittedMessageIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
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
 *   role with the CONTEXT_FRAMING prefix so the model understands it is
 *   receiving context, not a question.
 * - Consecutive same-role messages are merged because Anthropic rejects
 *   repeated roles in a single request; this merge naturally combines a
 *   context message with the next user message.
 */
function toApiMessages(chatMessages: ChatMessage[]): AnthropicMessage[] {
  const projected: AnthropicMessage[] = [];
  for (const m of chatMessages) {
    if (m.streaming) continue;
    if (m.content.length === 0) continue;
    if (m.role === 'system') continue;
    if (m.role === 'context') {
      projected.push({ role: 'user', content: `${CONTEXT_FRAMING}\n\n${m.content}` });
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
export function errorMessageFor(error: ChatError): string {
  switch (error.kind) {
    case 'auth':
      return 'API-Schluessel ungueltig. Bitte pruefen unter Einstellungen.';
    case 'rate-limit':
      return 'Zu viele Anfragen. Bitte warte einen Moment.';
    case 'server':
      return 'Der KI-Dienst ist voruebergehend nicht erreichbar.';
    case 'network':
      return 'Keine Internetverbindung.';
    case 'unknown':
      return `Fehler beim KI-Dienst: ${error.message}`;
  }
}
