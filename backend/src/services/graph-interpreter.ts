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

export interface AgentStream {
  /** true nếu agent stream (text/plain, SSE); false nếu JSON 1 cục */
  isStreaming: boolean;
  chunks: AsyncGenerator<string>;
}

/**
 * Gọi agent, trả { isStreaming, chunks }.
 * isStreaming dựa vào Content-Type header của agent response:
 *   application/json → false (trả 1 cục)
 *   text/plain, text/event-stream → true (stream)
 */
export async function createAgentStream(
  userMessage: string,
  history: HistoryItem[],
  conversationId: string,
  imageData?: ImageData
): Promise<AgentStream> {
  const agentUrl = process.env.AGENT_URL;
  if (!agentUrl) throw new Error('AGENT_URL chưa được cấu hình. Set AGENT_URL trong .env');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let res: Response;
  try {
    res = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: buildPayload(userMessage, conversationId, history, imageData?.base64),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }

  if (!res.ok)   { clearTimeout(timeout); throw new Error(`Agent returned HTTP ${res.status}`); }
  if (!res.body) { clearTimeout(timeout); throw new Error('Agent returned empty body'); }

  const ct = res.headers.get('Content-Type') ?? '';
  const isJson = ct.includes('application/json') || ct.includes('ndjson');
  const isStreaming = !isJson;

  async function* generate(): AsyncGenerator<string> {
    try {
      if (ct.includes('text/event-stream'))   yield* parseSse(res.body!);
      else if (isJson)                         yield* parseJsonOrLines(res.body!);
      else                                     yield* readRawText(res.body!);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { isStreaming, chunks: generate() };
}
