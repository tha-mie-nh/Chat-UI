# Code Review: Demo Backend Implementation

**Date:** 2026-04-06
**Scope:** Backend (Hono/SQLite) + Frontend hooks/client
**Files:** 9 files reviewed

---

## Overall Assessment

Solid skeleton — the SSE proxy pattern is correct, SQLite schema is sound, and the React hooks follow idiomatic patterns. However there are several issues worth fixing before any real usage: a stale-closure race condition in `sendMessage`, missing input validation, an unsafe AI URL construction path, and a double-fetch duplicate in the openai client.

---

## Critical Issues

### 1. Stale-closure race condition in `sendMessage` (use-chat.ts:98)

```ts
const history = [...messages, userMessage]; // ← stale `messages` snapshot
await runStream(history, assistantId);
```

`messages` is captured from render state at call time. If another update fired between the user pressing send and this line executing, `history` will be missing those messages and the backend will receive an incomplete context window. This is the classic React stale-closure trap.

**Fix:** Build history inside the functional updater so it reads the latest state:
```ts
let history: Message[] = [];
updateMessages((prev) => {
  history = [...prev, userMessage];
  return [...prev, userMessage, { id: assistantId, role: 'assistant', content: '', streaming: true }];
});
await runStream(history, assistantId);
```
Or use a `useRef` mirror of messages.

---

## High Priority

### 2. AI_API_KEY empty string silently accepted (chat.ts:56)

```ts
Authorization: `Bearer ${process.env.AI_API_KEY ?? ''}`,
```

If `AI_API_KEY` is unset, the request is sent with `Authorization: Bearer ` — upstream will respond 401 and that error text is forwarded to the client unchanged. The real risk: **the raw upstream error body (which may echo back the partial key or model config) is forwarded verbatim** to the browser.

**Fix:**
- Validate `AI_API_KEY` at server startup and refuse to start if absent.
- On upstream errors, log the full error server-side and return a sanitized message to the client:
  ```ts
  console.error('Upstream AI error:', err);
  return c.json({ error: 'AI service error' }, 502);
  ```

### 3. Unsafe AI_BASE_URL forwarded directly to fetch (chat.ts:48-49)

```ts
const baseUrl = process.env.AI_BASE_URL?.replace(/\/$/, '') ?? 'https://api.openai.com';
const aiUrl = `${baseUrl}/v1/chat/completions`;
```

If `AI_BASE_URL` is set to a `file://` URI or an internal network address (SSRF), the server will happily fetch it. In a production multi-tenant scenario this is a Server-Side Request Forgery vector.

**Fix:** Validate `AI_BASE_URL` is an `https://` URL at startup:
```ts
if (!baseUrl.startsWith('https://')) throw new Error('AI_BASE_URL must be https://');
```

### 4. No body validation on POST /chat (chat.ts:19-22)

```ts
const body = await c.req.json<{ messages: ApiMessage[] }>();
const { messages } = body;
```

`c.req.json()` will throw (uncaught) if the body is not valid JSON, crashing the request handler with a 500. The role field is also passed directly to the upstream without validation — a client could inject `role: "system"` messages before your system prompt.

**Fix:**
- Wrap `c.req.json()` in try/catch and return 400 on parse failure.
- Validate each message's `role` against the allowed set (`user` | `assistant`), strip any `system` role messages from client input before prepending your own system prompt.

### 5. Duplicate fetch implementation (openai-client.ts:45 vs api-client.ts:25)

`streamChatCompletion` in `openai-client.ts` directly calls `fetch` to `BACKEND_URL/api/conversations/:id/chat`, while `apiClient.streamChat` in `api-client.ts` does the same thing. Both even read from `VITE_BACKEND_URL`. The `chat-window.tsx` doesn't use `apiClient.streamChat` at all — it's dead code.

**Fix:** Remove `apiClient.streamChat` or remove the raw fetch from `openai-client.ts` and delegate to `apiClient.streamChat`. Pick one.

---

## Medium Priority

### 6. selectConversation fetch inside setState callback (use-conversations.ts:41-49)

```ts
setConversations((prev) => {
  ...
  apiClient.getConversation(id).then((full) => {   // ← side effect in setState!
    setConversations((p) => ...);
  });
  return prev;
});
```

React's state updater function must be pure — side effects inside it are forbidden and will misbehave in StrictMode (double-invoke). The inner `setConversations` call will close over the wrong `prev`.

**Fix:** Move the fetch outside the updater:
```ts
const selectConversation = useCallback(async (id: string) => {
  setActiveId(id);
  const existing = conversations.find((c) => c.id === id);
  if (existing && existing.messages.length > 0) return;
  const full = await apiClient.getConversation(id).catch(console.error);
  if (full) setConversations((p) => p.map((c) => c.id === id ? { ...c, messages: full.messages, title: full.title } : c));
}, [conversations]);
```
Note: this adds `conversations` to the dep array, which is fine since this is not called in a render loop.

### 7. Missing FRONTEND_ORIGIN env var — wildcard CORS fallback (index.ts:9)

`FRONTEND_ORIGIN` defaults to `'http://localhost:5173'`. If this is ever deployed without setting the env var, CORS will be locked to localhost — but the error message is silent. More importantly, Hono's `cors({ origin: string })` accepts a single origin, not `'*'`, so this is fine as-is. However the `.env.example` does not document `FRONTEND_ORIGIN` at all.

**Fix:** Add `FRONTEND_ORIGIN=http://localhost:5173` to `.env.example`.

### 8. Conversation type mismatch: snake_case vs camelCase (use-conversations.ts:13)

Backend returns `{ id, title, created_at, updated_at }` but `Conversation` type defines `createdAt`/`updatedAt` (camelCase). The spread `{ ...c, messages: [] }` will put `created_at`/`updated_at` on the object while TypeScript expects `createdAt`/`updatedAt`. The type annotation masks this: `list.map((c) => ({ ...c, messages: [] }))` widens to `Conversation` silently.

**Fix:** Either map the fields explicitly, or align the backend to return camelCase.

### 9. `chat.db` path is relative to CWD (db.ts:3)

```ts
const db = new Database('chat.db');
```

The DB file location depends on whatever directory the process is started from. If started from the project root instead of `backend/`, a second DB file is silently created in the wrong place.

**Fix:** Use `path.join(__dirname, '..', 'chat.db')` or an env var `DB_PATH`.

---

## Low Priority

### 10. `streamText` adds its own `Transfer-Encoding` / content-type — confirm SSE compatibility

Hono's `streamText` sets `Content-Type: text/plain; charset=UTF-8` by default, not `text/event-stream`. The frontend `parseSseStream` reads the raw bytes and parses `data:` lines, so it works regardless — but any EventSource-based consumer would reject it.

**Fix (optional):** If EventSource compatibility ever matters, set the header explicitly:
```ts
c.header('Content-Type', 'text/event-stream');
c.header('Cache-Control', 'no-cache');
```

### 11. `useChat` `initialMessages` only used once

`useChat` takes `initialMessages` and passes it to `useState` — but `useState` ignores the initial value after the first render. The `useEffect` in `ChatWindow` calls `loadMessages` to handle re-selection, which is correct. However the `initialMessages` option is misleading and could cause bugs for other callers who expect it to be reactive.

---

## Positive Observations

- Prepared statements everywhere in `db.ts` — no SQL injection risk.
- SSE proxy in `chat.ts` correctly reassembles split chunks via `buf` accumulation before line splitting. The `data: [DONE]` guard is handled before JSON parse. Stream is flushed with `\n` as required by the SSE spec.
- `AbortController` wired correctly through `streamChatCompletion` to `fetch` signal — abort on new message and stop button both work.
- `foreign_keys = ON` + `ON DELETE CASCADE` means deleting a conversation cleans up messages atomically.
- WAL mode is appropriate for this use case (one writer, many reads).
- The `regenerate` function correctly trims the last assistant message before re-sending.

---

## Recommended Actions (Priority Order)

1. **[Critical]** Fix stale-closure in `sendMessage` (issue 1) — can silently truncate context.
2. **[High]** Add startup validation for `AI_API_KEY` and `AI_BASE_URL` (issues 2, 3).
3. **[High]** Add body parsing error handling + strip client-supplied `system` roles (issue 4).
4. **[High]** Remove duplicate `streamChat` dead code (issue 5).
5. **[Medium]** Move API call out of setState updater in `selectConversation` (issue 6).
6. **[Medium]** Fix snake_case / camelCase mismatch in `Conversation` type mapping (issue 8).
7. **[Medium]** Use absolute path for `chat.db` (issue 9).
8. **[Low]** Add `FRONTEND_ORIGIN` to `.env.example` (issue 7).

---

## Unresolved Questions

- Is `AI_MODEL` intentionally optional (no default)? If unset, the upstream request sends `model: undefined` which may be rejected. Should add a default or fail-fast check.
- What is the intended behavior if the user sends a message and the stream completes but `fullContent` is empty (e.g. function-call-only responses)? Currently the assistant message is not persisted and the in-memory placeholder remains with `streaming: false` and empty content.
- Is `refreshConversationTitle` in `useConversations` ever called? It's exported but not referenced in `chat-window.tsx`. The auto-title runs on the backend at message insert time, but the sidebar title won't update until next `selectConversation` or page reload.
