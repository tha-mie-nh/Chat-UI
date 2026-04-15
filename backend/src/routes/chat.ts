import { Hono } from 'hono';
import { Conversation, Message } from '../db.js';
import { interpretGraph, type HistoryItem } from '../services/graph-interpreter.js';

// ── [TEMPLATE] Demo template responses — kept for rollback ───────────────────
// const TEMPLATES: Array<{ keywords: string[]; answer: string }> = [
//   { keywords: ['xin chào', 'hello', 'hi', 'chào', 'hey'],
//     answer: 'Xin chào! Tôi là trợ lý ảo demo. Tôi có thể giúp gì cho bạn hôm nay?' },
//   { keywords: ['tạm biệt', 'bye', 'goodbye', 'gặp lại'],
//     answer: 'Tạm biệt! Chúc bạn một ngày tốt lành. Hẹn gặp lại! 👋' },
//   { keywords: ['cảm ơn', 'thank', 'thanks'],
//     answer: 'Không có gì! Rất vui được hỗ trợ bạn. Bạn cần thêm điều gì không?' },
//   { keywords: ['bạn tên gì', 'bạn là ai', 'who are you', 'tên bạn', 'bạn là chatbot'],
//     answer: 'Tôi là ChatBot Demo — được xây dựng với React, Hono và MongoDB để minh họa ứng dụng chat full-stack.' },
//   { keywords: ['thời tiết', 'weather', 'trời hôm nay'],
//     answer: 'Tôi không thể kiểm tra thời tiết thực tế, nhưng bạn có thể xem tại weather.com hoặc Google "thời tiết [thành phố]".' },
//   { keywords: ['joke', 'cười', 'hài hước', 'kể chuyện vui', 'funny'],
//     answer: 'Tại sao lập trình viên không thích thiên nhiên? Vì có quá nhiều bugs! 🐛😄' },
//   { keywords: ['giúp', 'help', 'hướng dẫn', 'làm được gì'],
//     answer: 'Tôi có thể: trả lời chào hỏi, kể chuyện vui, và trò chuyện thông thường. Hãy thử: "xin chào", "kể chuyện vui", hoặc "bạn là ai"!' },
// ];
//
// const DEFAULT_ANSWER =
//   'Tôi chưa hiểu câu hỏi này. Hãy thử: "xin chào", "giúp tôi", "kể chuyện vui", hoặc "bạn là ai"!';
//
// function findAnswer(prompt: string): string {
//   const normalized = prompt.toLowerCase().trim();
//   for (const t of TEMPLATES) {
//     if (t.keywords.some((k) => normalized.includes(k))) return t.answer;
//   }
//   return DEFAULT_ANSWER;
// }
// ── [END TEMPLATE] ───────────────────────────────────────────────────────────

const router = new Hono();

/** POST /api/conversations/:id/chat */
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

  // Auto-title from first user message
  const msgCount = await Message.countDocuments({ conversationId: convId });
  if (msgCount === 0) {
    conv.title = userText.slice(0, 60);
  }
  conv.updatedAt = now;
  await conv.save();

  // Persist user message
  await Message.create({ conversationId: convId, role: 'user', content: userText, createdAt: now });

  // ── [NEW] Call interpretGraph → agent → Gemini pipeline ──
  let answer: string;
  try {
    // Fetch conversation history (excluding current message)
    // Fetch all previous messages (both user + assistant) excluding the current one
    const prevMessages = await Message.find({ conversationId: convId, createdAt: { $lt: now } })
      .sort({ createdAt: 1 })
      .limit(20);

    const history: HistoryItem[] = prevMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

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






