import { useState, useCallback, useRef } from 'react';
import type { Message, ContentPart } from '../types/chat';
import { streamChatCompletion } from '../lib/openai-client';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface UseChatOptions {
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  /** Called once after each response with updated conversation metadata (e.g. new title) */
  onConversationMeta?: (meta: { title: string }) => void;
}

/** Chat hook — streams via backend proxy, persists to MongoDB */
export function useChat(conversationId: string | null, options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>(options.initialMessages ?? []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Always reflect the latest conversationId to avoid stale closure in runStream
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  // Keep latest options ref to avoid stale closures
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateMessages = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        optionsRef.current.onMessagesChange?.(next);
        return next;
      });
    },
    []
  );

  const runStream = useCallback(
    async (history: Message[], assistantId: string, retryCount = 0) => {
      const convId = conversationIdRef.current;
      if (!convId) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setError(null);

      try {
        for await (const token of streamChatCompletion(
          convId,
          history.map(({ role, content }) => ({ role, content })),
          controller.signal,
          optionsRef.current.onConversationMeta
        )) {
          updateMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: (m.content as string) + token } : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        // Auto-retry 1 lần: reset content rỗng rồi thử lại
        if (retryCount < 1) {
          console.warn('[useChat] Stream error, retrying...', err);
          updateMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: '' } : m))
          );
          await runStream(history, assistantId, retryCount + 1);
          return;
        }

        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        updateMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        updateMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
        );
        setIsStreaming(false);
      }
    },
    [updateMessages]
  );

  /** Send a text message, optionally with attached images (base64 data URLs) */
  const sendMessage = useCallback(
    async (text: string, imageUrls: string[] = []) => {
      abortRef.current?.abort();

      const content: string | ContentPart[] =
        imageUrls.length > 0
          ? [
              { type: 'text', text },
              ...imageUrls.map(
                (url): ContentPart => ({ type: 'image_url', image_url: { url, detail: 'auto' } })
              ),
            ]
          : text;

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content,
        images: imageUrls.length > 0 ? imageUrls : undefined,
      };
      const assistantId = generateId();

      const history = [...messages, userMessage];
      updateMessages(() => [
        ...history,
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ]);

      await runStream(history, assistantId);
    },
    [messages, runStream, updateMessages]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(async () => {
    if (isStreaming) return;
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const cutIdx = messages.length - 1 - lastUserIdx;
    const trimmed = messages.slice(0, cutIdx + 1);

    const assistantId = generateId();
    updateMessages(() => [
      ...trimmed,
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ]);

    await runStream(trimmed, assistantId);
  }, [isStreaming, messages, runStream, updateMessages]);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    optionsRef.current.onMessagesChange?.([]);
  }, []);

  const loadMessages = useCallback((msgs: Message[]) => {
    abortRef.current?.abort();
    setMessages(msgs);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    regenerate,
    clearMessages,
    loadMessages,
  };
}
