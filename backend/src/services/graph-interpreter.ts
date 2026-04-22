// Graph interpreter — pipes agent stream to caller.
// Auto-detects agent response format via Content-Type:
//   text/event-stream → SSE parser (data: text  OR  data: {"content":"..."})
//   application/json  → full JSON or JSON-lines (extracts .data / .content / .text)
//   text/plain / *    → raw text chunks (default)

export interface HistoryItem { role: 'user' | 'assistant'; content: string; }
export interface ImageData   { base64: string; mimeType: string; }

function buildPayload(
  userMessage: string,
  conversationId: string,
  history: HistoryItem[],
  imageBase64?: string
): string {
  return JSON.stringify({
    query:          userMessage,
    image:          imageBase64 ?? null,
    conversationId,
    history:        history.map((h) => ({ role: h.role, content: h.content })),
  });
}

// ── Format parsers ────────────────────────────────────────────────────────────

/** Plain text: yield raw decoded chunks */
async function* readRawText(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) yield text;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * SSE: parse "data: ..." lines.
 * Supports plain text after data:  OR  JSON objects like {"content":"..."}.
 * Stops on [DONE] sentinel.
 */
async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const obj = JSON.parse(raw) as Record<string, unknown>;
          const text = (obj.content ?? obj.data ?? obj.text ?? obj.chunk) as string | undefined;
          if (text) yield text;
        } catch {
          yield raw; // plain text after "data: "
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * JSON / JSON-lines:
 * - Full JSON: { data|content|text: "..." }
 * - NDJSON: one JSON object per line
 */
async function* parseJsonOrLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }

  // Try full JSON first
  try {
    const obj = JSON.parse(full) as Record<string, unknown>;
    const val = obj.data ?? obj.content ?? obj.text;
    yield typeof val === 'string' ? val : JSON.stringify(val ?? obj, null, 2);
    return;
  } catch { /* fall through to JSON-lines */ }

  // JSON-lines (ndjson)
  for (const line of full.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      const val = (obj.content ?? obj.data ?? obj.text ?? obj.chunk) as string | undefined;
      if (val) yield val;
    } catch {
      yield t;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Stream agent response as text chunks.
 * Auto-detects format from Content-Type header.
 */
export async function* interpretGraphStream(
  userMessage: string,
  history: HistoryItem[],
  conversationId: string,
  imageData?: ImageData
): AsyncGenerator<string> {
  const agentUrl = process.env.AGENT_URL;
  if (!agentUrl) throw new Error('AGENT_URL chưa được cấu hình. Set AGENT_URL trong .env');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: buildPayload(userMessage, conversationId, history, imageData?.base64),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Agent returned HTTP ${res.status}`);
    if (!res.body) throw new Error('Agent returned empty body');

    const ct = res.headers.get('Content-Type') ?? '';
    if (ct.includes('text/event-stream')) {
      yield* parseSse(res.body);
    } else if (ct.includes('application/json') || ct.includes('ndjson')) {
      yield* parseJsonOrLines(res.body);
    } else {
      yield* readRawText(res.body); // text/plain or unknown
    }
  } finally {
    clearTimeout(timeout);
  }
}

/** Non-streaming: accumulate full text from stream. */
export async function interpretGraph(
  userMessage: string,
  history: HistoryItem[],
  conversationId: string,
  imageData?: ImageData
): Promise<string> {
  let full = '';
  for await (const chunk of interpretGraphStream(userMessage, history, conversationId, imageData)) {
    full += chunk;
  }
  return full;
}
