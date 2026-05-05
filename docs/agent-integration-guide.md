# Agent Integration Guide

Tài liệu dành cho team phát triển agent backend. Mô tả cách hệ thống chat gọi agent và format dữ liệu cần hỗ trợ.

---

## Tổng quan

```
User gửi tin → BE (Hono) → POST AGENT_URL → Agent xử lý → response → BE stream về FE
```

BE gọi agent mỗi khi user gửi tin nhắn (text, ảnh, hoặc cả hai). Agent xử lý và trả kết quả. BE nhận và stream về FE.

---

## Endpoint

Agent expose 1 HTTP POST endpoint duy nhất:

```
POST {AGENT_URL}
Content-Type: application/json
```

`AGENT_URL` do team agent cung cấp, BE set vào env.

---

## Request Format

BE luôn gửi cùng 1 JSON schema cho cả 3 loại tin nhắn:

```json
{
  "query": "câu hỏi của user",
  "image": "data:image/png;base64,iVBORw0KGgo...",
  "conversationId": "abc-123-def-456",
  "history": [
    { "role": "user",      "content": "tin nhắn trước" },
    { "role": "assistant", "content": "trả lời trước"  }
  ]
}
```

### Giải thích từng field

| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `query` | `string` | ✅ | Câu hỏi user. Rỗng `""` nếu user chỉ gửi ảnh |
| `image` | `string \| null` | ✅ | Data URL ảnh. `null` nếu không có ảnh |
| `conversationId` | `string` | ✅ | MongoDB UUID của cuộc hội thoại |
| `history` | `array` | ✅ | Lịch sử chat, tối đa 20 tin gần nhất, từ cũ đến mới |

### 3 luồng cụ thể

**Text only** — user gõ chữ, không có ảnh:
```json
{ "query": "Nguyễn Văn A là ai?", "image": null, "conversationId": "abc-123", "history": [] }
```

**Image only** — user gửi ảnh, không gõ gì:
```json
{ "query": "", "image": "data:image/jpeg;base64,/9j/4AAQ...", "conversationId": "abc-123", "history": [] }
```

**Image + text** — user gửi ảnh kèm câu hỏi:
```json
{ "query": "Người này đang làm gì?", "image": "data:image/png;base64,iVBORw0...", "conversationId": "abc-123", "history": [] }
```

Agent phân biệt 3 luồng qua:
- `image = null` → text only
- `image != null, query = ""` → image only
- `image != null, query != ""` → image + text

### Về field `image` — Data URL

`image` là **data URL**, chuỗi base64 kèm loại file:

```
"data:image/png;base64,iVBORw0KGgo..."
  │    │          │      └── nội dung ảnh mã hóa base64
  │    │          └───────── encoding
  │    └──────────────────── MIME type (png/jpeg/webp...)
  └───────────────────────── prefix
```

Decode trong Python:
```python
data_url = payload["image"]           # "data:image/png;base64,..."
header, encoded = data_url.split(",", 1)
mime_type = header.split(":")[1].split(";")[0]   # "image/png"
image_bytes = base64.b64decode(encoded)
```

---

## Response Format

Agent trả **1 trong 3 format** — BE tự detect qua `Content-Type` header, không cần config.

### Option 1: Plain text streaming ✅ Khuyến nghị

```
HTTP 200
Content-Type: text/plain

Nguyễn Văn A là Giám đốc...
```

FastAPI example:
```python
from fastapi.responses import StreamingResponse

@app.post("/")
async def handle(body: QueryRequest):
    async def generate():
        async for chunk in your_llm.astream(body.query):
            yield chunk
    return StreamingResponse(generate(), media_type="text/plain")
```

### Option 2: SSE streaming

```
HTTP 200
Content-Type: text/event-stream

data: Nguyễn Văn A\n\n
data: là Giám đốc\n\n
data: [DONE]\n\n
```

Hoặc SSE với JSON object (BE extract field `content`, `data`, `text`, hoặc `chunk`):
```
data: {"content": "Nguyễn Văn A"}\n\n
data: {"content": " là Giám đốc"}\n\n
data: [DONE]\n\n
```

### Option 3: JSON 1 cục (không có streaming effect)

```
HTTP 200
Content-Type: application/json

{ "data": "Nguyễn Văn A là Giám đốc Công ty ABC..." }
```

BE chấp nhận field: `data`, `content`, hoặc `text`.

---

## Pydantic Schema tham khảo

```python
from pydantic import BaseModel
from typing import Optional

class HistoryItem(BaseModel):
    role: str      # "user" | "assistant"
    content: str

class QueryRequest(BaseModel):
    query: str
    image: Optional[str] = None   # data URL hoặc null
    conversationId: str
    history: list[HistoryItem] = []
```

---

## Lưu ý

- **Timeout:** BE abort sau **60 giây** nếu không có response
- **HTTP status:** Trả `200` khi thành công. Status khác → BE báo lỗi về FE
- **Image size:** Ảnh đã validate tối đa 10MB trước khi BE gọi agent
- **`history`:** Thứ tự từ cũ đến mới, tối đa 20 items

---

## Checklist tích hợp

- [ ] Expose HTTP POST endpoint, cung cấp URL cho team BE
- [ ] Parse JSON body theo schema trên (dùng Pydantic schema tham khảo)
- [ ] Xử lý cả 3 luồng: `image=null`, `query=""`, hoặc cả hai có giá trị
- [ ] Trả response đúng 1 trong 3 format, kèm đúng `Content-Type` header
- [ ] Đảm bảo response bắt đầu trong vòng 60 giây
- [ ] Confirm format response với team BE trước khi deploy
