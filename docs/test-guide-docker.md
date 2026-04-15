# Test Guide: Docker Setup

## Services
| Service | Port | Description |
|---|---|---|
| `frontend` | 3000 | React chat UI (nginx) |
| `backend` | 3001 | Hono API + Gemini |
| `mongodb` | 27017 | MongoDB 7 |
| `minio` | 9000 / 9001 | Storage / console |

---

## Bước 1: Cấu hình

```bash
cp .env.example .env
```

Điền các giá trị bắt buộc trong `.env`:
- `GEMINI_API_KEY` — Google AI Studio key
- `INTERNAL_API_KEY` — key tùy chọn cho history API
- `VITE_BACKEND_URL` — thường là `http://localhost:3001`

---

## Bước 2: Build và khởi động

```bash
docker-compose build       # build frontend + backend images
docker-compose up -d       # start tất cả services
```

---

## Bước 3: Kiểm tra services

```bash
# Xem 4 containers đang chạy
docker ps

# Frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200

# Backend health
curl http://localhost:3001/health
# Expected: {"ok":true,"db":true}

# MongoDB
docker exec chatui-mongodb-1 mongosh --eval "db.runCommand({ping:1})" --quiet
# Expected: { ok: 1 }

# MinIO
curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live
# Expected: 200

# MinIO console
open http://localhost:9001
```

---

## Bước 4: Test chat end-to-end

```bash
# Tạo conversation
CONV_ID=$(curl -s -X POST http://localhost:3001/api/conversations \
  -H "Content-Type: application/json" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Gửi tin nhắn
curl -X POST "http://localhost:3001/api/conversations/$CONV_ID/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"tìm Nguyễn Văn A"}]}'
# Expected: {"role":"assistant","content":"...","title":"..."}
```

Hoặc mở http://localhost:3000 và chat trực tiếp trên UI.

---

## Bước 5: Test history API

```bash
curl "http://localhost:3001/api/conversations/$CONV_ID/history" \
  -H "X-Internal-Key: your_internal_key"
# Expected: {"conversationId":"...","messages":[...],"total":N}
```

---

## Bước 6: Kiểm tra data trong MongoDB

```bash
docker exec -it chatui-mongodb-1 mongosh \
  "mongodb://admin:password@localhost:27017/chatbot?authSource=admin" --quiet
```

```js
use chatbot
db.messages.find().limit(5)
db.conversations.find().limit(5)
```

---

## PASS / FAIL

| Check | PASS | FAIL |
|---|---|---|
| `docker ps` | 4 containers `Up` | Container `Restarting` |
| Backend health | `{"ok":true,"db":true}` | `{"ok":true,"db":false}` |
| Chat response | JSON với `role: assistant` | `502` hoặc timeout |

**Khi FAIL:**
```bash
docker-compose logs -f backend   # backend errors
docker-compose logs -f frontend  # nginx errors
docker-compose logs mongodb      # mongo startup errors
```

**Note WSL2:** Nếu port 3001 bị conflict với local process, chạy:
```bash
docker-compose restart backend
```

---

## Reset hoàn toàn

```bash
docker-compose down -v    # xóa cả volumes
docker-compose up -d
```
