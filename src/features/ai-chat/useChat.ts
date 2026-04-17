import { useCallback, useRef, useState } from 'react';
import { generateId } from '../../crypto';
import { DEFAULT_ANTHROPIC_MODEL } from '../../db/aiConfig';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';
import { useAIConfig, generateSystemPrompt } from '../ai-config';
import { streamCompletion } from './api';
import type { AnthropicMessage, ChatError } from './api/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** True while the assistant message is being streamed. */
  streaming?: boolean;
  /** Set on system messages that surface a structured error. */
  errorKind?: ChatError['kind'];
}

export interface UseChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (content: string) => Promise<void>;
  cancelStream: () => void;
  clearChat: () => void;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
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
  }, []);

  return { messages, isStreaming, sendMessage, cancelStream, clearChat };
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
 * System messages (local-only errors/warnings) and the currently streaming
 * assistant placeholder are stripped. Consecutive same-role messages are
 * merged because Anthropic rejects repeated roles in a single request.
 */
function toApiMessages(chatMessages: ChatMessage[]): AnthropicMessage[] {
  const filtered = chatMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => !m.streaming)
    .filter((m) => m.content.length > 0);

  const merged: AnthropicMessage[] = [];
  for (const m of filtered) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      merged.push({ role: m.role as 'user' | 'assistant', content: m.content });
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
