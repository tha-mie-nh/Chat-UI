# Chatbot UI — Implementation Plan

**Status:** In Progress  
**Created:** 2026-04-06  
**Mode:** Fast

## Overview

Pure frontend chatbot UI — no backend. React + TypeScript + Vite SPA that calls an OpenAI-compatible API directly from browser. Packaged with Docker (nginx) and a docker-compose deployment YAML.

## Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | React 18 + TypeScript + Vite | Fast build, modern, widely supported |
| Styling | Tailwind CSS | Utility-first, no heavy deps |
| HTTP | Native fetch + streaming | No extra lib, supports SSE streaming |
| Containerize | Docker multi-stage + nginx | Minimal image, static file serving |
| Deploy | docker-compose.yaml | Simple single-file deployment |

## Architecture

```
User → Browser → React SPA → OpenAI-compatible API (configured via env/UI)
                           ↓
                     nginx (Docker) serves static files
```

Config: API URL + API Key stored in `localStorage` or injected via `VITE_` env vars at build time.

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| [Phase 1](phase-01-project-setup.md) | Vite + React + TS + Tailwind scaffold | ⬜ Todo |
| [Phase 2](phase-02-chat-ui.md) | Chat UI components (messages, input, header) | ⬜ Todo |
| [Phase 3](phase-03-api-integration.md) | OpenAI API integration with streaming | ⬜ Todo |
| [Phase 4](phase-04-settings.md) | Settings panel (API URL + key config) | ⬜ Todo |
| [Phase 5](phase-05-docker.md) | Dockerfile + nginx config + docker-compose.yaml | ⬜ Todo |

## Key Decisions

- **No backend**: API calls go directly from browser — user must configure CORS-enabled API endpoint
- **Streaming**: Uses `ReadableStream` / SSE for real-time token streaming
- **Config**: API key stored in `localStorage` (browser-side only, no server leakage)
- **Model selector**: Dropdown in settings to choose model
- **Docker**: Multi-stage build → node:alpine build stage → nginx:alpine serve stage

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
                              ↓
                          Phase 5 (independent, runs after Phase 1)
```
