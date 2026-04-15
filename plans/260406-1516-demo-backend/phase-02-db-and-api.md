# Phase 02 — Database & API Endpoints

**Status:** Planned | **Priority:** High | **Effort:** Medium

---

## Overview

Set up SQLite with `better-sqlite3`, create conversations/messages tables, implement all REST + streaming chat endpoints.

---

## Files to Create

- `backend/src/db.ts` — SQLite init + all query helpers
- `backend/src/routes/conversations.ts` — CRUD routes
- `backend/src/routes/chat.ts` — streaming chat proxy + message persistence

---

## Database Schema

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,   -- JSON string for multimodal, plain text for text-only
  created_at INTEGER NOT NULL
);
```

---

## Implementation Steps

### 1. `backend/src/db.ts`

```ts
import Database from 'better-sqlite3'

const db = new Database('chat.db')

// Enable WAL for better concurrent reads
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New conversation',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`)

export const queries = {
  listConversations: db.prepare(`
    SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC
  `),
  getConversation: db.prepare(`
    SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?
  `),
  createConversation: db.prepare(`
    INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)
  `),
  updateConversation: db.prepare(`
    UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?
  `),
  deleteConversation: db.prepare(`DELETE FROM conversations WHERE id = ?`),
  getMessages: db.prepare(`
    SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
  `),
  insertMessage: db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)
  `),
}

export default db
```

### 2. `backend/src/routes/conversations.ts`

```ts
import { Hono } from 'hono'
import { queries } from '../db'
import { randomUUID } from 'crypto'

const router = new Hono()

router.get('/', (c) => {
  const convs = queries.listConversations.all()
  return c.json(convs)
})

router.post('/', (c) => {
  const id = randomUUID()
  const now = Date.now()
  queries.createConversation.run(id, 'New conversation', now, now)
  return c.json({ id, title: 'New conversation', created_at: now, updated_at: now }, 201)
})

router.get('/:id', (c) => {
  const conv = queries.getConversation.get(c.req.param('id'))
  if (!conv) return c.json({ error: 'Not found' }, 404)
  const messages = queries.getMessages.all(c.req.param('id'))
  return c.json({ ...conv, messages: messages.map(m => ({
    ...m, content: tryParseJson(m.content)
  })) })
})

router.delete('/:id', (c) => {
  queries.deleteConversation.run(c.req.param('id'))
  return c.body(null, 204)
})

function tryParseJson(s: string) {
  try { return JSON.parse(s) } catch { return s }
}

export default router
```

### 3. `backend/src/routes/chat.ts`

```ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { queries } from '../db'
import { randomUUID } from 'crypto'

const router = new Hono()

router.post('/:id/chat', async (c) => {
  const convId = c.req.param('id')
  const conv = queries.getConversation.get(convId)
  if (!conv) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<{ messages: Array<{ role: string; content: unknown }> }>()
  const { messages } = body

  // Persist last user message
  const lastUser = messages.at(-1)
  if (lastUser?.role === 'user') {
    queries.insertMessage.run(
      randomUUID(), convId, 'user',
      typeof lastUser.content === 'string' ? lastUser.content : JSON.stringify(lastUser.content),
      Date.now()
    )
    // Update title from first user message
    const existing = queries.getMessages.all(convId)
    if (existing.length <= 1) {
      const title = String(lastUser.content).slice(0, 40)
      queries.updateConversation.run(title, Date.now(), convId)
    } else {
      queries.updateConversation.run((conv as any).title, Date.now(), convId)
    }
  }

  // Proxy stream to AI API
  const aiUrl = `${process.env.AI_BASE_URL?.replace(/\/$/, '')}/v1/chat/completions`
  const systemPrompt = process.env.AI_SYSTEM_PROMPT ?? 'You are a helpful assistant.'

  const upstream = await fetch(aiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })

  if (!upstream.ok) {
    const err = await upstream.text()
    return c.json({ error: err }, upstream.status as any)
  }

  // Collect full response while streaming back to client
  let fullContent = ''
  const assistantId = randomUUID()

  return streamSSE(c, async (stream) => {
    const reader = upstream.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        const t = line.trim()
        if (!t || t === 'data: [DONE]') continue
        if (!t.startsWith('data: ')) continue
        try {
          const json = JSON.parse(t.slice(6))
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            await stream.writeSSE({ data: t.slice(6) })
          }
        } catch { /* skip malformed */ }
      }
    }

    // Persist assistant response
    if (fullContent) {
      queries.insertMessage.run(assistantId, convId, 'assistant', fullContent, Date.now())
    }

    await stream.writeSSE({ data: '[DONE]' })
  })
})

export default router
```

### 4. Wire routes in `backend/src/index.ts`

```ts
import conversationsRouter from './routes/conversations'
import chatRouter from './routes/chat'

app.route('/api/conversations', conversationsRouter)
app.route('/api/conversations', chatRouter)
```

---

## Success Criteria

- `GET /api/conversations` returns array
- `POST /api/conversations` creates and persists a row
- `POST /api/conversations/:id/chat` streams tokens back and saves messages to DB
- Conversation title auto-updates from first user message
