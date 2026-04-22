// dùng để lấy lịch sử tin nhắn của một conversation,
//  phục vụ cho backend agent (như cron job hoặc worker)
//  có thể truy cập mà không cần qua frontend.
//  Endpoint này yêu cầu header X-Internal-Key để đảm bảo chỉ các agent tin cậy mới có thể truy cập được, 
// tránh lộ thông tin nhạy cảm nếu endpoint bị gọi từ bên ngoài.
//  Agent có thể lấy metadata của conversation (như title) và danh sách tin nhắn với phân trang và lọc theo role (user/assistant).





import { Hono } from 'hono';
import { Conversation, Message } from '../db.js';

const router = new Hono();

// ── Internal API key middleware ───────────────────────────────────────────────
// Validates X-Internal-Key header against INTERNAL_API_KEY env var.
// Used to restrict history endpoint to trusted backend agents only.
function requireInternalKey(c: Parameters<Parameters<typeof router.use>[1]>[0], next: () => Promise<void>) {
  const expectedKey = process.env.INTERNAL_API_KEY;
  const providedKey = c.req.header('X-Internal-Key');

  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
}

// ── GET /api/conversations/:id/history ───────────────────────────────────────
// Returns conversation metadata + paginated messages for backend agent consumption.
//
// Query params:
//   ?limit=50       — max messages to return (default: 100, max: 500)
//   ?before=ts      — only messages with createdAt < ts (unix ms)
//   ?role=user|assistant — filter by role
router.get('/:id/history', requireInternalKey, async (c) => {
  const convId = c.req.param('id');

  // Look up conversation
  const conv = await Conversation.findById(convId).lean();
  if (!conv) return c.json({ error: 'Conversation not found' }, 404);

  // Parse query params
  const limitParam = c.req.query('limit');
  const beforeParam = c.req.query('before');
  const roleParam = c.req.query('role');

  const limit = Math.min(limitParam ? parseInt(limitParam, 10) || 100 : 100, 500);

  // Build message query filter
  const filter: Record<string, unknown> = { conversationId: convId };
  if (beforeParam) {
    const beforeTs = parseInt(beforeParam, 10);
    if (!isNaN(beforeTs)) filter['createdAt'] = { $lt: beforeTs };
  }
  if (roleParam === 'user' || roleParam === 'assistant') {
    filter['role'] = roleParam;
  }

  const msgs = await Message.find(filter).sort({ createdAt: 1 }).limit(limit).lean();

  return c.json({
    conversationId: conv._id,
    title: conv.title,
    messages: msgs.map((m) => ({
      id: m._id,
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      createdAt: m.createdAt,
    })),
    total: msgs.length,
  });
});

export default router;
