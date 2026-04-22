# Agent Integration Guide

Tài liệu này mô tả cách tích hợp FastAPI Agent vào hệ thống ChatUI backend.

---

## Tổng quan luồng

```
FE (React) → Hono BE → FastAPI Agent → stream text → BE → SSE → FE
```

BE gọi Agent qua HTTP POST mỗi khi user gửi tin nhắn.
Agent xử lý query (LLM, graph lookup, v.v.) và stream kết quả về BE dưới dạng plain text.
BE pipe từng chunk thành SSE events gửi về FE để hiển thị từng chữ như ChatGPT.

---

## 1. Cấu hình

BE đọc địa chỉ Agent từ env var:

```env
AGENT_URL=http://<agent-host>:<port>/<endpoint>
```

Ví dụ: `AGENT_URL=http://localhost:8000/query`

---

## 2. Request từ BE gửi lên Agent

**Method:** `POST`  
**Content-Type:** `application/json`

```json
{
  "query": "nguyễn văn a có quan hệ với ai?",
  "image": null,
  "conversationId": "6634ab12c9e1234567890abc",
  "history": [
    { "role": "user",      "content": "xin chào" },
    { "role": "assistant", "content": "Xin chào! Tôi có thể giúp gì?" },
    { "role": "user",      "content": "tìm người tên nguyễn văn a" }
  ]
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `query` | string | Câu hỏi hiện tại của user |
| `image` | string \| null | Base64 ảnh nếu user gửi ảnh, thường là `null` |
| `conversationId` | string | ID cuộc hội thoại (MongoDB ObjectId) |
| `history` | array | Tối đa 20 messages gần nhất, không bao gồm `query` hiện tại |

---

## 3. Response Agent cần trả về

### ✅ Recommended — Stream plain text

Agent stream từng đoạn text nhỏ theo thời gian. BE tự pipe về FE.

```
HTTP 200
Content-Type: text/plain

<stream các chunk text>
```

**FastAPI implementation:**

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

class QueryRequest(BaseModel):
    query: str
    image: Optional[str] = None
    conversationId: str
    history: list[dict] = []

@app.post("/query")
async def handle_query(body: QueryRequest):
    async def generate():
        # Gọi LLM hoặc graph logic của bạn
        async for chunk in your_llm.astream(body.query, history=body.history):
            yield chunk  # yield từng phần nhỏ của text

    return StreamingResponse(generate(), media_type="text/plain")
```

**Nếu LLM không hỗ trợ streaming**, fake bằng cách split sau khi có full response:

```python
import asyncio

@app.post("/query")
async def handle_query(body: QueryRequest):
    async def generate():
        full_text = await your_llm.complete(body.query)
        for word in full_text.split(" "):
            yield word + " "
            await asyncio.sleep(0.05)  # 50ms/word

    return StreamingResponse(generate(), media_type="text/plain")
```

---

### Các format khác BE cũng hỗ trợ

**SSE format** — nếu agent đã có SSE pipeline:

```
HTTP 200
Content-Type: text/event-stream

data: {"content": "Nguyễn "}\n\n
data: {"content": "Văn A "}\n\n
data: [DONE]\n\n
```

BE tự extract field `content` (hoặc `data`, `text`, `chunk`).

**Full JSON** — không có streaming effect, text xuất hiện 1 cục:

```json
HTTP 200
Content-Type: application/json

{ "data": "Nguyễn Văn A là Giám đốc..." }
```

BE hỗ trợ field: `data`, `content`, hoặc `text`.

---

## 4. Yêu cầu kỹ thuật

| Yêu cầu | Chi tiết |
|---------|---------|
| Timeout | BE đợi tối đa **60 giây** |
| Error | Trả HTTP status ≠ 200 → BE báo lỗi 502 về FE |
| CORS | **Không cần** — BE gọi agent server-to-server |
| Auth | Không có hiện tại |
| Encoding | UTF-8 cho tiếng Việt |

---

## 5. Test tích hợp

Sau khi deploy agent, set `AGENT_URL` và test bằng curl:

```bash
# Set env và restart BE
AGENT_URL=http://<agent-host>:<port>/query npm run dev

# Test qua BE (thay <conv-id> bằng ID thật từ GET /api/conversations)
curl -N -X POST "http://localhost:3001/api/conversations/<conv-id>/chat?stream=true" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"tìm nguyễn văn a"}]}'
```

**Kết quả mong đợi** — thấy SSE events xuất hiện lần lượt:

```
data: {"type":"chunk","content":"Nguyễn"}
data: {"type":"chunk","content":" Văn"}
data: {"type":"chunk","content":" A"}
...
data: {"type":"done","title":"tìm nguyễn văn a"}
```

Nếu thấy events xuất hiện dần dần → tích hợp thành công.

---

## 6. Test trực tiếp agent (không qua BE)

```bash
curl -N -X POST http://<agent-host>:<port>/query \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "tìm nguyễn văn a",
    "image": null,
    "conversationId": "test-123",
    "history": []
  }'
```

Nếu thấy text stream ra từng phần → agent đã đúng format.

---

## 7. Lỗi thường gặp

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `502 Graph interpreter error` | Agent không chạy hoặc sai URL | Kiểm tra `AGENT_URL` và agent đang listen |
| Text xuất hiện 1 cục | Agent trả 1 chunk duy nhất | Agent cần `yield` nhiều chunk nhỏ |
| Timeout sau 60s | Agent xử lý quá lâu | Tối ưu pipeline hoặc tăng timeout trong `graph-interpreter.ts` |
| Encoding lỗi tiếng Việt | Thiếu charset | Thêm `charset=utf-8` vào `Content-Type` |
