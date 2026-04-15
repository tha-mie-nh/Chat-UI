# Phase 01 — Backend Server Setup

**Status:** Planned | **Priority:** High | **Effort:** Small

---

## Overview

Bootstrap `backend/` directory with Hono + Node.js + TypeScript. No database yet — just a working HTTP server with CORS configured for the frontend.

---

## Files to Create

- `backend/package.json`
- `backend/tsconfig.json`
- `backend/src/index.ts` — Hono app, CORS, health check
- `backend/.env.example`

---

## Implementation Steps

### 1. Init backend package

```bash
mkdir backend && cd backend
npm init -y
npm install hono @hono/node-server better-sqlite3
npm install -D typescript tsx @types/node @types/better-sqlite3
```

### 2. `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### 3. `backend/src/index.ts`

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:5173' }))
app.get('/health', (c) => c.json({ ok: true }))

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('Backend running on http://localhost:3001')
})
```

### 4. Add scripts to `backend/package.json`

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

### 5. `.env.example`

```
AI_BASE_URL=https://api.openai.com
AI_API_KEY=sk-...
AI_MODEL=gpt-4o
PORT=3001
```

---

## Success Criteria

- `npm run dev` starts server on `:3001`
- `GET /health` returns `{"ok":true}`
- Frontend (`:5173`) can reach backend without CORS errors
