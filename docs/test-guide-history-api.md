# Test Guide: GET /api/conversations/:id/history

## Setup

1. Lấy conversation ID từ UI — xem URL (ví dụ: `http://localhost:5173/abc-123-...`) hoặc sidebar
2. Backend phải đang chạy: `cd backend && npm run dev`
3. Thay `YOUR_ID` và `YOUR_KEY` tương ứng

---

## Test cases

### 1. Không có API key → 401

```bash
curl http://localhost:3001/api/conversations/YOUR_ID/history
```

Expected:
```json
{"error":"Unauthorized"}
```

---

### 2. Sai API key → 401

```bash
curl http://localhost:3001/api/conversations/YOUR_ID/history \
  -H "X-Internal-Key: wrong-key"
```

Expected:
```json
{"error":"Unauthorized"}
```

---

### 3. Có key, conversation hợp lệ → 200

```bash
curl http://localhost:3001/api/conversations/YOUR_ID/history \
  -H "X-Internal-Key: internal-dev-key-2026"
```

Expected:
```json
{
  "conversationId": "YOUR_ID",
  "title": "Tên conversation",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "nội dung",
      "createdAt": 1712345678000
    }
  ],
  "total": 5
}
```

---

### 4. Conversation không tồn tại → 404

```bash
curl http://localhost:3001/api/conversations/fake-id-doesnt-exist/history \
  -H "X-Internal-Key: internal-dev-key-2026"
```

Expected:
```json
{"error":"Conversation not found"}
```

---

### 5. Query param: limit

```bash
curl "http://localhost:3001/api/conversations/YOUR_ID/history?limit=5" \
  -H "X-Internal-Key: internal-dev-key-2026"
```

Expected: JSON với tối đa 5 messages (`.total` ≤ 5)

---

### 6. Query param: role filter

```bash
# Chỉ messages của user
curl "http://localhost:3001/api/conversations/YOUR_ID/history?role=user" \
  -H "X-Internal-Key: internal-dev-key-2026"

# Chỉ messages của assistant
curl "http://localhost:3001/api/conversations/YOUR_ID/history?role=assistant" \
  -H "X-Internal-Key: internal-dev-key-2026"
```

---

### 7. Query param: before (timestamp unix ms)

```bash
# Lấy messages trước 1/1/2026
curl "http://localhost:3001/api/conversations/YOUR_ID/history?before=1767225600000" \
  -H "X-Internal-Key: internal-dev-key-2026"
```

---

### 8. MongoDB chưa connect → 503

Dừng MongoDB, rồi gọi API:

```bash
curl http://localhost:3001/api/conversations/YOUR_ID/history \
  -H "X-Internal-Key: internal-dev-key-2026"
```

Expected:
```json
{"error":"Database not available. Please try again later."}
```

(503 được handle bởi middleware global trong `index.ts` trước khi tới route)
