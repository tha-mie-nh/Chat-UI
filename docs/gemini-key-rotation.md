# Gemini API Key Rotation Guide

## Khi nào cần đổi key?

- **Lỗi 429 Too Many Requests** → hết quota (RPM hoặc RPD)
- **Lỗi 400 API key not valid** → key sai hoặc bị thu hồi
- **Lỗi 503 Service Unavailable** → model quá tải (không cần đổi key, thử lại sau)
- Muốn dùng project Gemini mới với quota riêng biệt

---

## Bước 1 — Tạo key mới trên Google AI Studio

1. Vào [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Tạo **project mới** (mỗi project có quota riêng)
3. Click **Create API key** → chọn project vừa tạo
4. Copy key (dạng `AIzaSy...`)

> **Lưu ý:** Key mới cần ~2 phút để propagate. Nếu test ngay và bị 400, đợi rồi thử lại.

---

## Bước 2 — Đổi key trong `.env`

```bash
# File: backend/.env
GEMINI_API_KEY=AIzaSy...KEY_MỚI...
```

Hoặc dùng lệnh nhanh:
```bash
cd /home/thanh/chatUI/backend
sed -i 's/GEMINI_API_KEY=.*/GEMINI_API_KEY=KEY_MỚI_Ở_ĐÂY/' .env
grep GEMINI_API_KEY .env   # xác nhận
```

---

## Bước 3 — Restart backend

```bash
pkill -f "tsx src/index.ts"
cd /home/thanh/chatUI/backend
nohup npx tsx src/index.ts > /tmp/backend.log 2>&1 &
sleep 5 && curl -s http://localhost:3001/health
```

---

## Bước 4 — Test model bằng curl

```bash
KEY="AIzaSyDbF0gcOlm_0htJdJdrM_dDpbdX7ISg1RY"

for model in \
  gemini-2.5-pro \
  gemini-2.5-flash \
  gemini-2.5-flash-lite \
  gemini-2.0-flash \
  gemini-2.0-flash-lite \
  gemini-2.0-pro \
  gemini-1.5-flash \
  gemini-1.5-flash-8b \
  gemini-1.5-pro \
  gemini-1.0-pro \
  gemma-3-27b-it \
  gemma-3-12b-it \
  gemma-3-4b-it \
  gemma-3-1b-it; do
  code=$(curl -s -o /tmp/t.json -w "%{http_code}" \
    "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"hi"}]}]}')
  if [ "$code" = "200" ]; then
    echo "$model → PASS ✓"
  else
    msg=$(python3 -c "import json; r=json.load(open('/tmp/t.json')); print(r.get('error',{}).get('message','?')[:60])" 2>/dev/null)
    echo "$model → $code: $msg"
  fi
done
```

**Đọc kết quả:**
- `PASS ✓` → model sẵn sàng dùng
- `429` → hết quota (RPM reset sau 1 phút, RPD reset sau 24h)
- `503` → model quá tải, thử lại sau vài phút
- `400 API key not valid` → key sai, kiểm tra lại

---

## Bước 5 — Đổi model trong code

**File cần sửa:** `backend/src/services/graph-interpreter.ts`

Tìm 2 chỗ cần đổi:

```typescript
// ~line 116 — model dùng cho Vision (phân tích ảnh)
const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ~line 237 — model dùng cho Chat
const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction });
```

Thay tên model bằng model PASS ở Bước 4.

---

## Bước 6 — Confirm hoạt động

Test qua API:
```bash
CONV=$(curl -s -X POST http://localhost:3001/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"title":"test"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

curl -s -X POST "http://localhost:3001/api/conversations/$CONV/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"tìm Nguyễn Văn A"}]}' \
  | python3 -c "import json,sys; r=json.load(sys.stdin); print('PASS' if 'content' in r else 'FAIL:', r.get('error','')[:80])"
```

---

## Danh sách models và giới hạn free tier

| Model | RPM | RPD | Ghi chú |
|-------|-----|-----|---------|
| `gemini-1.5-flash-latest` | 15 | 1500 | Ổn định, recommended fallback |
| `gemini-2.0-flash` | 15 | 1500 | Ổn định |
| `gemini-2.0-flash-lite` | 30 | 1500 | Nhanh hơn, quota cao hơn |
| `gemini-2.5-flash` | 10 | 500 | Preview, hay bị 503 giờ cao điểm |
| `gemini-2.5-pro` | 5 | 25 | Preview, giới hạn rất thấp |

> Nguồn: [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)

---

## Lịch sử key đã dùng

| Project | Key (prefix) | Ngày tạo | Trạng thái |
|---------|-------------|----------|-----------|
| (project đầu tiên) | `AIzaSyADO...` | ~Apr 2026 | Quota 2.0-flash hết RPD |
| project 577835736407 | `AIzaSyDbF...` | Apr 10, 2026 | Invalid (chưa rõ lý do) |
