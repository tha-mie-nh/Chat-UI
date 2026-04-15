# Docker Deployment Guide

## Public Images (Docker Hub)

- `gthanh/chatbot-frontend:latest` — https://hub.docker.com/r/gthanh/chatbot-frontend
- `gthanh/chatbot-backend:latest` — https://hub.docker.com/r/gthanh/chatbot-backend

```bash
# Pull pre-built images
docker pull gthanh/chatbot-frontend:latest
docker pull gthanh/chatbot-backend:latest
```

---

## Services

| Service | Port | Description |
|---|---|---|
| `frontend` | 3000 | React chat UI (nginx) |
| `backend` | 3001 | Hono API + Gemini |
| `mongodb` | 27017 | MongoDB 7 |
| `minio` | 9000 / 9001 | S3-compatible storage / console |

---

## Quick Start

```bash
# 1. Copy env template
cp .env.example .env
# Edit .env: set VITE_BACKEND_URL to your real backend URL

# 2. Build frontend image (bakes VITE_BACKEND_URL at compile time)
docker-compose build

# 3. Start services
docker-compose up -d

# 4. Verify
curl http://localhost:3000          # → 200 (chat UI)
curl http://localhost:9000/minio/health/live  # → 200
docker exec chatui-mongodb-1 mongosh --eval "db.runCommand({ping:1})" --quiet  # → { ok: 1 }
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_BACKEND_URL` | **Yes** | `http://localhost:3001` | Backend agent URL (baked into frontend at build) |
| `MONGO_INITDB_ROOT_USERNAME` | No | `admin` | MongoDB root username |
| `MONGO_INITDB_ROOT_PASSWORD` | No | `password` | MongoDB root password |
| `MINIO_ROOT_USER` | No | `minioadmin` | MinIO root user |
| `MINIO_ROOT_PASSWORD` | No | `minioadmin123` | MinIO root password |

> `VITE_BACKEND_URL` is baked at build time. Changing it requires rebuilding the image.

---

## Push to Docker Hub

```bash
# Tag (replace <username> with your Docker Hub username)
docker tag chatbot-frontend <username>/chatbot-frontend:latest

# Login and push
docker login
docker push <username>/chatbot-frontend:latest
```

### Use pre-built image (skip build step)

```yaml
# In docker-compose.yaml, replace build: section with:
frontend:
  image: <username>/chatbot-frontend:latest
```

---

## Useful Commands

```bash
docker-compose logs -f frontend    # Stream frontend logs
docker-compose logs -f mongodb     # Stream MongoDB logs
docker-compose restart frontend    # Restart a service
docker-compose down                # Stop all
docker-compose down -v             # Stop + remove volumes (full reset)
```
