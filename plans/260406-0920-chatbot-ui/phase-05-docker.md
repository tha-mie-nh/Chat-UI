# Phase 5 — Docker + Deployment

**Status:** ⬜ Todo  
**Priority:** High

## Overview

Multi-stage Dockerfile (build → nginx serve) + docker-compose.yaml deployment file.

## Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage: node build + nginx serve |
| `nginx.conf` | SPA routing (try_files fallback) |
| `docker-compose.yaml` | Single-container deployment |
| `.dockerignore` | Exclude node_modules, .env |

## Dockerfile Structure

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## nginx.conf

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;  # SPA fallback
  }
}
```

## docker-compose.yaml

```yaml
version: '3.8'
services:
  chatbot-ui:
    build: .
    ports:
      - "3000:80"
    restart: unless-stopped
    environment:
      # Override at deploy time if needed
      - VITE_API_BASE_URL=${VITE_API_BASE_URL:-https://api.openai.com}
      - VITE_API_MODEL=${VITE_API_MODEL:-gpt-4o}
```

> Note: `VITE_` env vars are baked in at build time. For runtime config, use the settings panel in UI.

## Todo

- [ ] Write `Dockerfile`
- [ ] Write `nginx.conf`
- [ ] Write `docker-compose.yaml`
- [ ] Write `.dockerignore`
- [ ] Test `docker compose up --build`

## Success Criteria

- `docker compose up --build` serves app on port 3000
- SPA routing works (no 404 on refresh)
- Image size < 30MB
