# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.claude/rules/primary-workflow.md`
- Development rules: `./.claude/rules/development-rules.md`
- Orchestration protocols: `./.claude/rules/orchestration-protocol.md`
- Documentation management: `./.claude/rules/documentation-management.md`
- And other workflows: `./.claude/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You must follow strictly the development rules in `./.claude/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read the `./README.md` file first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Project Overview

A chat UI web app with Gemini API backend (demo).

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS v4 (port 5173 dev / 80 prod via Nginx)
- **Backend**: Hono on Node.js + Mongoose/MongoDB (port 3001)
- **Conversations**: persisted in MongoDB; messages loaded lazily on conversation select
- **Chat engine**: Gemini API (demo) via `@google/generative-ai` — sẽ swap sang backend agent thật

## Commands

### Frontend
```bash
npm run dev        # Start Vite dev server (port 5173)
npm run build      # tsc -b && vite build → dist/
npm run lint       # ESLint
npm run preview    # Serve built dist/
```

### Backend
```bash
cd backend
npm run dev        # tsx watch src/index.ts (hot reload, port 3001)
npm run build      # tsc → dist/
npm run start      # node dist/index.js
```

### Docker
```bash
cp .env.example .env   # set GEMINI_API_KEY (+ AGENT_URL nếu có)
docker-compose up -d   # pull images + start 4 services (no build needed)
```

Structure: `frontend/` (React+nginx), `backend/` (Hono+Node) — each has own `Dockerfile`.
nginx proxies `/api/*` → `backend:3001` — no CORS, no VITE_BACKEND_URL.
Services: **frontend** (:3000), **backend** (:3001), **mongodb** (:27017), **minio** (:9000/9001).

Key files:
- `frontend/Dockerfile` — node:20-alpine build + nginx:alpine serve; no build args needed
- `backend/Dockerfile` — node:20-alpine; copies CSV mock data to `dist/mock/` after tsc
- `frontend/nginx.conf` — static serve + `/api/` proxy to backend:3001
- `.env.example` — only 2 required vars: `GEMINI_API_KEY`, `AGENT_URL`
- Docker Hub: `gthanh/chatbot-frontend:latest`, `gthanh/chatbot-backend:latest` (2026-04-13)
- `docs/backend-integration-guide.md` — API contract + integration guide for backend agent team

## Architecture

### Routing structure

| Route | Behavior |
|-------|----------|
| `/` | `ConversationRedirect` — redirect to latest conv or create new |
| `/:conversationId` | `ChatWindow` — load specific conversation; invalid id → redirect `/` |
| `*` | `NotFound` — 404 page with back-to-home link |

Active conversation ID is owned by the URL (`useParams`), not localStorage.

### Data flow
```
URL /:conversationId → ChatWindow (useParams)
  → useConversations(activeId) → apiClient.getConversation()
  → useChat → openai-client.ts (POST /api/conversations/:id/chat)
                    ↓
          backend: Gemini API call
                    ↓
          Returns { role, content, title } → useChat yields full answer
```

### Key source files

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Route definitions (react-router-dom v7) |
| `src/components/chat/conversation-redirect.tsx` | `/` handler — redirect or create |
| `src/components/chat/not-found.tsx` | `*` 404 page |
| `src/types/chat.ts` | All shared types: `Message`, `Conversation`, `ChatConfig`, `ContentPart` |
| `src/hooks/use-chat.ts` | Streaming state machine; calls `streamChatCompletion` |
| `src/hooks/use-conversations.ts` | CRUD for conversations; activeId from URL; lazy loads messages |
| `src/hooks/use-image-uploader.ts` | Upload images to `/api/upload`; manages pending/done/error state |
| `src/hooks/use-config.ts` | `ChatConfig` persisted to `localStorage` |
| `src/lib/api-client.ts` | REST client for `/api/conversations` |
| `src/lib/openai-client.ts` | `streamChatCompletion` generator — single POST, yields full answer |
| `src/components/chat/chat-window.tsx` | Root component — wires hooks, reads URL params, navigates |
| `src/components/chat/message-bubble.tsx` | Message renderer — images with lightbox, markdown, copy |
| `backend/src/lib/storage-client.ts` | S3-compatible MinIO client — swap to real S3 via env only |
| `backend/src/routes/upload.ts` | `POST /api/upload` — validate + upload image to MinIO |
| `backend/src/routes/chat.ts` | `POST /:id/chat` — loads history, calls graph-interpreter, persists messages |
| `backend/src/routes/conversations.ts` | CRUD for conversations |
| `backend/src/routes/history.ts` | `GET /:id/history` — paginated chat history for backend agents (requires `X-Internal-Key`) |
| `backend/src/services/graph-interpreter.ts` | Graph interpreter: getGraphData → buildPrompt → Gemini with history |
| `backend/src/mock/graph-data.ts` | TypeScript interfaces (GraphNode, GraphEdge, GraphData) + 20-node hardcoded fallback |
| `backend/src/mock/csv-data-loader.ts` | Loads 500 nodes + 338 edges from CSV at startup — replaces hardcoded mock |
| `backend/src/mock/people.csv` | 500 người mock: Nguyễn Văn A×150, B×80, Trần Thị C×80, Lê Văn D×60, Phạm Thị E×60, khác×70 |
| `backend/src/mock/relations.csv` | 338 quan hệ: vợ chồng/anh em/đồng nghiệp/bạn bè/họ hàng |

## Storage Architecture

- **Dev**: MinIO (Docker) — `localhost:9000`, console `localhost:9001`
- **Bucket**: `chatbot-uploads` (public read, created by `minio-init` service)
- **Swap to S3**: change env vars only — no code changes needed:
  - `MINIO_ENDPOINT` → S3 endpoint or region
  - `MINIO_ACCESS_KEY/SECRET_KEY` → AWS credentials
  - `MINIO_PUBLIC_URL` → CDN or S3 bucket URL
  - Remove `forcePathStyle: true` in `storage-client.ts` for AWS S3

## Chat Engine History

- **[TEMPLATE]** keyword/rule-based lookup — commented out in `backend/src/routes/chat.ts` for rollback
- **[CURRENT]** Backend agent HTTP call: POST AGENT_URL `{query, image?, conversationId, history[]}` → GraphData → Gemini `gemini-2.5-flash-lite` diễn giải → text
- **[MOCK — disabled]** CSV data (500 nodes) — commented out in `graph-interpreter.ts`

## Graph Interpreter Service

`backend/src/services/graph-interpreter.ts` — pipeline: agent HTTP → Gemini → text response

**Pipeline:**
1. `getGraphData(userMessage, conversationId, history, imageBase64?)` → POST AGENT_URL với full context → `GraphData`
2. `diversityHints(nodes)` → pre-compute top-2 thuộc tính đa dạng nhất
3. `buildSystemInstruction(graph, totalCount, hints)` → Gemini system prompt
4. `interpretGraph(userMessage, history, conversationId, imageData?)` → startChat với history, sendMessage → text

**Agent payload:**
```json
{
  "query": "text từ user",
  "image": "base64 hoặc null",
  "conversationId": "mongodb-conv-id",
  "history": [{ "role": "user|assistant", "content": "..." }]
}
```

**Nếu AGENT_URL không set** → throw Error → `chat.ts` trả 502.
**Timeout:** 30s, sau đó AbortController cancel request.
**Retry:** Gemini 503 → retry tối đa 3 lần, delay 5s.

### MongoDB collections
- `conversations` — id, title, created_at, updated_at
- `messages` — id, conversation_id, role, content, created_at
- `responses` — id, keyword (UNIQUE), answer, created_at (unused with Gemini — kept for rollback)

### Environment variables

**Frontend** (baked at build time via Vite):
- `VITE_BACKEND_URL` — backend base URL (default: `http://localhost:3001`)
- `VITE_API_BASE_URL`, `VITE_API_KEY`, `VITE_API_MODEL` — legacy OpenAI fields in `ChatConfig` (stored in localStorage settings panel)

**Backend**:
- `PORT` — listen port (default: `3001`)
- `FRONTEND_ORIGIN` — CORS allowed origin (default: `http://localhost:5173`)
- `GEMINI_API_KEY` — Google AI Studio API key (model: gemini-2.5-flash). Xem hướng dẫn đổi key: [`docs/gemini-key-rotation.md`](docs/gemini-key-rotation.md)
- `MINIO_ENDPOINT` — MinIO host (default: `localhost`)
- `MINIO_PORT` — MinIO API port (default: `9000`)
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` — credentials (default: `minioadmin`)
- `MINIO_BUCKET` — bucket name (default: `chatbot-uploads`)
- `MINIO_PUBLIC_URL` — public base URL for uploaded files
- `INTERNAL_API_KEY` — secret key for `GET /api/conversations/:id/history` (header: `X-Internal-Key`)

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

## Python Scripts (Skills)

When running Python scripts from `.claude/skills/`, use the venv Python interpreter:
- **Linux/macOS:** `.claude/skills/.venv/bin/python3 scripts/xxx.py`

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Use kebab-case naming with long descriptive names
- After modularization, continue with main task

## Documentation Management

Keep all important docs in `./docs` folder:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

**IMPORTANT:** *MUST READ* and *MUST COMPLY* all *INSTRUCTIONS* in project `./CLAUDE.md`, especially *WORKFLOWS* section is *CRITICALLY IMPORTANT*, this rule is *MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!*
