// Chat route: nhận message → lưu DB → gọi agent → stream/return response → lưu DB

import { Hono } from 'hono';
import { Conversation, Message } from '../db.js';
import { interpretGraph, interpretGraphStream, type HistoryItem } from '../services/graph-interpreter.js';

const router = new Hono();

/** POST /api/conversations/:id/chat?stream=true|false */
router.post('/:id/chat', async (c) => {
  const convId = c.req.param('id');
  const conv = await Conversation.findById(convId);
  if (!conv) return c.json({ error: 'Conversation not found' }, 404);

  let userText: string;
  try {
    const body = await c.req.json<{ messages: Array<{ role: string; content: unknown }> }>();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages must be a non-empty array' }, 400);
    }
    const last = body.messages.at(-1)!;
    if (last.role !== 'user') return c.json({ error: 'Last message must be from user' }, 400);
    userText =
      typeof last.content === 'string'
        ? last.content
        : (last.content as Array<{ type: string; text?: string }>)
            ?.find?.((p) => p.type === 'text')?.text ?? '';
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!userText.trim()) return c.json({ error: 'Empty message' }, 400);

  const now = Date.now();

  // Auto-title từ message đầu tiên
  const msgCount = await Message.countDocuments({ conversationId: convId });
  if (msgCount === 0) conv.title = userText.slice(0, 60);
  conv.updatedAt = now;
  await conv.save();

  await Message.create({ conversationId: convId, role: 'user', content: userText, createdAt: now });

  const prevMessages = await Message.find({ conversationId: convId, createdAt: { $lt: now } })
    .sort({ createdAt: 1 })
    .limit(20);

  const history: HistoryItem[] = prevMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));

  // ── Streaming mode: pipe agent chunks → SSE → FE ─────────────────────────
  const streamMode = c.req.query('stream') === 'true';
  if (streamMode) {
    const encoder = new TextEncoder();
    const title = conv.title;

    const readableStream = new ReadableStream({
      async start(controller) {
        let fullAnswer = '';
        try {
          for await (const chunk of interpretGraphStream(userText, history, convId)) {
            fullAnswer += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
            );
          }
          // Lưu DB sau khi stream xong
          await Message.create({ conversationId: convId, role: 'assistant', content: fullAnswer, createdAt: now + 1 });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', title })}\n\n`)
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[chat stream] Error:', msg);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // ── Non-streaming mode ────────────────────────────────────────────────────
  let answer: string;
  try {
    answer = await interpretGraph(userText, history, convId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[interpretGraph] Error:', msg);
    return c.json({ error: 'Graph interpreter error', detail: msg }, 502);
  }

  await Message.create({ conversationId: convId, role: 'assistant', content: answer, createdAt: now + 1 });
  return c.json({ role: 'assistant', content: answer, title: conv.title });
});

export default router;
