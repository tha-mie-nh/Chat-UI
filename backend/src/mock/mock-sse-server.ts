/**
 * Mock SSE server — giả lập Hono BE trả streaming response.
 * Dùng để test FE nhận SSE và hiển thị text từng từ mà không cần agent thật.
 *
 * Chạy: npx tsx src/mock/mock-sse-server.ts
 * FE trỏ VITE_BACKEND_URL=http://localhost:4002
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';

const PORT = 4002;

// Delay giữa các từ (ms) — tăng lên để thấy rõ hiệu ứng streaming
const WORD_DELAY_MS = 80;

const SAMPLE_RESPONSES: string[] = [
  'Nguyễn Văn A là Giám đốc của Công ty ABC, sinh năm 1975 tại Hà Nội. Ông có nhiều năm kinh nghiệm trong lĩnh vực phần mềm và hiện đang lãnh đạo một đội ngũ hơn 200 nhân viên.',
  'Trần Thị B là Kế toán trưởng tại Công ty XYZ, là vợ của Nguyễn Văn A. Bà có bằng cử nhân Kế toán và đã làm việc trong ngành tài chính hơn 15 năm.',
  'Không tìm thấy thông tin phù hợp với yêu cầu của bạn. Vui lòng thử lại với từ khóa khác hoặc cung cấp thêm thông tin chi tiết.',
];

function pickResponse(query: string): string {
  if (query.includes('A') || query.includes('giám đốc')) return SAMPLE_RESPONSES[0];
  if (query.includes('B') || query.includes('kế toán')) return SAMPLE_RESPONSES[1];
  return SAMPLE_RESPONSES[Math.floor(Math.random() * SAMPLE_RESPONSES.length)];
}

function cors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((r) => { let b = ''; req.on('data', (c: Buffer) => b += c); req.on('end', () => r(b)); });
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';

  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ── POST /api/conversations/:id/chat?stream=true ──────────────────────────
  const chatMatch = url.match(/^\/api\/conversations\/([^/]+)\/chat/);
  if (method === 'POST' && chatMatch) {
    const isStream = url.includes('stream=true');
    const body = await readBody(req);
    let query = '';
    try {
      const parsed = JSON.parse(body) as { messages?: Array<{ content: string }> };
      query = parsed.messages?.at(-1)?.content ?? '';
    } catch { /* ignore */ }

    const answer = pickResponse(query);
    console.log(`[mock-sse] query="${query}" stream=${isStream}`);

    if (isStream) {
      // SSE streaming response
      cors(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const words = answer.split(' ');
      let i = 0;

      const interval = setInterval(() => {
        if (i >= words.length) {
          // Gửi done event
          res.write(`data: ${JSON.stringify({ type: 'done', title: query.slice(0, 40) || 'Cuộc trò chuyện mới' })}\n\n`);
          res.end();
          clearInterval(interval);
          return;
        }
        const chunk = i === 0 ? words[i] : ' ' + words[i];
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        i++;
      }, WORD_DELAY_MS);

      // Cleanup nếu client disconnect
      req.on('close', () => clearInterval(interval));
      return;
    }

    // Non-streaming fallback
    cors(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ role: 'assistant', content: answer, title: query.slice(0, 40) }));
    return;
  }

  // ── GET /api/conversations ────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/conversations') {
    cors(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([{
      id: 'mock-conv-1',
      title: 'Demo SSE streaming',
      created_at: Date.now(),
      updated_at: Date.now(),
    }]));
    return;
  }

  // ── POST /api/conversations ───────────────────────────────────────────────
  if (method === 'POST' && url === '/api/conversations') {
    cors(res);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: `mock-${Date.now()}`, title: 'Cuộc trò chuyện mới', created_at: Date.now(), updated_at: Date.now() }));
    return;
  }

  // ── GET /api/conversations/:id ────────────────────────────────────────────
  const getMatch = url.match(/^\/api\/conversations\/([^/]+)$/);
  if (method === 'GET' && getMatch) {
    cors(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: getMatch[1], title: 'Demo SSE streaming', created_at: Date.now(), updated_at: Date.now(), messages: [] }));
    return;
  }

  // ── DELETE /api/conversations/:id ─────────────────────────────────────────
  const delMatch = url.match(/^\/api\/conversations\/([^/]+)$/);
  if (method === 'DELETE' && delMatch) {
    cors(res); res.writeHead(204); res.end(); return;
  }

  cors(res); res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
}

createServer(handle).listen(PORT, () => {
  console.log(`[mock-sse] Running on http://localhost:${PORT}`);
  console.log(`[mock-sse] Word delay: ${WORD_DELAY_MS}ms`);
  console.log(`[mock-sse] Set VITE_BACKEND_URL=http://localhost:${PORT} in frontend2/.env`);
});
