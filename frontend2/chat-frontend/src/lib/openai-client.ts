import type { Message, ContentPart } from '../types/chat';
import { apiBase } from './api-base';

/**
 * Send chat message, yield text chunks.
 * ?stream=true → parse SSE events từ BE (fake stream)
 * fallback      → nhận full JSON response như cũ
 */
export async function* streamChatCompletion(
  conversationId: string,
  messages: Pick<Message, 'role' | 'content'>[],
  signal?: AbortSignal,
  onMeta?: (meta: { title: string }) => void
): AsyncGenerator<string> {
  const response = await fetch(
    `${apiBase}/conversations/${conversationId}/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
      signal,
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.includes('text/event-stream')) {
    yield* parseSseStream(response.body!, signal, onMeta);
  } else {
    // Fallback: BE trả JSON thay vì SSE
    const data = await response.json() as { role: string; content: string; title: string };
    if (data.title && onMeta) onMeta({ title: data.title });
    if (data.content) yield data.content;
  }
}

// ── SSE parser ────────────────────────────────────────────────────────────────
// Đọc ReadableStream, parse từng dòng `data: {...}`, yield content

async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
  onMeta?: (meta: { title: string }) => void
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!; // giữ lại dòng chưa hoàn chỉnh

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event: { type: string; content?: string; title?: string; message?: string };
        try {
          event = JSON.parse(raw);
        } catch {
          yield raw; // fallback: gửi raw text nếu không parse được JSON
          continue;
        }

        if (event.type === 'chunk' && event.content) {
          yield event.content;
        } else if (event.type === 'done') {
          if (event.title && onMeta) onMeta({ title: event.title });
          return;
        } else if (event.type === 'error') {
          throw new Error(event.message ?? 'Stream error from server');
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export type { ContentPart };
