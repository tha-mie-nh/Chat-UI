# Demo Backend Plan

**Status:** Planned  
**Priority:** Medium  
**Goal:** Add a lightweight Node.js backend to proxy AI API calls and persist conversations in SQLite (replacing localStorage).

---

## Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js + TypeScript | Same lang as frontend |
| Framework | **Hono** | Tiny, fast, native TS, built-in streaming |
| Database | **SQLite** via `better-sqlite3` | Zero setup, file-based, sync API |
| ORM | None (raw SQL) | KISS — too simple to need ORM |

---

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Backend Server Setup](./phase-01-backend-setup.md) | Planned |
| 2 | [Database & API Endpoints](./phase-02-db-and-api.md) | Planned |
| 3 | [Frontend Integration](./phase-03-frontend-integration.md) | Planned |

---

## API Contract

```
GET    /api/conversations              → list all conversations
POST   /api/conversations              → create new conversation
GET    /api/conversations/:id          → get conversation with messages
DELETE /api/conversations/:id          → delete conversation
POST   /api/conversations/:id/chat     → stream chat + persist messages
```

---

## Folder Structure

```
chatUI/
├── src/                    # existing frontend
├── backend/
│   ├── src/
│   │   ├── index.ts        # Hono app entry
│   │   ├── db.ts           # SQLite setup + queries
│   │   ├── routes/
│   │   │   ├── conversations.ts
│   │   │   └── chat.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                # AI API key (server-side)
├── package.json            # add "backend" workspace or just scripts
```

---

## Key Dependencies

```json
// backend/package.json
{
  "dependencies": {
    "hono": "^4",
    "@hono/node-server": "^1",
    "better-sqlite3": "^9"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/better-sqlite3": "^7",
    "tsx": "^4"
  }
}
```
