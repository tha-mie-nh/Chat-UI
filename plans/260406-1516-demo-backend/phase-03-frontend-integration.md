# Phase 03 — Frontend Integration

**Status:** Planned | **Priority:** High | **Effort:** Medium

---

## Overview

Replace `localStorage` + direct OpenAI calls with backend API calls. Minimal changes — swap data layer only, keep all UI/hooks intact.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/api-client.ts` | **Create** — typed fetch wrapper for backend |
| `src/hooks/use-conversations.ts` | **Modify** — replace localStorage with API calls |
| `src/lib/openai-client.ts` | **Modify** — point `streamChatCompletion` to backend |
| `.env.example` | **Update** — add `VITE_BACKEND_URL` |

---

## Implementation Steps

### 1. `src/lib/api-client.ts` — Backend REST client

```ts
const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001'

export const apiClient = {
  listConversations: () =>
    fetch(`${BASE}/api/conversations`).then(r => r.json()),

  createConversation: () =>
    fetch(`${BASE}/api/conversations`, { method: 'POST' }).then(r => r.json()),

  getConversation: (id: string) =>
    fetch(`${BASE}/api/conversations/${id}`).then(r => r.json()),

  deleteConversation: (id: string) =>
    fetch(`${BASE}/api/conversations/${id}`, { method: 'DELETE' }),
}
```

### 2. Modify `src/hooks/use-conversations.ts`

Replace `localStorage` read/write with `apiClient` calls:

- `load()` → `apiClient.listConversations()` on mount (useEffect)
- `save()` → removed (backend handles persistence)
- `createConversation()` → `apiClient.createConversation()`
- `deleteConversation()` → `apiClient.deleteConversation(id)`
- On `selectConversation(id)` → `apiClient.getConversation(id)` to load messages

Hook becomes async — use `useState` + `useEffect` for initial load.

### 3. Modify `src/lib/openai-client.ts`

Change the URL target so `streamChatCompletion` calls backend instead of AI directly:

```ts
// Before
const url = `${config.baseUrl.replace(/\/$/, '')}/v1/chat/completions`

// After — route through backend
const url = `${import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001'}/api/conversations/${conversationId}/chat`
```

> `streamChatCompletion` signature gains an optional `conversationId` param.  
> SSE response format stays identical — no parser changes needed.

### 4. `.env` updates

Frontend `.env`:
```
VITE_BACKEND_URL=http://localhost:3001
```

Backend `.env`:
```
AI_BASE_URL=https://api.openai.com
AI_API_KEY=sk-...
AI_MODEL=gpt-4o
AI_SYSTEM_PROMPT=You are a helpful assistant.
PORT=3001
```

---

## Data Flow After Integration

```
User types message
      ↓
useChat.sendMessage()
      ↓
streamChatCompletion() → POST /api/conversations/:id/chat
                              ↓
                        Backend saves user message
                              ↓
                        Backend proxies to AI API (streaming)
                              ↓
                        SSE tokens → frontend (same parser)
                              ↓
                        Backend saves assistant response
```

---

## Success Criteria

- App loads conversations from backend on startup
- New conversation created in DB, not localStorage
- Messages persist across browser refresh
- Streaming works as before (no UX change)
- API key no longer exposed in browser network tab
