# Backend Integration Guide

## Tổng quan

**Chatbot-temp** là UI + middleware layer:
- Nhận tin nhắn từ user (text + ảnh)
- Gọi **backend agent** để lấy dữ liệu graph
- Dùng Gemini dịch graph → text tự nhiên → hiển thị UI
- Lưu lịch sử hội thoại vào MongoDB

**Backend agent** là blackbox — chatbot-temp không quan tâm bên trong dùng gì, chỉ cần đúng API contract dưới đây.

---

## 1. API Contract — Backend Agent phải implement

### Request từ chatbot-temp

```
POST [AGENT_URL do backend agent tự chọn]
Content-Type: application/json
```

```json
{
  "query": "tìm Nguyễn Văn A",
  "image": "base64string hoặc null",
  "conversationId": "mongodb-uuid-cua-conversation",
  "history": [
    { "role": "user",      "content": "tin nhắn trước của user" },
    { "role": "assistant", "content": "câu trả lời trước" }
  ]
}
```

| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `query` | string | Có | Text query từ user (có thể rỗng nếu chỉ gửi ảnh) |
| `image` | string\|null | Không | Base64-encoded image nếu user gửi ảnh |
| `conversationId` | string | Có | MongoDB conversation ID |
| `history` | array | Có | Lịch sử tin nhắn trước đó (không gồm message hiện tại) |

---

### Response backend agent phải trả về

> ⚠️ **Quan trọng:** Format này đã thay đổi so với phiên bản cũ. Không dùng format `{ nodes, edges }` nữa.

Response có 2 dạng tùy theo loại query, phân biệt qua field `data.relation`:

#### Dạng 1 — Tìm 1 entity (`relation: false`)

Dùng khi user tìm thông tin về 1 người/tổ chức cụ thể.

```json
{
  "data": {
    "relation": false,
    "candidates": [
      {
        "id": "node-uuid",
        "doc_id": "doc-uuid",
        "publish_date": "2024-01-15",
        "title": "Nguyễn Văn A — Giám đốc Công ty ABC",
        "label": "Person",
        "name": "Nguyễn Văn A",
        "text": "Nguyễn Văn A | profession: Giám đốc | addresss: Hà Nội",
        "properties": {
          "name": "Nguyễn Văn A",
          "profession": "Giám đốc",
          "role": "CEO",
          "organization": "Công ty ABC",
          "addresss": "Hà Nội",
          "gender": "Nam",
          "age_range": "45-50"
        }
      }
    ]
  }
}
```

**AgentCandidate fields:**

| Field | Type | Mô tả |
|---|---|---|
| `id` | string | Node ID trong graph |
| `doc_id` | string | Document ID nguồn |
| `publish_date` | string | Ngày xuất bản |
| `title` | string | Tiêu đề mô tả ngắn |
| `label` | string | `"Person"` hoặc `"Organization"` |
| `name` | string | Tên entity |
| `text` | string | Mô tả ngắn dạng text (pipe-separated) |
| `properties` | object | Các thuộc tính tùy chọn: profession, role, organization, addresss, gender, age_range, ... |

---

#### Dạng 2 — Tìm quan hệ giữa entities (`relation: true`)

Dùng khi user hỏi về quan hệ giữa 2 hoặc nhiều người/tổ chức.

```json
{
  "data": {
    "relation": true,
    "candidates": [
      {
        "e1": { /* AgentCandidate — entity 1 */ },
        "e2": { /* AgentCandidate — entity 2 */ },
        "via": "edge-uuid-canh-noi-e1-e2",
        "distance": 1,
        "target": "e2"
      }
    ]
  }
}
```

**AgentRelationBlock fields:**

| Field | Type | Mô tả |
|---|---|---|
| `e1` | AgentCandidate | Entity 1 |
| `e2` | AgentCandidate | Entity 2 |
| `via` | string | ID cạnh nối e1 và e2 trong graph |
| `distance` | number | Khoảng cách graph — **càng nhỏ = match tốt hơn** |
| `target` | `"e1"` \| `"e2"` | Entity nào là kết quả user cần tìm |

---

## 2. Ví dụ tham khảo — Mock Agent

File `backend/src/mock/mock-agent-server.ts` là mock agent chuẩn, implement đúng contract trên.

Chạy mock agent để test:

```bash
cd backend
npx tsx src/mock/mock-agent-server.ts
# → Running on http://localhost:4000
```

Test bằng curl:

```bash
# Test relation: false
curl -s -X POST http://localhost:4000 \
  -H 'Content-Type: application/json' \
  -d '{"query":"tìm Nguyễn Văn A","conversationId":"test-conv","history":[]}' | jq .

# Test relation: true
curl -s -X POST http://localhost:4000 \
  -H 'Content-Type: application/json' \
  -d '{"query":"Nguyễn Văn A có quan hệ với ai","conversationId":"test-conv","history":[]}' | jq .
```

---

## 3. Lịch sử chat — Backend agent có thể đọc thêm

Ngoài `history[]` đã có trong payload, backend agent có thể gọi API này để lấy history đầy đủ hơn:

```
GET http://chatbot-temp-host/api/conversations/:id/history
X-Internal-Key: [INTERNAL_API_KEY]
```

**Response:**
```json
{
  "conversationId": "uuid",
  "title": "tên conversation",
  "messages": [
    { "id": "uuid", "role": "user", "content": "nội dung", "createdAt": 1234567890 }
  ],
  "total": 10
}
```

**Query params:** `?limit=50` | `?before=1712345678000` | `?role=user`

**Error codes:** `401` thiếu/sai key — `404` conversation không tồn tại — `503` MongoDB chưa kết nối

---

## 4. Chạy chatbot-temp (cho team BE deploy)

### Yêu cầu
- Docker + Docker Compose
- URL backend agent đang chạy
- `GEMINI_API_KEY` (Google AI Studio)

### Bước 1 — Tạo file `.env`

```bash
cp .env.example .env
```

Điền 2 biến bắt buộc:

```env
GEMINI_API_KEY=your_gemini_api_key
AGENT_URL=http://your-backend-agent-url
```

### Bước 2 — Chạy với Docker Hub images

```bash
docker-compose pull     # pull images mới nhất từ Docker Hub
docker-compose up -d    # start 4 services
```

### Bước 3 — Verify services

| Service | URL |
|---|---|
| Chat UI | http://localhost:3000 |
| MinIO console | http://localhost:9001 |

---

## 5. Flow tổng thể

```
User nhắn tin trên UI
      ↓
chatbot-temp nhận message + load lịch sử từ MongoDB
      ↓
POST [AGENT_URL] { query, image?, conversationId, history[] }
      ↓
Backend agent xử lý → trả về AgentResponse
  { data: { candidates: [...], relation: boolean } }
      ↓
Gemini dịch candidates/relation blocks → text tự nhiên
      ↓
Lưu MongoDB + stream về UI
```

---

## 6. Checklist trước khi tích hợp

- [ ] Agent trả đúng `Content-Type: application/json`
- [ ] `data.relation = false` → `data.candidates` là `AgentCandidate[]`
- [ ] `data.relation = true` → `data.candidates` là `AgentRelationBlock[]`
- [ ] Mỗi `AgentCandidate` có đủ: `id`, `name`, `label`, `text`, `properties`
- [ ] Mỗi `AgentRelationBlock` có đủ: `e1`, `e2`, `via`, `distance`, `target`
- [ ] Agent trả HTTP 200 khi thành công
- [ ] Agent xử lý trong vòng **30 giây** (chatbot-temp timeout = 30s)
- [ ] Agent nhận được `history[]` (array, có thể rỗng)

---

## 7. Cần thống nhất với chatbot-temp team

| Vấn đề | Cần quyết định |
|---|---|
| `AGENT_URL` | Backend agent deploy ở địa chỉ nào? |
| Authentication | Gọi agent có cần API key trong header không? |
| Image search | Backend có hỗ trợ nhận `image` base64 không? |
| Timeout | Backend xử lý tối đa bao lâu? (chatbot-temp timeout 30s) |
| Properties | Ngoài các field chuẩn, backend trả thêm properties gì trong `properties`? |
