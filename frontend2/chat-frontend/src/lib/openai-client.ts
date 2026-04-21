import type { Message, ContentPart } from '../types/chat';
import { apiBase } from './api-base';

// Backend URL via nginx proxy

/**
 * Send a chat message to the backend rule-based engine.
 * Backend returns { role, content, title } — no real streaming needed.
 * Yields a single token (full answer) to keep useChat hook compatible.
 * Calls onMeta once with conversation metadata (e.g. updated title).
 */
export async function* streamChatCompletion(
  conversationId: string,
  messages: Pick<Message, 'role' | 'content'>[],
  signal?: AbortSignal,
  onMeta?: (meta: { title: string }) => void
): AsyncGenerator<string> {
  const response = await fetch(`${apiBase}/conversations/${conversationId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as { role: string; content: string; title: string };
  if (data.title && onMeta) onMeta({ title: data.title });
  if (data.content) yield data.content;
}

export type { ContentPart };
