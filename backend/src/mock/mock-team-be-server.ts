/**
 * Mock server giả lập backend của team BE.
 * Implement đủ API contract FE cần + CORS allow *.
 *
 * Chạy: npx tsx src/mock/mock-team-be-server.ts
 * Docker: docker build -f src/mock/Dockerfile.mock-be -t mock-team-be .
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';

const PORT = Number(process.env.PORT ?? 4001);

interface Msg  { id: string; role: 'user' | 'assistant'; content: string; createdAt: number }
interface Conv { id: string; title: string; created_at: number; updated_at: number; messages: Msg[] }

const store = new Map<string, Conv>();

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise(r => { let b=''; req.on('data',(c:Buffer)=>b+=c); req.on('end',()=>r(b)); });
}

function cors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res: ServerResponse, status: number, data: unknown) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const method = req.method ?? 'GET';
  const url    = req.url ?? '/';
  console.log(`[mock-be] ${method} ${url}`);

  // Preflight
  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // GET /api/conversations
  if (method === 'GET' && url === '/api/conversations') {
    return json(res, 200, [...store.values()].map(({messages:_,...c})=>c).sort((a,b)=>b.updated_at-a.updated_at));
  }

  // POST /api/conversations
  if (method === 'POST' && url === '/api/conversations') {
    const now = Date.now();
    const conv: Conv = { id: id(), title: 'Cuộc trò chuyện mới', created_at: now, updated_at: now, messages: [] };
    store.set(conv.id, conv);
    const { messages: _, ...rest } = conv;
    return json(res, 201, rest);
  }

  // GET /api/conversations/:id
  const getMatch = url.match(/^\/api\/conversations\/([^/]+)$/);
  if (method === 'GET' && getMatch) {
    const conv = store.get(getMatch[1]);
    return conv ? json(res, 200, conv) : json(res, 404, { error: 'Not found' });
  }

  // DELETE /api/conversations/:id
  const delMatch = url.match(/^\/api\/conversations\/([^/]+)$/);
  if (method === 'DELETE' && delMatch) {
    store.delete(delMatch[1]);
    return json(res, 200, { ok: true });
  }

  // POST /api/conversations/:id/chat
  const chatMatch = url.match(/^\/api\/conversations\/([^/]+)\/chat$/);
  if (method === 'POST' && chatMatch) {
    const conv = store.get(chatMatch[1]);
    if (!conv) return json(res, 404, { error: 'Not found' });

    const body    = await readBody(req);
    const payload = JSON.parse(body) as { messages?: { content: string }[] };
    const userText = payload.messages?.at(-1)?.content ?? '';

    conv.messages.push({ id: id(), role: 'user', content: userText, createdAt: Date.now() });
    const reply = `[mock team-BE] Nhận: "${userText}" — đây là response từ backend giả lập của team BE.`;
    conv.messages.push({ id: id(), role: 'assistant', content: reply, createdAt: Date.now() });
    conv.title = userText.slice(0, 40) || conv.title;
    conv.updated_at = Date.now();

    cors(res);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(JSON.stringify({ role: 'assistant', content: reply, title: conv.title }));
    return;
  }

  // POST /api/upload
  if (method === 'POST' && url === '/api/upload') {
    return json(res, 200, { url: 'http://placeholder/mock-image.png' });
  }

  json(res, 404, { error: 'Not found' });
}

createServer(handle).listen(PORT, () => {
  console.log(`[mock-be] Running on http://localhost:${PORT}`);
});
